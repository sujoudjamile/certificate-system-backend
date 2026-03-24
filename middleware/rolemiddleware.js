/*
  This middleware checks if user has allowed role.
  Example: authorizeRoles("super_admin")
*/

const authorizeRoles = (...allowedRoles) => {

  // Return another middleware function
  return (req, res, next) => {

    // If no user found (token missing)
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized."
      });
    }

    // If role not allowed
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access forbidden: insufficient permissions."
      });
    }

    // Role allowed → continue
    next();
  };
};

module.exports = authorizeRoles;