// middleware/authMiddleware.js

const jwt = require("jsonwebtoken");

/*
==================================
AUTHENTICATE TOKEN
==================================
This middleware:
1. Checks if Authorization header exists
2. Validates Bearer token format
3. Verifies JWT token
4. Stores decoded user data in req.user
*/
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // No Authorization header
  if (!authHeader) {
    return res.status(401).json({
      status: "error",
      message: "Access denied. No token provided.",
    });
  }

  // Expected format: Bearer <token>
  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      status: "error",
      message: "Invalid authorization format. Use Bearer token.",
    });
  }

  const token = parts[1];

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Save decoded payload into request
    req.user = decoded;

    next();
  } catch (error) {
    return res.status(403).json({
      status: "error",
      message: "Invalid or expired token.",
    });
  }
};

module.exports = authenticateToken;