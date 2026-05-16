// routes/staffRoutes.js

const express = require("express");
const router = express.Router();

const { addStaff ,
        getStaff,
        toggleStaffStatus,
} = require("../controllers/staffController");

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

//Get staff information
router.get(
  "/staffs",
  authenticateToken,
  authorizeRoles("admin"),
  getStaff
);
router.patch("/:id/toggle-status", authenticateToken, authorizeRoles("admin"), toggleStaffStatus);

module.exports = router;