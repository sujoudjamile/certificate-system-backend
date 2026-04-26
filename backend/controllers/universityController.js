// controllers/universityController.js

const db = require("../config/db");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { createVaultKey, getVaultPublicKey } = require("../utils/vaultClient");
const logAction = require("../utils/auditLog");
/*
==================================
HELPER
==================================
*/
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/*
==================================
CREATE UNIVERSITY
==================================
*/
const createUniversity = asyncHandler(async (req, res) => {
  let { universityName, adminName, adminEmail } = req.body;

  // 🚨 Required fields
  if (!universityName || !adminName || !adminEmail) {
    throw new AppError("All fields are required", 400);
  }

  // 🧹 Clean + format university name
  universityName = universityName?.trim();

  // 🔤 AUTO FORMAT NAME
  universityName = universityName
    .toLowerCase()
    .split(" ")
    .filter(word => word)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  // 🚫 COMBINED VALIDATION

  // Too short → abbreviation
  if (universityName.length < 10) {
    throw new AppError(
      "University name must be the full official name",
      400
    );
  }

  // All caps abbreviation (LIU, AUB)
  if (/^[A-Z\s]{2,10}$/.test(universityName)) {
    throw new AppError(
      "Abbreviations are not allowed. Use full university name",
      400
    );
  }

  // 🔐 Email validation
  if (!isValidEmail(adminEmail)) {
    throw new AppError("Invalid admin email format", 400);
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 🚫 Prevent duplicate admin email
    const [existingUsers] = await connection.query(
      "SELECT id FROM users WHERE email = ?",
      [adminEmail]
    );

    if (existingUsers.length > 0) {
      throw new AppError(
        "A user with this admin email already exists",
        400
      );
    }

    // 🚫 Prevent duplicate university name
    const [existingUniversityByName] = await connection.query(
      "SELECT id FROM universities WHERE name = ?",
      [universityName]
    );

    if (existingUniversityByName.length > 0) {
      throw new AppError("University already exists", 400);
    }

    // Generate activation key
    const activationKey = crypto.randomBytes(16).toString("hex");

    // Generate admin verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Unique Vault key reference name for this university
    const keyReference = `university_${crypto.randomUUID()}_key`;

    // ✅ CREATE RSA-2048 signing key in Vault Transit
    // The private key stays inside Vault — we only store the public key in DB.
    await createVaultKey(keyReference);

    // ✅ READ back the public key so we can store it in DB for verification
    const publicKey = await getVaultPublicKey(keyReference);

    // 🚫 Check if university already has admin
    const [existingUniversity] = await connection.query(
      "SELECT id, admin_id FROM universities WHERE name = ?",
      [universityName]
    );

    if (existingUniversity.length > 0) {
      if (existingUniversity[0].admin_id) {
        throw new AppError(
          "This university already has an admin",
          400
        );
      }
    }

    // ✅ Insert university (with real public key from Vault)
    const [universityResult] = await connection.query(
      `INSERT INTO universities
       (name, activation_key, public_key, key_reference)
       VALUES (?, ?, ?, ?)`,
      [universityName, activationKey, publicKey, keyReference]
    );

    const universityId = universityResult.insertId;

    // ✅ Insert admin
    const [adminResult] = await connection.query(
      `INSERT INTO users
       (name, email, password, role, university_id, is_verified, verification_token, verification_expires)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        adminName,
        adminEmail,
        null,
        "admin",
        universityId,
        false,
        verificationToken,
        verificationExpires,
      ]
    );

    // Link admin to university
    await connection.query(
      "UPDATE universities SET admin_id = ? WHERE id = ?",
      [adminResult.insertId, universityId]
    );

    await connection.commit();

    // ── Generate X.509 cert for PDF signing ──
    // This is separate from the Vault key (which is for data signing)
    let x509CertPem      = null;
    let encryptedPrivKey = null;

    try {
      const { generateUniversityCert } = require("../utils/pdfSigner");
      const result = generateUniversityCert(universityName);
      x509CertPem      = result.x509CertPem;
      encryptedPrivKey = result.encryptedPrivateKey;

      await db.query(
        "UPDATE universities SET x509_cert = ?, pdf_signing_key = ? WHERE id = ?",
        [x509CertPem, encryptedPrivKey, universityId]
      );
      console.log(`✅ X.509 cert generated for ${universityName}`);
    } catch (certErr) {
      // Non-fatal: university is created, cert can be generated later
      console.error("X.509 cert generation failed:", certErr.message);
    }

    const verifyLink = `${process.env.FRONTEND_URL}/activate-account?token=${verificationToken}`;

    try {
      await sendEmail({
        to: adminEmail,
        subject: "Activate your CertifyLB university admin account",
        html: `
          <h2>Welcome to CertifyLB</h2>
          <p>Your university admin account has been created by the <strong>Super Admin</strong>.</p>
          <p><strong>University:</strong> ${universityName}</p>
          <p>Click the link below to verify your email and set your password:</p>
          <a href="${verifyLink}">${verifyLink}</a>
          <p>This link will expire in 24 hours.</p>
        `,
      });

      await logAction({
        user_id:       req.user.id,
        university_id: universityId,
        action:        "CREATE_UNIVERSITY",
        description:   `Created university ${universityName} with admin ${adminEmail}`,
        status:        "success",
        target_type:   "university",
        target_id:     universityId,
        ip_address:    req.ip,
      });

      return res.status(201).json({
        status: "success",
        message: "University created successfully. Verification email sent to the admin.",
        universityId,
        adminId: adminResult.insertId,
        activationKey,
        keyReference,
        pdf_cert_generated: x509CertPem !== null,
      });
    } catch (emailError) {

      await logAction({
        user_id:       req.user.id,
        university_id: universityId,
        action:        "CREATE_UNIVERSITY",
        description:   `Created university ${universityName} — email failed`,
        status:        "success",
        target_type:   "university",
        target_id:     universityId,
        ip_address:    req.ip,
      });

      return res.status(201).json({
        status: "warning",
        message: "University created successfully, but email could not be sent.",
        universityId,
        adminId: adminResult.insertId,
        activationKey,
        keyReference,
        pdf_cert_generated: x509CertPem !== null,
        emailError: emailError.message,
      });
    }
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

module.exports = {
  createUniversity,
};