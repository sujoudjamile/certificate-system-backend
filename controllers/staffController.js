// controllers/staffController.js

// Import database pool
const db = require("../config/db");

// Import crypto to generate verification token
const crypto = require("crypto");

// Import email helper
const sendEmail = require("../utils/sendEmail");

/*
==================================
ADD STAFF
==================================
This function:
1. Allows a university admin to add a staff member
2. Creates the staff account as unverified
3. Generates a verification token
4. Sends an email so staff can activate the account
*/
const addStaff = async (req, res) => {
  try {
    // Get staff data from request body
    const { name, email } = req.body;

    // Basic validation
    if (!name || !email) {
      return res.status(400).json({
        message: "Name and email are required",
      });
    }

    // The logged-in admin comes from JWT middleware
    // We use the university_id from the admin token
    const universityId = req.user.university_id;

    // Extra safety: admin must belong to a university
    if (!universityId) {
      return res.status(400).json({
        message: "Admin is not linked to any university",
      });
    }

    // Check if email is already used
    const [existingUsers] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        message: "A user with this email already exists",
      });
    }

    // Generate one-time verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Token expires in 24 hours
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Insert staff account
    // password = null until the staff sets their own password
    // is_verified = false until activation
    const [result] = await db.query(
      `INSERT INTO users
       (name, email, password, role, university_id, is_verified, verification_token, verification_expires)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        email,
        null,
        "staff",
        universityId,
        false,
        verificationToken,
        verificationExpires,
      ]
    );

    // Build staff activation link
    const verifyLink = `${process.env.FRONTEND_URL}/activate-account?token=${verificationToken}`;

    try {
      // Send email to the staff member
      await sendEmail({
        to: email,
        subject: "Activate your CertifyLB staff account",
        html: `
          <h2>Welcome to CertifyLB</h2>
          <p>You were added as a staff member.</p>
          <p>Click the link below to verify your email and set your password:</p>
          <a href="${verifyLink}">${verifyLink}</a>
          <p>This link will expire in 24 hours.</p>
        `,
      });

      return res.status(201).json({
        status: "success",
        message: "Staff member added successfully. Verification email sent.",
        staffId: result.insertId,
      });
    } catch (emailErr) {
      // Staff was created in DB, but email failed
      return res.status(201).json({
        status: "warning",
        message: "Staff member added, but email could not be sent.",
        staffId: result.insertId,
        error: emailErr.message,
      });
    }
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
};

module.exports = {
  addStaff,
};