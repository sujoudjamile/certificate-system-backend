
const express = require("express");
const router = express.Router();

// Import controller function
const { addStaff } = require("../controllers/staffController");

// Import middlewares
const authenticateToken = require("../middleware/authmiddleware");
const authorizeRoles = require("../middleware/rolemiddleware");

/*
==================================
STAFF ROUTES
==================================
*/

// Only university admin can add staff
router.post(
  "/",
  authenticateToken,        // First: make sure the user is logged in
  authorizeRoles("admin"),  // Second: only admin role is allowed
  addStaff                  // Third: run the controller
);

module.exports = router;