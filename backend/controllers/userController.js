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
const isValidEmail = (email) => {//checks if email format is correct
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Strong password validation
const isStrongPassword = (password) => {//prevents weak passwords
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#^()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

  return passwordRegex.test(password);
};



// Common password blacklist
const isCommonPassword = (password) => {//prevents easy-to-guess passwords
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

  const nameRegex = /^[a-zA-Z\u0600-\u06FF]+([ '-][a-zA-Z\u0600-\u06FF]+)+$/;

if (!nameRegex.test(name.trim())) {
  throw new AppError(
    "Name must contain at least a first and last name, using letters only (no digits or special characters).",
    400
  );
}

  if (!isValidEmail(email)) {
    throw new AppError("Invalid email format", 400);
  }

  const allowedRoles = ["super_admin", "staff"];

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

  const hashedPassword = await bcrypt.hash(password, 10);//password is NOT stored as plain text

  await db.query(//user is created and already verified
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

  const [results] = await db.query(//Find user
    "SELECT * FROM users WHERE email = ?",
    [email]
  );

  if (results.length === 0) {
    throw new AppError("User not found", 404);
  }

  const user = results[0];

  if (!user.is_verified) {//prevents login before activation
    throw new AppError("Please verify your account first.", 403);
  }

  if (!user.is_active) {
  throw new AppError("Your account has been deactivated. Contact the system administrator.", 403);
}

  // Extra protection in case password is null
  if (!user.password) {//Check password exists
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

  const hashedPassword = await bcrypt.hash(password, 10);//Compare password

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

  //  Get email sent from frontend request body
  const { email } = req.body;


  //  Search for user in database using email
  const [results] = await db.query(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );


  // If no user found → return error
  if (results.length === 0) {
    throw new AppError("User not found", 404);
  }


  //  Extract the user object
  const user = results[0];


  // If user already activated account → stop
  if (user.is_verified) {
    throw new AppError("Account already verified", 400);
  }


  //  Check if current token is STILL VALID
  // If current time < expiration time → token is still usable
  // So we don't allow resend
  if (
    user.verification_expires &&
    new Date() < new Date(user.verification_expires)
  ) {
    throw new AppError("Token still valid. Cannot resend yet.", 400);
  }


  // Generate a NEW secure random token
  const verificationToken = crypto.randomBytes(32).toString("hex");


  //  Set expiration time (24 hours from now)
  const verificationExpires = new Date(
    Date.now() + 24 * 60 * 60 * 1000
  );


  //  Update database:
  // - Replace old token with new one
  // - Update expiration time
  await db.query(
    `UPDATE users
     SET verification_token = ?, verification_expires = ?
     WHERE id = ?`,
    [verificationToken, verificationExpires, user.id]
  );


  //  Create activation link with new token
  const verifyLink = `${process.env.FRONTEND_URL}/activate-account?token=${verificationToken}`;


  //  Send email to user with new activation link
  await sendEmail({
    to: user.email,
    subject: "New Activation Link",
    html: `
      <h2>New Activation Link</h2>
      <p>Your previous link expired. Use this new one:</p>
      <a href="${verifyLink}">${verifyLink}</a>
    `,
  });


  //  Send success response back to frontend
  res.json({
    status: "success",
    message: "New activation email sent",
  });

});

/*
==================================
GET ADMIN IF ACTIVE OR NOT ACTIVE
==================================

*/
const getAllAdminsWithStatus = asyncHandler(async (req, res) => {
  const [admins] = await db.query(`
    SELECT 
      u.id,
      u.name,
      u.email,
      u.is_verified,
      u.is_active,
      u.university_id,
      u.verification_expires,
      un.name AS university_name
    FROM users u
    LEFT JOIN universities un ON u.university_id = un.id
    WHERE u.role = 'admin'
    ORDER BY u.is_verified ASC, u.created_at DESC
  `);

  res.json({
    status: "success",
    admins,
  });
});

/*
==================================
GET CURRENT USER
==================================

*/

const getCurrentUser = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const [rows] = await db.query(`
    SELECT 
      u.id,
      u.name,
      u.email,
      u.is_verified,
      u.verification_expires,
      un.name AS university_name
    FROM users u
    LEFT JOIN universities un ON u.university_id = un.id
    WHERE u.id = ?
  `, [userId]);

  if (rows.length === 0) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json({
    status: "success",
    user: rows[0],
  });
});
/*
==================================
TOGGLE ADMIN ACTIVE STATUS
==================================
Super admin can activate or deactivate a university admin.
*/
const toggleAdminStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [rows] = await db.query(
    "SELECT id, name, email, is_active, role, university_id FROM users WHERE id = ?",
    [id]
  );

  if (rows.length === 0) throw new AppError("User not found", 404);
  if (rows[0].role !== "admin") throw new AppError("You can only toggle university admins", 403);

  const user      = rows[0];
  const newStatus = user.is_active ? 0 : 1;

  // ── Block activation if another active admin already exists for this university ──
  if (newStatus === 1) {
    const [activeAdmins] = await db.query(
      `SELECT id FROM users 
       WHERE university_id = ? 
         AND role        = 'admin' 
         AND is_active   = 1 
         AND id         != ?`,
      [user.university_id, id]
    );

    if (activeAdmins.length > 0) {
      throw new AppError(
        "This university already has an active admin. Deactivate the current active admin first before activating another one.",
        400
      );
    }
  }

  await db.query("UPDATE users SET is_active = ? WHERE id = ?", [newStatus, id]);

  return res.json({
    status:    "success",
    message:   `Admin ${newStatus ? "activated" : "deactivated"} successfully`,
    is_active: newStatus,
  });
});

/*
==================================
ADD ADMIN TO EXISTING UNIVERSITY
==================================
Super admin assigns a new admin to a university that already exists.
The university must not already have an active verified admin.
*/
const addAdminToUniversity = asyncHandler(async (req, res) => {
  const { adminName, adminEmail, university_id } = req.body;

  if (!adminName || !adminEmail || !university_id)
    throw new AppError("adminName, adminEmail and university_id are required", 400);

  const nameRegex = /^[a-zA-Z\u0600-\u06FF]+([ '-][a-zA-Z\u0600-\u06FF]+)+$/;

  if (!nameRegex.test(adminName.trim())) {
  throw new AppError(
    "Name must contain at least a first and last name, using letters only (no digits or special characters).",
    400
  );
}

  if (!isValidEmail(adminEmail))
    throw new AppError("Invalid email format", 400);

  // Check university exists
  const [uniRows] = await db.query(
    "SELECT id, name FROM universities WHERE id = ?",
    [university_id]
  );
  if (uniRows.length === 0) throw new AppError("University not found", 404);
  const university = uniRows[0];

  // Check email not already taken
  const [existingUser] = await db.query(
    "SELECT id FROM users WHERE email = ?",
    [adminEmail]
  );
  if (existingUser.length > 0)
    throw new AppError("A user with this email already exists", 400);

  // Check if university already has an active verified admin
  const [activeAdmin] = await db.query(
    "SELECT id FROM users WHERE university_id = ? AND role = 'admin' AND is_verified = 1 AND is_active = 1",
    [university_id]
  );
  if (activeAdmin.length > 0)
    throw new AppError(
      "This university already has an active admin. Deactivate the current admin first.",
      400
    );

  const verificationToken   = require("crypto").randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [result] = await db.query(
    `INSERT INTO users
     (name, email, password, role, university_id, is_verified, verification_token, verification_expires)
     VALUES (?, ?, NULL, 'admin', ?, 0, ?, ?)`,
    [adminName, adminEmail, university_id, verificationToken, verificationExpires]
  );

  // Update universities.admin_id to point to new admin
  await db.query("UPDATE universities SET admin_id = ? WHERE id = ?", [result.insertId, university_id]);

  const verifyLink = `${process.env.FRONTEND_URL}/activate-account?token=${verificationToken}`;

  try {
    await require("../utils/sendEmail")({
      to: adminEmail,
      subject: "Activate your CertifyLB university admin account",
      html: `
        <h2>Welcome to CertifyLB</h2>
        <p>You have been assigned as admin for <strong>${university.name}</strong>.</p>
        <p>Click the link below to verify your email and set your password:</p>
        <a href="${verifyLink}">${verifyLink}</a>
        <p>This link expires in 24 hours.</p>
      `,
    });

    return res.status(201).json({
      status: "success",
      message: "New admin created. Verification email sent.",
      adminId: result.insertId,
    });
  } catch (emailErr) {
    return res.status(201).json({
      status: "warning",
      message: "Admin created but email could not be sent.",
      adminId: result.insertId,
      emailError: emailErr.message,
    });
  }
});

module.exports = {
  loginUser,
  registerUser,
  activateAccount,
  resendActivationEmail,
  getAllAdminsWithStatus,
  getCurrentUser, 
  toggleAdminStatus,
  addAdminToUniversity,
};