// routes/universityRoutes.js

const express = require("express");
const router = express.Router();

const { createUniversity } = require("../controllers/universityController");

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

/*
==================================
UNIVERSITY ROUTES
==================================
Only super_admin can create a university
*/
router.post(
  "/",
  authenticateToken,
  authorizeRoles("super_admin"),
  createUniversity
);

module.exports = router;