// controllers/userController.js

const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const sendEmail = require("../utils/sendEmail");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

/*
==================================
HELPERS
==================================
*/

// Basic email format validation
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Strong password validation
const isStrongPassword = (password) => {
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#^()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

  return passwordRegex.test(password);
};

// Common password blacklist
const isCommonPassword = (password) => {
  const commonPasswords = [
    "123456",
    "password",
    "admin123",
    "qwerty",
    "Admin123!",
  ];

  return commonPasswords.includes(password);
};

/*
==================================
REGISTER USER
==================================
Only super_admin should be able to access this route
through middleware.
*/
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, university_id } = req.body;

  if (!name || !email || !password || !role) {
    throw new AppError("All fields are required", 400);
  }

  if (!isValidEmail(email)) {
    throw new AppError("Invalid email format", 400);
  }

  const allowedRoles = ["super_admin", "admin", "staff"];

  if (!allowedRoles.includes(role)) {
    throw new AppError("Invalid role", 400);
  }

  if (!isStrongPassword(password)) {
    throw new AppError(
      "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
      400
    );
  }

  if (isCommonPassword(password)) {
    throw new AppError(
      "This password is too common. Please choose a stronger password.",
      400
    );
  }

  const [existingUsers] = await db.query(
    "SELECT id FROM users WHERE email = ?",
    [email]
  );

  if (existingUsers.length > 0) {
    throw new AppError("Email already exists", 400);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await db.query(
    `INSERT INTO users (name, email, password, role, university_id, is_verified)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, email, hashedPassword, role, university_id || null, true]
  );

  return res.status(201).json({
    status: "success",
    message: "User registered successfully",
  });
});

/*
==================================
LOGIN USER
==================================
Users log in using email and password
Only verified accounts can log in
*/
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }

  if (!isValidEmail(email)) {
    throw new AppError("Invalid email format", 400);
  }

  const [results] = await db.query(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );

  if (results.length === 0) {
    throw new AppError("User not found", 404);
  }

  const user = results[0];

  if (!user.is_verified) {
    throw new AppError("Please verify your account first.", 403);
  }

  // Extra protection in case password is null
  if (!user.password) {
    throw new AppError("Account is not ready for login yet.", 403);
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new AppError("Invalid credentials", 401);
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      university_id: user.university_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  return res.status(200).json({
    status: "success",
    message: "Login successful",
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      university_id: user.university_id,
    },
  });
});

/*
==================================
ACTIVATE ACCOUNT
==================================
Used when admin/staff clicks email link
and sets password for the first time
*/
const activateAccount = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    throw new AppError("Token and password are required", 400);
  }

  if (!isStrongPassword(password)) {
    throw new AppError(
      "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
      400
    );
  }

  if (isCommonPassword(password)) {
    throw new AppError(
      "This password is too common. Please choose a stronger password.",
      400
    );
  }

  const [results] = await db.query(
    "SELECT * FROM users WHERE verification_token = ?",
    [token]
  );

  if (results.length === 0) {
    throw new AppError("Invalid verification token", 400);
  }

  const user = results[0];

  if (user.is_verified) {
    throw new AppError("Account already verified", 400);
  }

  const now = new Date();
  const expiresAt = new Date(user.verification_expires);

  if (now > expiresAt) {
    throw new AppError("Verification token expired", 400);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await db.query(
    `UPDATE users
     SET password = ?, is_verified = ?, verification_token = NULL, verification_expires = NULL
     WHERE id = ?`,
    [hashedPassword, true, user.id]
  );

  return res.status(200).json({
    status: "success",
    message: "Account verified successfully. You can now log in.",
  });
});

/*
==================================
RESEND ACTIVATION EMAIL
==================================
Used when invited user did not activate account in time
*/
const resendActivationEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new AppError("Email is required", 400);
  }

  if (!isValidEmail(email)) {
    throw new AppError("Invalid email format", 400);
  }

  const [results] = await db.query(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );

  if (results.length === 0) {
    throw new AppError("User not found", 404);
  }

  const user = results[0];

  if (user.is_verified) {
    throw new AppError("Account is already verified", 400);
  }

  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.query(
    `UPDATE users
     SET verification_token = ?, verification_expires = ?
     WHERE id = ?`,
    [verificationToken, verificationExpires, user.id]
  );

  const verifyLink = `${process.env.FRONTEND_URL}/activate-account?token=${verificationToken}`;

  await sendEmail({
    to: user.email,
    subject: "Activate your CertifyLB account",
    html: `
      <h2>Activate your account</h2>
      <p>Click the link below to verify your email and set your password:</p>
      <a href="${verifyLink}">${verifyLink}</a>
      <p>This link will expire in 24 hours.</p>
    `,
  });

  return res.status(200).json({
    status: "success",
    message: "Activation email resent successfully",
  });
});
/*
==================================
GET USERS BY ROLE + STATUS
==================================
This endpoint allows:
- super_admin to view admins
- admin to view staff

Query params:
- role=admin or staff
- status=active or inactive

Rules:
- super_admin can only manage admins
- admin can only manage staff
*/
const getManagedUsers = asyncHandler(async (req, res) => {
  const { role, status } = req.query;

  // Logged-in user info from JWT
  const currentUser = req.user;

  // Validate role query
  if (!role || !["admin", "staff"].includes(role)) {
    throw new AppError("Role must be 'admin' or 'staff'", 400);
  }

  // Validate status query
  if (!status || !["active", "inactive"].includes(status)) {
    throw new AppError("Status must be 'active' or 'inactive'", 400);
  }

  // Security rules:
  // super_admin can only view admins
  if (currentUser.role === "super_admin" && role !== "admin") {
    throw new AppError("Super admin can only manage admin accounts", 403);
  }

  // admin can only view staff
  if (currentUser.role === "admin" && role !== "staff") {
    throw new AppError("Admin can only manage staff accounts", 403);
  }

  // staff cannot access this route
  if (!["super_admin", "admin"].includes(currentUser.role)) {
    throw new AppError("Access forbidden", 403);
  }

  // Convert status into is_verified
  const isVerified = status === "active" ? 1 : 0;

  let query = "";
  let params = [];

  // Super admin views all admins
  if (currentUser.role === "super_admin") {
    query = `
      SELECT id, name, email, role, university_id, created_by, is_verified, is_active, is_flagged, created_at
      FROM users
      WHERE role = ? AND is_verified = ?
      ORDER BY created_at DESC
    `;
    params = [role, isVerified];
  }

  // Admin views only staff from their own university
  if (currentUser.role === "admin") {
    query = `
      SELECT id, name, email, role, university_id, created_by, is_verified, is_active, is_flagged, created_at
      FROM users
      WHERE role = ? AND is_verified = ? AND university_id = ?
      ORDER BY created_at DESC
    `;
    params = [role, isVerified, currentUser.university_id];
  }

  const [users] = await db.query(query, params);

  return res.status(200).json({
    status: "success",
    count: users.length,
    users,
  });
});

/*
==================================
RESEND ACTIVATION BY USER ID
==================================
This endpoint allows:
- super_admin to resend activation for admins
- admin to resend activation for staff

Flow:
1. Find user by ID
2. Check permissions
3. Check user is not already verified
4. Generate new token
5. Save new token + expiry
6. Send new email
*/
const resendActivationById = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const currentUser = req.user;

  // Find target user
  const [users] = await db.query(
    `
    SELECT id, name, email, role, university_id, is_verified
    FROM users
    WHERE id = ?
    `,
    [userId]
  );

  if (users.length === 0) {
    throw new AppError("User not found", 404);
  }

  const targetUser = users[0];

  // User already activated
  if (targetUser.is_verified) {
    throw new AppError("This account is already activated", 400);
  }

  // Authorization rules
  // super_admin can only resend for admins
  if (currentUser.role === "super_admin") {
    if (targetUser.role !== "admin") {
      throw new AppError("Super admin can only resend activation for admins", 403);
    }
  }
  // admin can only resend for staff from same university
  else if (currentUser.role === "admin") {
    if (targetUser.role !== "staff") {
      throw new AppError("Admin can only resend activation for staff", 403);
    }

    if (targetUser.university_id !== currentUser.university_id) {
      throw new AppError("You can only manage staff from your own university", 403);
    }
  } else {
    throw new AppError("Access forbidden", 403);
  }

  // Generate new token
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Update DB with new token and new expiry
  await db.query(
    `
    UPDATE users
    SET verification_token = ?, verification_expires = ?
    WHERE id = ?
    `,
    [verificationToken, verificationExpires, targetUser.id]
  );

  // Build activation link
  const verifyLink = `${process.env.FRONTEND_URL}/activate-account?token=${verificationToken}`;

  // Build email message depending on who is sending
  let createdByText = "";
  let universityText = "";

  if (currentUser.role === "super_admin") {
    createdByText = `<p>Your account activation link was resent by the <strong>Super Admin</strong>.</p>`;
  }

  if (currentUser.role === "admin") {
    // Get university name for better email content
    const [universityRows] = await db.query(
      "SELECT name FROM universities WHERE id = ?",
      [currentUser.university_id]
    );

    const universityName =
      universityRows.length > 0 ? universityRows[0].name : "Your University";

    createdByText = `<p>Your account activation link was resent by <strong>${currentUser.name}</strong>.</p>`;
    universityText = `<p><strong>University:</strong> ${universityName}</p>`;
  }

  // Send email
  await sendEmail({
    to: targetUser.email,
    subject: "Activate your CertifyLB account",
    html: `
      <h2>Welcome to CertifyLB</h2>
      ${createdByText}
      ${universityText}
      <p>Click the link below to verify your email and set your password:</p>
      <a href="${verifyLink}">${verifyLink}</a>
      <p>This link will expire in 24 hours.</p>
    `,
  });

  return res.status(200).json({
    status: "success",
    message: "A new activation email has been sent successfully",
  });
});

module.exports = {
  registerUser,
  loginUser,
  activateAccount,
  resendActivationEmail,
  getManagedUsers,
  resendActivationById,
};