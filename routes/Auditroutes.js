// routes/auditRoutes.js

const express = require("express");
const router  = express.Router();

const {
  getAuditLogs,
  getAuditLogsByTarget,
  getAuditSummary,
} = require("../controllers/auditController");

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRoles    = require("../middleware/roleMiddleware");

/*
==================================
AUDIT LOG ROUTES
==================================
*/

// Get all audit logs with pagination and filters
// GET /api/audit
// GET /api/audit?action=LOGIN_FAILED&page=1&limit=20
// GET /api/audit?target_type=certificate&status=success
// GET /api/audit?from=2026-01-01&to=2026-12-31
router.get(
  "/",
  authenticateToken,
  authorizeRoles("super_admin", "admin"),
  getAuditLogs
);

// Get summary count per action — for dashboard
// GET /api/audit/summary
router.get(
  "/summary",
  authenticateToken,
  authorizeRoles("super_admin", "admin"),
  getAuditSummary
);

// Get logs for a specific record
// GET /api/audit/target/student/42
// GET /api/audit/target/certificate/10
router.get(
  "/target/:target_type/:target_id",
  authenticateToken,
  authorizeRoles("super_admin", "admin"),
  getAuditLogsByTarget
);

module.exports = router;