// Import JWT library
const jwt = require("jsonwebtoken");

/*
  This middleware checks if the user is authenticated.
  It verifies the JWT token sent in the Authorization header.
*/
const authenticateToken = (req, res, next) => {

  // Get the Authorization header
  const authHeader = req.headers["authorization"];

  // If no header exists → block access
  if (!authHeader) {
    return res.status(401).json({
      message: "Access denied. No token provided."
    });
  }

  // Remove "Bearer " from token
  const token = authHeader.split(" ")[1];

  try {
    // Verify token using secret from .env
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Save user data into request object
    req.user = decoded;

    // Continue to next middleware
    next();

  } catch (error) {
    return res.status(403).json({
      message: "Invalid or expired token."
    });
  }
};

// Export middleware
module.exports = authenticateToken;