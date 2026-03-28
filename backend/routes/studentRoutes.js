const express = require("express");
const router = express.Router();

const { addStudent, getStudents } = require("../controllers/studentController");

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

// Only staff/admin can manage students
router.post("/", authenticateToken, authorizeRoles("admin", "staff"), addStudent);
router.get("/", authenticateToken, authorizeRoles("admin", "staff"), getStudents);

module.exports = router;