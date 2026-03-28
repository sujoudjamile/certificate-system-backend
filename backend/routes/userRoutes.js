// routes/userRoutes.js

const express = require("express");
const router = express.Router();

const {
  loginUser,
  registerUser,
  activateAccount,
  resendActivationEmail,
  getAllAdminsWithStatus,
  getCurrentUser,
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

// Public resend activation route
router.post("/resend-activation", resendActivationEmail);

// Protected registration route
// Only super_admin can create users manually
router.post(
  "/register",
  authenticateToken,
  authorizeRoles("super_admin"),
  registerUser
);

//Get admins information
router.get(
  "/admins",
  authenticateToken,
  authorizeRoles("super_admin"),
  getAllAdminsWithStatus
);

// get current user information
router.get(
  "/me",
  authenticateToken,
  getCurrentUser
);

module.exports = router;