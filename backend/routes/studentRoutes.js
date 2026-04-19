const express = require("express");
const router = express.Router();

const {
  addStudent,
  getStudents,
  getStudentByNationalId   // ✅ ADD THIS
} = require("../controllers/studentController");

const authenticateToken = require("../middleware/authmiddleware");
const authorizeRoles = require("../middleware/rolemiddleware");

// ==========================
// STUDENT ROUTES
// ==========================

// Add student
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  addStudent
);

// Get all students (per university)
router.get(
  "/",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  getStudents
);

// 🔥 AUTO-FILL ROUTE (NEW)
router.get(
  "/by-national-id/:national_id",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  getStudentByNationalId
);

module.exports = router;