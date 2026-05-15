// controllers/staffController.js
const db = require("../config/db");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const logAction = require("../utils/auditLog");

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// ADD STAFF
const addStaff = asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) throw new AppError("Name and email are required", 400);
  if (!isValidEmail(email)) throw new AppError("Invalid email format", 400);

  const universityId = req.user.university_id;
  const adminId = req.user.id;

  const [existingUsers] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
  if (existingUsers.length > 0) throw new AppError("A user with this email already exists", 400);

  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [result] = await db.query(
    `INSERT INTO users (name, email, role, university_id, created_by, is_verified, verification_token, verification_expires)
     VALUES (?, ?, 'staff', ?, ?, false, ?, ?)`,
    [name, email, universityId, adminId, verificationToken, verificationExpires]
  );

  try {
    const verifyLink = `${process.env.FRONTEND_URL}/activate-account?token=${verificationToken}`;
    await sendEmail({
      to: email,
      subject: "Activate your account",
      html: `<p>Welcome! Click <a href="${verifyLink}">here</a> to activate.</p>`
    });

    await logAction({
      user_id: adminId,
      university_id: universityId,
      action: "ADD_STAFF",
      description: `Added ${name}`,
      status: "success",
      target_id: result.insertId,
      ip_address: req.ip,
    });

    res.status(201).json({ status: "success", message: "Staff added successfully." });
  } catch (err) {
    res.status(201).json({ status: "warning", message: "Staff added, email failed." });
  }
});

// GET STAFF (WITH CASE-INSENSITIVE SEARCH)
const getStaff = asyncHandler(async (req, res) => {
  const universityId = req.user.university_id;
  
  // 1. Capture the search term from query params (e.g., ?search=jamil)
  const searchTerm = req.query.search ? `%${req.query.search}%` : '%';

  // 2. We use LOWER() to ensure "jamil" matches "Jamil"
  const [staffs] = await db.query(`
    SELECT 
      u.id, u.name, u.email, u.is_verified, 
      un.name AS university_name
    FROM users u
    LEFT JOIN universities un ON u.university_id = un.id
    WHERE u.role = 'staff' 
      AND u.university_id = ?
      AND (LOWER(u.name) LIKE LOWER(?) OR LOWER(u.email) LIKE LOWER(?))
    ORDER BY u.created_at DESC
  `, [universityId, searchTerm, searchTerm]);

  res.json({
    status: "success",
    count: staffs.length,
    staffs,
  });
});

module.exports = { addStaff, getStaff };