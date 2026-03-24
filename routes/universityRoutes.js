
const express = require("express");
const router = express.Router();

// Import controller
const { createUniversity } = require("../controllers/universityController");

// Import middlewares
const authenticateToken = require("../middleware/authmiddleware");
const authorizeRoles = require("../middleware/rolemiddleware");

/*
  Only super_admin can create university
*/
router.post(
  "/",
  authenticateToken,          // 1️⃣ First check if logged in
  authorizeRoles("super_admin"), // 2️⃣ Then check role
  createUniversity            // 3️⃣ Then run controller
);

module.exports = router;