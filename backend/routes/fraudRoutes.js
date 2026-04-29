// routes/fraudRoutes.js

const express = require("express");
const router  = express.Router();

const {
  streamNotifications,
  getNotificationCount,
  flagFraud,
  getFraudFlags,
  resolveFraudFlag,
} = require("../controllers/fraudController");

const auth           = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/rolemiddleware");

/*
==================================
FRAUD ROUTES
==================================
*/

// ── Real-time SSE stream (no auth middleware — token verified inside handler) ──
// GET /api/fraud/notifications/stream?token=<jwt>
router.get("/notifications/stream", streamNotifications);

// ── Polling fallback: get pending flag count ──
// GET /api/fraud/notifications/count
router.get(
  "/notifications/count",
  auth,
  authorizeRoles("admin", "super_admin"),
  getNotificationCount
);

// ── Manual flag submission ──
// POST /api/fraud/flag
router.post("/flag", auth, flagFraud);

// ── Get all flags (for admin review tab) ──
// GET /api/fraud/flags
router.get(
  "/flags",
  auth,
  authorizeRoles("admin", "super_admin"),
  getFraudFlags
);

// ── Resolve a flag (revoke cert or dismiss) ──
// PATCH /api/fraud/flags/:id/resolve
router.patch(
  "/flags/:id/resolve",
  auth,
  authorizeRoles("admin", "super_admin"),
  resolveFraudFlag
);

module.exports = router;