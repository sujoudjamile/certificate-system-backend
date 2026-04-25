// routes/staffRoutes.js

const express = require("express");
const router = express.Router();

const { addStaff ,
        getStaff,
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

module.exports = router;