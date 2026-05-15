// routes/staffRoutes.js
const express = require("express");
const router = express.Router();

const { addStaff, getStaff } = require("../controllers/staffController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

// Route to add staff
router.post("/", authenticateToken, authorizeRoles("admin"), addStaff);

// Route to get/search staff
router.get("/staffs", authenticateToken, authorizeRoles("admin"), getStaff);

module.exports = router;