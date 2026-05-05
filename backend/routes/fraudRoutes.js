// routes/fraudRoutes.js
// ============================================================
// FRAUD DETECTION ROUTES
// ============================================================
// FILE LOCATION: routes/fraudRoutes.js
//
// After creating this file, register it in your main app.js
// or index.js like this:
//
//   const fraudRoutes = require("./routes/fraudRoutes");
//   app.use("/api/fraud", fraudRoutes);
//
// All routes here require authentication + admin or super_admin role.
// ============================================================

const express        = require("express");
const router         = express.Router();
const authenticate   = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const {
  getFraudFlags,
  getFraudByCertificate,
  dismissFlag,
  resolveFlag,
  getFraudStats,
} = require("../controllers/fraudController");

// ── Apply authentication to ALL fraud routes ──
// Every route in this file requires a valid JWT token.
router.use(authenticate);

// ── Apply role restriction to ALL fraud routes ──
// Only admins and super_admins can access fraud data.
// Staff members cannot see or act on fraud flags.
router.use(authorizeRoles("super_admin", "admin"));

// ─────────────────────────────────────────────────────────────
// GET /api/fraud
// ─────────────────────────────────────────────────────────────
// Returns paginated list of fraud flags.
// Super admins: all universities.
// Admins: their university only.
//
// Query params: status, source, min_risk, from, to, page, limit
// ─────────────────────────────────────────────────────────────
router.get("/", getFraudFlags);

// ─────────────────────────────────────────────────────────────
// GET /api/fraud/stats
// ─────────────────────────────────────────────────────────────
// Returns aggregated fraud statistics for the dashboard widget.
// Includes: status breakdown, rule breakdown, top suspects,
// 30-day daily trend, and pending risk total.
// ─────────────────────────────────────────────────────────────
router.get("/stats", getFraudStats);

// ─────────────────────────────────────────────────────────────
// GET /api/fraud/certificate/:id
// ─────────────────────────────────────────────────────────────
// Returns all fraud flags for a specific certificate,
// plus aggregated risk summary and full certificate details.
// :id is the certificate ID (not the fraud_flag ID).
// ─────────────────────────────────────────────────────────────
router.get("/certificate/:id", getFraudByCertificate);

// ─────────────────────────────────────────────────────────────
// PATCH /api/fraud/:id/dismiss
// ─────────────────────────────────────────────────────────────
// Marks a specific fraud flag as a false positive.
// Certificate is NOT affected — it stays valid.
// Body: { review_note: "Optional explanation" }
// :id is the fraud_flag.id
// ─────────────────────────────────────────────────────────────
router.patch("/:id/dismiss", dismissFlag);

// ─────────────────────────────────────────────────────────────
// PATCH /api/fraud/:id/resolve
// ─────────────────────────────────────────────────────────────
// Confirms fraud. Revokes the certificate AND marks the flag
// (and all other pending flags on the same cert) as resolved.
// This action is irreversible through the API.
// Body: { review_note: "Required — explain the confirmed fraud" }
// :id is the fraud_flag.id
// ─────────────────────────────────────────────────────────────
router.patch("/:id/resolve", resolveFlag);

module.exports = router;