
// Import database pool
const db = require("../config/db");

// Import crypto for:
// 1) random activation key
// 2) random verification token
// 3) RSA key pair generation
const crypto = require("crypto");
const { generateKeyPairSync } = require("crypto");

// Import email helper
const sendEmail = require("../utils/sendEmail");

// Import async error wrapper
const asyncHandler = require("../utils/asyncHandler");

// Import custom app error
const AppError = require("../utils/AppError");

// Import helper that encrypts the private key before saving it
const { encryptPrivateKey } = require("../utils/keyEncryption");

/*
==================================
CREATE UNIVERSITY
==================================
This function does the following:
1. Validate input
2. Generate activation key for the university
3. Generate verification token for the admin
4. Generate RSA public/private keys
5. Encrypt the private key
6. Store university in database
7. Store admin account in database
8. Commit transaction
9. Send activation email
*/
const createUniversity = asyncHandler(async (req, res) => {
  // Read data sent from frontend/Postman
  const { universityName, adminName, adminEmail } = req.body;

  // Basic validation
  if (!universityName || !adminName || !adminEmail) {
    throw new AppError("All fields are required", 400);
  }

  // Get one DB connection from the pool
  // We need one connection because transactions must stay on the same connection
  const connection = await db.getConnection();

  try {
    // Start transaction
    // This means either all inserts succeed together, or all fail together
    await connection.beginTransaction();

    // Check if admin email already exists
    const [existingUsers] = await connection.query(
      "SELECT id FROM users WHERE email = ?",
      [adminEmail]
    );

    if (existingUsers.length > 0) {
      throw new AppError("A user with this admin email already exists", 400);
    }

    // Generate a random activation key for the university
    const activationKey = crypto.randomBytes(16).toString("hex");

    // Generate a verification token for admin activation
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Token expiry = 24 hours from now
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Generate RSA key pair for this university
    // publicKey -> used later to verify signatures
    // privateKey -> used later to sign certificates
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });

    // Encrypt the private key before saving it
    const encryptedPrivateKey = encryptPrivateKey(privateKey);

    // Insert university into database
    // Notice:
    // - public_key is stored normally
    // - private key is stored in encrypted form
    const [universityResult] = await connection.query(
      `INSERT INTO universities
       (name, activation_key, public_key, private_key_encrypted, private_key_iv, private_key_tag)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        universityName,
        activationKey,
        publicKey,
        encryptedPrivateKey.encryptedData,
        encryptedPrivateKey.iv,
        encryptedPrivateKey.tag,
      ]
    );

    // Get the new university ID
    const universityId = universityResult.insertId;

    // Insert university admin user
    // password is null because admin will set it later after email verification
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

    // If both inserts succeed, save them permanently
    await connection.commit();

    // Build activation link
    const verifyLink = `${process.env.FRONTEND_URL}/activate-account?token=${verificationToken}`;

    // Send email after commit
    // Why after commit?
    // So we do not send an email for data that failed to save
    try {
      await sendEmail({
        to: adminEmail,
        subject: "Activate your CertifyLB university admin account",
        html: `
          <h2>Welcome to CertifyLB</h2>
          <p>Your university admin account has been created.</p>
          <p>Click the link below to verify your email and set your password:</p>
          <a href="${verifyLink}">${verifyLink}</a>
          <p>This link will expire in 24 hours.</p>
        `,
      });
    } catch (emailError) {
      // The DB part succeeded, but email failed
      // We return a warning instead of crashing the request
      return res.status(201).json({
        status: "warning",
        message: "University created successfully, but email could not be sent.",
        universityId,
        adminId: adminResult.insertId,
        activationKey,
        emailError: emailError.message,
      });
    }

    // Final success response
    return res.status(201).json({
      status: "success",
      message: "University created successfully. Verification email sent to the admin.",
      universityId,
      adminId: adminResult.insertId,
      activationKey,
    });
  } catch (error) {
    // If any DB step fails before commit, undo everything
    await connection.rollback();
    throw error;
  } finally {
    // Always release the connection back to the pool
    connection.release();
  }
});

module.exports = {
  createUniversity,
};