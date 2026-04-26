const express = require("express");
const router = express.Router();

const {
  addStudent,
  getStudents,
  getStudentByNationalId ,  // ✅ ADD THIS
  updateStudent,
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

// Update student record (email, phone, student_code)
// PATCH /api/students/record/42
router.patch(
  "/record/:record_id",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  updateStudent
);

module.exports = router;