// controllers/fraudController.js
// ============================================================
// FRAUD CONTROLLER
// ============================================================
// Provides all API endpoints for admins and super_admins to:
//   - View fraud flags (with filtering and pagination)
//   - View the full fraud summary for one certificate
//   - Dismiss a flag (false positive)
//   - Resolve a flag (confirmed fraud → revoke certificate)
//   - Get fraud statistics for the dashboard
//
// ROUTE SETUP (add to your routes file):
//   router.get   ("/fraud",                   authenticate, authorizeRoles("super_admin","admin"), getFraudFlags)
//   router.get   ("/fraud/stats",             authenticate, authorizeRoles("super_admin","admin"), getFraudStats)
//   router.get   ("/fraud/certificate/:id",   authenticate, authorizeRoles("super_admin","admin"), getFraudByCertificate)
//   router.patch ("/fraud/:id/dismiss",       authenticate, authorizeRoles("super_admin","admin"), dismissFlag)
//   router.patch ("/fraud/:id/resolve",       authenticate, authorizeRoles("super_admin","admin"), resolveFlag)
// ============================================================

const db           = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const AppError     = require("../utils/AppError");
const logAction    = require("../utils/auditLog");

// ─────────────────────────────────────────────────────────────
// GET FRAUD FLAGS
// ─────────────────────────────────────────────────────────────
// Returns all fraud flags with full context about the
// certificate, the student, the staff member who issued it,
// and which rule fired.
//
// Super admins see ALL flags across all universities.
// Admins see ONLY flags from their own university.
//
// Query parameters:
//   status      : "pending" | "reviewed" | "resolved" | "dismissed"
//   source      : e.g. "RULE_VELOCITY" — filter by rule name
//   min_risk    : number — only return flags with risk_score >= this
//   from        : date string — flags created after this date
//   to          : date string — flags created before this date
//   page        : number (default 1)
//   limit       : number (default 20, max 100)
// ─────────────────────────────────────────────────────────────
const getFraudFlags = asyncHandler(async (req, res) => {
  const { role, university_id } = req.user;
  const { status, source, min_risk, from, to } = req.query;

  // Pagination setup
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(100, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  // ── Base query ──
  // We join everything needed to give the admin full context
  // without needing additional API calls from the frontend.
  let query = `
    SELECT
      ff.id                AS flag_id,
      ff.status            AS flag_status,
      ff.source            AS rule_name,
      ff.reason,
      ff.risk_score,
      ff.flagged_at,
      ff.resolved_at,
      ff.review_note,

      -- Certificate info
      c.id                 AS certificate_id,
      c.cert_number,
      c.degree,
      c.major,
      c.GPA,
      c.graduation_date,
      c.status             AS cert_status,
      c.created_at         AS cert_issued_at,

      -- Student info
      sn.full_name         AS student_name,
      sn.national_id,

      -- University info
      u.name               AS university_name,

      -- Staff who issued the cert (the suspected person)
      staff.name           AS issued_by_name,
      staff.email          AS issued_by_email,

      -- Admin who reviewed the flag (may be null if still pending)
      reviewer.name        AS reviewed_by_name

    FROM fraud_flag ff
    JOIN certificates  c        ON ff.certificate_id = c.id
    JOIN students_new  sn       ON c.student_id       = sn.id
    JOIN universities  u        ON c.university_id    = u.id
    LEFT JOIN users    staff    ON ff.user_id          = staff.id
    LEFT JOIN users    reviewer ON ff.reviewed_by      = reviewer.id
  `;

  const conditions = [];
  const values     = [];

  // ── Scope by university for non-super-admins ──
  if (role === "admin") {
    conditions.push("c.university_id = ?");
    values.push(university_id);
  }

  // ── Optional filters ──
  if (status) {
    conditions.push("ff.status = ?");
    values.push(status.toLowerCase());
  }

  if (source) {
    conditions.push("ff.source = ?");
    values.push(source.toUpperCase());
  }

  if (min_risk) {
    conditions.push("ff.risk_score >= ?");
    values.push(parseFloat(min_risk));
  }

  if (from) {
    conditions.push("ff.flagged_at >= ?");
    values.push(from);
  }

  if (to) {
    conditions.push("ff.flagged_at <= ?");
    values.push(to + " 23:59:59");
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  // ── Count total for pagination ──
  const countQuery =
    `SELECT COUNT(*) AS total FROM fraud_flag ff
     JOIN certificates c ON ff.certificate_id = c.id` +
    (conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "");

  const [countResult] = await db.query(countQuery, values);
  const total = countResult[0].total;

  // ── Ordering and pagination ──
  // Show highest-risk pending flags first
  query += " ORDER BY ff.status ASC, ff.risk_score DESC, ff.flagged_at DESC LIMIT ? OFFSET ?";
  values.push(limit, offset);

  const [flags] = await db.query(query, values);

  return res.json({
    status:      "success",
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
    flags,
  });
});

// ─────────────────────────────────────────────────────────────
// GET FRAUD FLAGS FOR A SINGLE CERTIFICATE
// ─────────────────────────────────────────────────────────────
// Returns all fraud flags for one certificate, plus an
// aggregated risk summary. Useful for the certificate
// detail page in the admin dashboard.
//
// Also returns the full certificate and student data so the
// admin can make a review decision without switching screens.
// ─────────────────────────────────────────────────────────────
const getFraudByCertificate = asyncHandler(async (req, res) => {
  const { id }                  = req.params; // certificate id
  const { role, university_id } = req.user;

  // ── Verify the certificate exists and the admin can see it ──
  const [certRows] = await db.query(
    `SELECT c.*, sn.full_name AS student_name, sn.national_id,
            u.name AS university_name
     FROM certificates c
     JOIN students_new sn ON c.student_id    = sn.id
     JOIN universities u  ON c.university_id = u.id
     WHERE c.id = ?`,
    [id]
  );

  if (certRows.length === 0) throw new AppError("Certificate not found", 404);

  const cert = certRows[0];

  if (role === "admin" && cert.university_id !== university_id) {
    throw new AppError("Access forbidden", 403);
  }

  // ── Get all flags for this certificate ──
  const [flags] = await db.query(
    `SELECT
       ff.id, ff.source, ff.reason, ff.risk_score,
       ff.status, ff.review_note, ff.flagged_at, ff.resolved_at,
       reviewer.name AS reviewed_by_name
     FROM fraud_flag ff
     LEFT JOIN users reviewer ON ff.reviewed_by = reviewer.id
     WHERE ff.certificate_id = ?
     ORDER BY ff.risk_score DESC`,
    [id]
  );

  // ── Calculate aggregated risk ──
  const totalRisk    = flags.reduce((sum, f) => sum + parseFloat(f.risk_score), 0);
  const pendingCount = flags.filter((f) => f.status === "pending").length;
  const rulesFired   = flags.map((f) => f.source);

  return res.json({
    status: "success",
    certificate: {
      id:              cert.id,
      cert_number:     cert.cert_number,
      student_name:    cert.student_name,
      national_id:     cert.national_id,
      university_name: cert.university_name,
      degree:          cert.degree,
      major:           cert.major,
      GPA:             cert.GPA,
      graduation_date: cert.graduation_date,
      cert_status:     cert.status,
      issued_at:       cert.created_at,
    },
    fraud_summary: {
      total_flags:    flags.length,
      pending_flags:  pendingCount,
      total_risk,
      risk_level:     totalRisk >= 150 ? "critical"
                    : totalRisk >= 100 ? "high"
                    : totalRisk >= 60  ? "medium"
                    : "low",
      rules_fired:    rulesFired,
    },
    flags,
  });
});

// ─────────────────────────────────────────────────────────────
// DISMISS A FLAG (FALSE POSITIVE)
// ─────────────────────────────────────────────────────────────
// Admin reviewed this flag and decided it is NOT fraud.
// The flag is marked "dismissed" with an optional note.
// The certificate is NOT affected — it remains valid.
//
// Body: { review_note: "Explanation why this is a false positive" }
// ─────────────────────────────────────────────────────────────
const dismissFlag = asyncHandler(async (req, res) => {
  const { id }                  = req.params; // fraud_flag id
  const { review_note }         = req.body;
  const { role, university_id, id: adminId } = req.user;

  // ── Fetch the flag ──
  const [flagRows] = await db.query(
    `SELECT ff.*, c.university_id AS cert_university_id
     FROM fraud_flag ff
     JOIN certificates c ON ff.certificate_id = c.id
     WHERE ff.id = ?`,
    [id]
  );

  if (flagRows.length === 0) throw new AppError("Fraud flag not found", 404);

  const flag = flagRows[0];

  // ── Enforce university scope for admins ──
  if (role === "admin" && flag.cert_university_id !== university_id) {
    throw new AppError("Access forbidden", 403);
  }

  // ── Can only dismiss a pending or reviewed flag ──
  if (flag.status === "dismissed") {
    throw new AppError("This flag is already dismissed", 400);
  }

  if (flag.status === "resolved") {
    throw new AppError("Cannot dismiss a resolved flag. It has already been acted upon.", 400);
  }

  // ── Update the flag ──
  await db.query(
    `UPDATE fraud_flag
     SET status      = 'dismissed',
         reviewed_by  = ?,
         review_note  = ?,
         resolved_at  = NOW()
     WHERE id = ?`,
    [adminId, review_note || null, id]
  );

  // ── Log this action in the audit trail ──
  await logAction({
    user_id:        adminId,
    university_id,
    action:         "DISMISS_FRAUD_FLAG",
    description:    `Dismissed fraud flag ID ${id} for certificate ID ${flag.certificate_id}. Rule: ${flag.source}. Note: ${review_note || "none"}`,
    status:         "success",
    target_type:    "certificate",
    target_id:      flag.certificate_id,
    certificate_id: flag.certificate_id,
    ip_address:     req.ip,
  });

  return res.json({
    status:  "success",
    message: "Fraud flag dismissed. Certificate remains valid.",
  });
});

// ─────────────────────────────────────────────────────────────
// RESOLVE A FLAG (CONFIRMED FRAUD → REVOKE CERTIFICATE)
// ─────────────────────────────────────────────────────────────
// Admin reviewed this flag and confirmed fraud.
// This does two things atomically:
//   1. Marks the fraud flag as "resolved"
//   2. Revokes the associated certificate
//
// This is a destructive, irreversible action. Once a cert
// is revoked and the flag is resolved, it cannot be undone
// through the API (a super_admin DB intervention is needed).
//
// Body: { review_note: "Explanation of why this is confirmed fraud" }
// ─────────────────────────────────────────────────────────────
const resolveFlag = asyncHandler(async (req, res) => {
  const { id }                  = req.params; // fraud_flag id
  const { review_note }         = req.body;
  const { role, university_id, id: adminId } = req.user;

  // ── Fetch the flag and the associated certificate ──
  const [flagRows] = await db.query(
    `SELECT ff.*, c.university_id AS cert_university_id, c.status AS cert_status
     FROM fraud_flag ff
     JOIN certificates c ON ff.certificate_id = c.id
     WHERE ff.id = ?`,
    [id]
  );

  if (flagRows.length === 0) throw new AppError("Fraud flag not found", 404);

  const flag = flagRows[0];

  // ── Enforce university scope for admins ──
  if (role === "admin" && flag.cert_university_id !== university_id) {
    throw new AppError("Access forbidden", 403);
  }

  // ── Can only resolve a pending or reviewed flag ──
  if (flag.status === "resolved") {
    throw new AppError("This flag is already resolved", 400);
  }

  if (flag.status === "dismissed") {
    throw new AppError("Cannot resolve a dismissed flag. It was previously marked as a false positive.", 400);
  }

  // ── Check if the certificate is already revoked ──
  if (flag.cert_status === "revoked") {
    // Certificate already revoked (possibly by another path)
    // Just update the flag status
    await db.query(
      `UPDATE fraud_flag
       SET status      = 'resolved',
           reviewed_by  = ?,
           review_note  = ?,
           resolved_at  = NOW()
       WHERE id = ?`,
      [adminId, review_note || null, id]
    );

    return res.json({
      status:  "success",
      message: "Fraud flag resolved. Certificate was already revoked.",
    });
  }

  // ── Use a transaction: resolve flag + revoke certificate atomically ──
  // If either fails, both roll back. This prevents a flag being marked
  // resolved while the certificate stays valid (or vice versa).
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Step 1: Revoke the certificate
    // Note: The DB trigger `prevent_locked_certificate_update` blocks
    // updates on locked certs. We need to set status directly.
    // If your trigger blocks this, see the SQL migration file
    // for the updated trigger that allows revocation.
    await connection.query(
      "UPDATE certificates SET status = 'revoked' WHERE id = ?",
      [flag.certificate_id]
    );

    // Step 2: Mark this flag as resolved
    await connection.query(
      `UPDATE fraud_flag
       SET status      = 'resolved',
           reviewed_by  = ?,
           review_note  = ?,
           resolved_at  = NOW()
       WHERE id = ?`,
      [adminId, review_note || null, id]
    );

    // Step 3: Also mark all OTHER pending flags for this cert as resolved
    // so admins don't have to dismiss each one individually
    await connection.query(
      `UPDATE fraud_flag
       SET status      = 'resolved',
           reviewed_by  = ?,
           review_note  = 'Auto-resolved: certificate was revoked due to confirmed fraud on another flag.',
           resolved_at  = NOW()
       WHERE certificate_id = ?
         AND id != ?
         AND status = 'pending'`,
      [adminId, flag.certificate_id, id]
    );

    await connection.commit();

    // ── Audit log ──
    await logAction({
      user_id:        adminId,
      university_id:  flag.cert_university_id,
      action:         "RESOLVE_FRAUD_FLAG",
      description:    `Resolved fraud flag ID ${id}. Certificate ID ${flag.certificate_id} has been REVOKED. Rule: ${flag.source}. Note: ${review_note || "none"}`,
      status:         "success",
      target_type:    "certificate",
      target_id:      flag.certificate_id,
      certificate_id: flag.certificate_id,
      ip_address:     req.ip,
    });

    return res.json({
      status:  "success",
      message: "Fraud confirmed. Certificate has been revoked and all related flags resolved.",
    });

  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

// ─────────────────────────────────────────────────────────────
// GET FRAUD STATISTICS
// ─────────────────────────────────────────────────────────────
// Returns aggregated stats for the fraud dashboard widget.
// Answers questions like:
//   - How many unreviewed flags do I have?
//   - Which rule fires most often?
//   - Which staff member has the most flags?
//   - What is the combined risk exposure?
//
// Super admins see global stats.
// Admins see only their university's stats.
// ─────────────────────────────────────────────────────────────
const getFraudStats = asyncHandler(async (req, res) => {
  const { role, university_id } = req.user;

  // Build the university scope condition once and reuse it
  const scopeJoin      = role === "admin"
    ? "JOIN certificates c ON ff.certificate_id = c.id"
    : "JOIN certificates c ON ff.certificate_id = c.id";

  const scopeCondition = role === "admin"
    ? "WHERE c.university_id = ?"
    : "";

  const scopeValues = role === "admin" ? [university_id] : [];

  // ── 1. Status breakdown (how many in each state) ──
  const [statusBreakdown] = await db.query(
    `SELECT ff.status, COUNT(*) AS count
     FROM fraud_flag ff
     ${scopeJoin}
     ${scopeCondition}
     GROUP BY ff.status`,
    scopeValues
  );

  // ── 2. Most-triggered rules ──
  const [ruleBreakdown] = await db.query(
    `SELECT ff.source, COUNT(*) AS count, AVG(ff.risk_score) AS avg_risk
     FROM fraud_flag ff
     ${scopeJoin}
     ${scopeCondition}
     GROUP BY ff.source
     ORDER BY count DESC`,
    scopeValues
  );

  // ── 3. Staff members with the most flags (suspects) ──
  const [staffBreakdown] = await db.query(
    `SELECT
       u.id, u.name, u.email,
       COUNT(ff.id)          AS flag_count,
       SUM(ff.risk_score)    AS total_risk,
       COUNT(DISTINCT ff.certificate_id) AS certs_flagged
     FROM fraud_flag ff
     ${scopeJoin}
     LEFT JOIN users u ON ff.user_id = u.id
     ${scopeCondition}
     GROUP BY u.id, u.name, u.email
     ORDER BY total_risk DESC
     LIMIT 10`,
    scopeValues
  );

  // ── 4. Trend: flags per day for the last 30 days ──
  const [trendData] = await db.query(
    `SELECT
       DATE(ff.flagged_at) AS flag_date,
       COUNT(*)            AS count,
       SUM(ff.risk_score)  AS daily_risk
     FROM fraud_flag ff
     ${scopeJoin}
     ${scopeCondition ? scopeCondition + " AND" : "WHERE"} ff.flagged_at >= NOW() - INTERVAL 30 DAY
     GROUP BY DATE(ff.flagged_at)
     ORDER BY flag_date ASC`,
    scopeValues
  );

  // ── 5. Total pending risk (how urgent is the backlog?) ──
  const [riskTotal] = await db.query(
    `SELECT
       COUNT(*)         AS pending_flags,
       SUM(risk_score)  AS total_pending_risk
     FROM fraud_flag ff
     ${scopeJoin}
     ${scopeCondition ? scopeCondition + " AND" : "WHERE"} ff.status = 'pending'`,
    scopeValues
  );

  return res.json({
    status: "success",
    stats: {
      status_breakdown: statusBreakdown,
      rule_breakdown:   ruleBreakdown,
      top_suspects:     staffBreakdown,
      daily_trend:      trendData,
      pending_summary:  riskTotal[0],
    },
  });
});

module.exports = {
  getFraudFlags,
  getFraudByCertificate,
  dismissFlag,
  resolveFlag,
  getFraudStats,
};