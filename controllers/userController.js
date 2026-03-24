// Import database pool
// This comes from mysql2/promise, so we use await with db.query(...)
const db = require("../config/db");

// Import bcrypt for password hashing
const bcrypt = require("bcrypt");

// Import JWT for login token creation
const jwt = require("jsonwebtoken");

/*
==================================
REGISTER USER
==================================
Only super_admin should be allowed to access this route
through middleware in routes.
*/
const registerUser = async (req, res) => {
  // Get data from request body
  const { name, email, password, role, university_id } = req.body;

  try {
    // Check required fields
    if (!name || !email || !password || !role) {
      
      return res.status(400).json({
        message: "All fields are required",
      });
    }
     // Allow only valid roles
      const allowedRoles = ["super_admin", "admin", "staff"];

     if (!allowedRoles.includes(role)) {
      return res.status(400).json({
    message: "Invalid role",
     });
    }
    // Check if email already exists
    const [existingUsers] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user as already verified because super_admin created them directly
    await db.query(
      `INSERT INTO users (name, email, password, role, university_id, is_verified)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, hashedPassword, role, university_id || null, true]
    );

    return res.status(201).json({
      message: "User registered successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
};

/*
==================================
LOGIN USER
==================================
Users log in using email + password
Only verified accounts can log in
*/
const loginUser = async (req, res) => {
  // Get login data from request body
  const { email, password } = req.body;

  try {
    // Check that email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // Find user by email
    const [results] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    // No user found
    if (results.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const user = results[0];

    // Prevent login before account activation
    if (!user.is_verified) {
      return res.status(403).json({
        message: "Please verify your account first.",
      });
    }

    // Compare entered password with hashed password in database
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // Create JWT token
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
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
};

/*
==================================
ACTIVATE ACCOUNT
==================================
Used when admin/staff clicks email link and sets password
*/
const activateAccount = async (req, res) => {
  // Get token and new password from request body
  const { token, password } = req.body;

  // Check that both token and password exist
  if (!token || !password) {
    return res.status(400).json({
      message: "Token and password are required",
    });
  }

  // Strong password validation
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#^()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      message:
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
    });
  }

  // Prevent weak/common passwords
  const commonPasswords = [
    "123456",
    "password",
    "admin123",
    "qwerty",
    "Admin123!",
  ];

  if (commonPasswords.includes(password)) {
    return res.status(400).json({
      message: "This password is too common. Please choose a stronger password.",
    });
  }

  try {
    // Find user by verification token
    const [results] = await db.query(
      "SELECT * FROM users WHERE verification_token = ?",
      [token]
    );

    // Invalid token
    if (results.length === 0) {
      return res.status(400).json({
        message: "Invalid verification token",
      });
    }

    const user = results[0];

    // If already verified
    if (user.is_verified) {
      return res.status(400).json({
        message: "Account already verified",
      });
    }

    // Check token expiry
    const now = new Date();
    const expiresAt = new Date(user.verification_expires);

    if (now > expiresAt) {
      return res.status(400).json({
        message: "Verification token expired",
      });
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user:
    // - save password
    // - mark as verified
    // - remove token
    // - remove expiry
    await db.query(
      `UPDATE users
       SET password = ?, is_verified = ?, verification_token = NULL, verification_expires = NULL
       WHERE id = ?`,
      [hashedPassword, true, user.id]
    );

    return res.status(200).json({
      message: "Account verified successfully. You can now log in.",
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
};

// Export controller functions
module.exports = {
  loginUser,
  registerUser,
  activateAccount,
};