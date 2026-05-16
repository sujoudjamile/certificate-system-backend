// routes/universityRoutes.js

const express = require("express");
const router = express.Router();

const { createUniversity,
        getAllUniversities,
 } = require("../controllers/universityController");

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { checkAllCerts } = require("../utils/certRenewal");

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


// Super admin can manually trigger cert renewal check
router.post(
  "/renew-certs",
  authenticateToken,
  authorizeRoles("super_admin"),
  async (req, res) => {
    try {
      const results = await checkAllCerts();
      res.json({ status: "success", results });
    } catch (err) {
      res.status(500).json({ status: "error", message: err.message });
    }
  }
);

// In your universities routes file
router.get("/", authenticateToken, authorizeRoles("super_admin"), getAllUniversities);

module.exports = router;