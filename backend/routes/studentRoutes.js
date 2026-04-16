const express = require("express");
const router = express.Router();

const { 
  addStudent,
  getStudentByNationalId   // ✅ ADD THIS
} = require("../controllers/studentController");

const authenticateToken = require("../middleware/authMiddleware");

/*
==================================
ADD STUDENT
==================================
*/
router.post("/", authenticateToken, addStudent);

/*
==================================
AUTO-FILL (GET STUDENT BY NATIONAL ID)
==================================
*/
router.get("/by-national-id/:national_id", getStudentByNationalId);

module.exports = router;