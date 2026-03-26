// routes/userRoutes.js

const express = require("express");
const router = express.Router();

const {
  loginUser,
  registerUser,
  activateAccount,
  resendActivationEmail,
  getManagedUsers,
  resendActivationById,
} = require("../controllers/userController");

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

/*
==================================
AUTH ROUTES
==================================
*/

// Public login route
router.post("/login", loginUser);

// Public account activation route
router.post("/activate-account", activateAccount);

// Public resend activation route by email
// This can still be used if needed
router.post("/resend-activation", resendActivationEmail);

// Protected registration route
// Only super_admin can manually create users directly
router.post(
  "/register",
  authenticateToken,
  authorizeRoles("super_admin"),
  registerUser
);

/*
==================================
USER MANAGEMENT ROUTES
==================================
*/

// Get managed users by role and status
// super_admin -> admins
// admin -> staff
router.get(
  "/manage",
  authenticateToken,
  authorizeRoles("super_admin", "admin"),
  getManagedUsers
);

// Resend activation by user ID
// super_admin -> admin
// admin -> staff
router.post(
  "/:id/resend-activation",
  authenticateToken,
  authorizeRoles("super_admin", "admin"),
  resendActivationById
);

module.exports = router;