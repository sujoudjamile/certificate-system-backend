// routes/staffRoutes.js

const express = require("express");
const router = express.Router();

const { addStaff } = require("../controllers/staffController");

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

/*
==================================
STAFF ROUTES
==================================
*/

// Only university admin can add staff
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin"),
  addStaff
);

module.exports = router;