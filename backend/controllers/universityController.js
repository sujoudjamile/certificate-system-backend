// controllers/universityController.js

const db = require("../config/db");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { createVaultKey, getVaultPublicKey } = require("../utils/vaultClient");

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
This function:
1. Validates input
2. Generates activation key
3. Generates admin verification token
4. Creates RSA key inside Vault
5. Reads public key from Vault
6. Stores public key + key reference in DB
7. Creates admin account
8. Sends activation email
*/
const createUniversity = asyncHandler(async (req, res) => {
  const { universityName, adminName, adminEmail } = req.body;

  if (!universityName || !adminName || !adminEmail) {
    throw new AppError("All fields are required", 400);
  }

  if (!isValidEmail(adminEmail)) {
    throw new AppError("Invalid admin email format", 400);
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [existingUsers] = await connection.query(
      "SELECT id FROM users WHERE email = ?",
      [adminEmail]
    );

    if (existingUsers.length > 0) {
      throw new AppError("A user with this admin email already exists", 400);
    }

    // Generate university activation key
    const activationKey = crypto.randomBytes(16).toString("hex");

    // Generate admin verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Better unique naming for Vault key
    const keyReference = `university_${crypto.randomUUID()}_key`;

    // Create RSA key in Vault
    await createVaultKey(keyReference);

    // Read public key from Vault
    const publicKey = await getVaultPublicKey(keyReference);

    // Insert university
    const [universityResult] = await connection.query(
      `INSERT INTO universities
       (name, activation_key, public_key, key_reference)
       VALUES (?, ?, ?, ?)`,
      [universityName, activationKey, publicKey, keyReference]
    );

    const universityId = universityResult.insertId;

    // Insert admin user
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

    await connection.commit();

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

      return res.status(201).json({
        status: "success",
        message:
          "University created successfully. Verification email sent to the admin.",
        universityId,
        adminId: adminResult.insertId,
        activationKey,
        keyReference,
      });
    } catch (emailError) {
      return res.status(201).json({
        status: "warning",
        message:
          "University created successfully, but email could not be sent.",
        universityId,
        adminId: adminResult.insertId,
        activationKey,
        keyReference,
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