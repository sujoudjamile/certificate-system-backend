const express = require("express");
const router = express.Router();

const {
  addStudent,
  getStudents,
  getStudentByNationalId,
  updateStudent,
} = require("../controllers/studentController");

const authenticateToken = require("../middleware/authmiddleware");
const authorizeRoles = require("../middleware/rolemiddleware");

// Add student
router.post("/", authenticateToken, authorizeRoles("admin", "staff"), addStudent);

// Get students (This now supports search automatically)
router.get("/", authenticateToken, authorizeRoles("admin", "staff"), getStudents);

// Auto-fill by ID
router.get("/by-national-id/:national_id", authenticateToken, authorizeRoles("admin", "staff"), getStudentByNationalId);

// Update record
router.patch("/record/:record_id", authenticateToken, authorizeRoles("admin", "staff"), updateStudent);

module.exports = router;