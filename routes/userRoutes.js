
const express = require("express");
const router = express.Router();

// Import controller functions
const {
  loginUser,
  registerUser,
  activateAccount,
} = require("../controllers/userController");

// Import middleware
const authenticateToken = require("../middleware/authmiddleware");
const authorizeRoles = require("../middleware/rolemiddleware");

/*
==================================
AUTH ROUTES
==================================
*/

// Public login route
router.post("/login", loginUser);

// Public route used from email activation link
router.post("/activate-account", activateAccount);

// Protected registration route
// Only super_admin can create users manually
router.post(
  "/register",
  authenticateToken,
  authorizeRoles("super_admin"),
  registerUser
);

module.exports = router;