// middleware/roleMiddleware.js

/*
==================================
AUTHORIZE ROLES
==================================
This middleware checks whether the logged-in user
has one of the allowed roles.
Example:
authorizeRoles("super_admin")
authorizeRoles("admin", "staff")
*/
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    // No authenticated user found
    if (!req.user) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized.",
      });
    }

    // Role not allowed
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        message: "Access forbidden: insufficient permissions.",
      });
    }

    next();
  };
};

module.exports = authorizeRoles;