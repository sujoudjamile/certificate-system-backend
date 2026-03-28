// controllers/staffController.js

const db = require("../config/db");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

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
ADD STAFF
==================================
This function:
1. Allows a university admin to add a staff member
2. Creates staff account as unverified
3. Generates a verification token
4. Sends activation email
*/
const addStaff = asyncHandler(async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    throw new AppError("Name and email are required", 400);
  }

  if (!isValidEmail(email)) {
    throw new AppError("Invalid email format", 400);
  }

  const universityId = req.user.university_id;
  const adminId = req.user.id;

  if (!universityId) {
    throw new AppError("Admin is not linked to any university", 400);
  }

  const [existingUsers] = await db.query(
    "SELECT id FROM users WHERE email = ?",
    [email]
  );

  if (existingUsers.length > 0) {
    throw new AppError("A user with this email already exists", 400);
  }

  // Get admin info
  const [adminRows] = await db.query(
    "SELECT id, name, email, university_id FROM users WHERE id = ?",
    [adminId]
  );

  if (adminRows.length === 0) {
    throw new AppError("Admin not found", 404);
  }

  const admin = adminRows[0];

  // Get university info
  const [universityRows] = await db.query(
    "SELECT id, name FROM universities WHERE id = ?",
    [universityId]
  );

  if (universityRows.length === 0) {
    throw new AppError("University not found", 404);
  }

  const university = universityRows[0];

  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [result] = await db.query(
    `INSERT INTO users
     (name, email, password, role, university_id, created_by, is_verified, verification_token, verification_expires)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      email,
      null,
      "staff",
      universityId,
      adminId,
      false,
      verificationToken,
      verificationExpires,
    ]
  );

  const verifyLink = `${process.env.FRONTEND_URL}/activate-account?token=${verificationToken}`;

  try {
    await sendEmail({
      to: email,
      subject: "Activate your CertifyLB staff account",
      html: `
        <h2>Welcome to CertifyLB</h2>
        <p>You were added as a <strong>staff member</strong>.</p>
        <p><strong>Created by:</strong> ${admin.name}</p>
        <p><strong>University:</strong> ${university.name}</p>
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
    return res.status(201).json({
      status: "warning",
      message: "Staff member added, but email could not be sent.",
      staffId: result.insertId,
      emailError: emailErr.message,
    });
  }
});

/*
==================================
GET STAFF
==================================
*/

const getStaff = asyncHandler(async (req, res) => {
  const [staffs] = await db.query(`
    SELECT 
      u.id,
      u.name,
      u.email,
      u.is_verified,
      u.verification_expires,
      un.name AS university_name
    FROM users u
    LEFT JOIN universities un ON u.university_id = un.id
    WHERE u.role = 'staff'
    ORDER BY u.is_verified ASC, u.created_at DESC
  `);

  res.json({
    status: "success",
    staffs,
  });
});


module.exports = {
  addStaff,
  getStaff
};