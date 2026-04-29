// controllers/fraudController.js

const db = require("../config/db");
const jwt = require("jsonwebtoken");
const {
  registerSSEClient,
  unregisterSSEClient,
  RULE_LABELS,
} = require("../utils/fraudDetection");

// ══════════════════════════════════════════════════════════════════════════════
// SSE — Real-time notification stream
// GET /api/fraud/notifications/stream?token=<jwt>
//
// Browser EventSource cannot send custom headers, so the JWT is passed
// as a query parameter and verified here.
// ══════════════════════════════════════════════════════════════════════════════
const streamNotifications = (req, res) => {
  // ── Verify token from query param ──
  const token = req.query.token;
  if (!token) {
    res.status(401).json({ message: "Token required" });
    return;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    res.status(403).json({ message: "Invalid or expired token" });
    return;
  }

  const { role, university_id } = decoded;
  if (!["admin", "super_admin"].includes(role)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  // ── Set SSE headers ──
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable Nginx buffering if present
  res.flushHeaders();

  // Use university_id = 0 as key for super_admin (sees all)
  const uniKey = role === "super_admin" ? 0 : university_id;

  // Send an initial "connected" heartbeat
  res.write(`data: ${JSON.stringify({ type: "connected", role, university_id })}\n\n`);

  registerSSEClient(uniKey, res);

  // Keep-alive ping every 25 seconds to prevent proxy timeouts
  const keepAlive = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { /* disconnected */ }
  }, 25000);

  // Clean up on disconnect
  req.on("close", () => {
    clearInterval(keepAlive);
    unregisterSSEClient(uniKey, res);
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// GET NOTIFICATION COUNT
// GET /api/fraud/notifications/count
// Returns count of pending fraud flags for the admin's university.
// Used by the admin frontend on mount and for polling fallback.
// ══════════════════════════════════════════════════════════════════════════════
const getNotificationCount = async (req, res) => {
  try {
    const { role, university_id } = req.user;

    let query  = `SELECT COUNT(*) AS cnt FROM fraud_flag ff
                  JOIN certificates c ON ff.certificate_id = c.id
                  WHERE ff.status = 'pending'`;
    const params = [];

    if (role !== "super_admin") {
      query += " AND c.university_id = ?";
      params.push(university_id);
    }

    const [rows] = await db.query(query, params);
    res.json({ status: "success", count: Number(rows[0].cnt) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// FLAG CERTIFICATE (manual — by staff/admin)
// POST /api/fraud/flag
// ══════════════════════════════════════════════════════════════════════════════
const flagFraud = async (req, res) => {
  try {
    const { certificate_id, reason, risk_score } = req.body;
    const userId = req.user.id;

    if (!certificate_id || !reason) {
      return res.status(400).json({ message: "Certificate and reason are required" });
    }

    const [cert] = await db.query(
      "SELECT * FROM certificates WHERE id = ?", [certificate_id]
    );
    if (cert.length === 0)
      return res.status(404).json({ message: "Certificate not found" });

    const [existing] = await db.query(
      "SELECT * FROM fraud_flag WHERE certificate_id = ? AND status = 'pending'",
      [certificate_id]
    );
    if (existing.length > 0)
      return res.status(400).json({ message: "This certificate is already flagged" });

    await db.query(
      `INSERT INTO fraud_flag
         (certificate_id, user_id, reason, source, target_type, risk_score)
       VALUES (?, ?, ?, 'MANUAL', 'certificate', ?)`,
      [certificate_id, userId, reason, risk_score || 50]
    );

    res.json({ message: "🚨 Certificate flagged successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET ALL FRAUD FLAGS
// GET /api/fraud/flags
// Returns enriched flag list with rule labels and source type.
// ══════════════════════════════════════════════════════════════════════════════
const getFraudFlags = async (req, res) => {
  try {
    const { university_id, role } = req.user;

    let query = `
      SELECT
        ff.id,
        ff.reason,
        ff.risk_score,
        ff.status,
        ff.source,
        ff.target_type,
        ff.flagged_at,
        ff.review_note,
        c.id               AS cert_id,
        c.cert_number,
        c.degree,
        c.major,
        c.GPA,
        c.graduation_date,
        c.status           AS cert_status,
        sn.full_name       AS student_name,
        sn.national_id,
        u.name             AS university_name,
        reporter.name      AS flagged_by_name,
        reviewer.name      AS reviewed_by_name
      FROM fraud_flag ff
      JOIN certificates  c        ON ff.certificate_id = c.id
      JOIN students_new  sn       ON c.student_id       = sn.id
      JOIN universities  u        ON c.university_id    = u.id
      LEFT JOIN users    reporter ON ff.user_id          = reporter.id
      LEFT JOIN users    reviewer ON ff.reviewed_by      = reviewer.id
    `;

    const params = [];
    if (role !== "super_admin") {
      query += " WHERE c.university_id = ?";
      params.push(university_id);
    }
    query += " ORDER BY ff.flagged_at DESC";

    const [flags] = await db.query(query, params);

    // Enrich each flag with a human-readable rule label
    const enriched = flags.map(f => {
      const ruleId = f.source?.startsWith("AUTO:") ? f.source.replace("AUTO:", "") : null;
      return {
        ...f,
        rule_label:    ruleId ? (RULE_LABELS[ruleId] ?? ruleId) : "Manual Report",
        is_auto_flag:  f.source?.startsWith("AUTO:") ?? false,
      };
    });

    res.json({ status: "success", flags: enriched });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// RESOLVE FRAUD FLAG
// PATCH /api/fraud/flags/:id/resolve
// action = "revoke" | "dismiss"
// ══════════════════════════════════════════════════════════════════════════════
const resolveFraudFlag = async (req, res) => {
  try {
    const { id }    = req.params;
    const { action, review_note } = req.body;

    if (!["revoke", "dismiss"].includes(action))
      return res.status(400).json({ message: "action must be 'revoke' or 'dismiss'" });

    const [flags] = await db.query("SELECT * FROM fraud_flag WHERE id = ?", [id]);
    if (flags.length === 0)
      return res.status(404).json({ message: "Flag not found" });

    const flag = flags[0];
    if (flag.status !== "pending")
      return res.status(400).json({ message: "This flag has already been resolved" });

    if (action === "revoke") {
      const [certRows] = await db.query(
        "SELECT id, status FROM certificates WHERE id = ?", [flag.certificate_id]
      );
      if (certRows.length === 0)
        return res.status(404).json({ message: "Certificate not found" });
      if (certRows[0].status === "revoked")
        return res.status(400).json({ message: "Certificate is already revoked" });

      await db.query(
        "UPDATE certificates SET status = 'revoked' WHERE id = ?",
        [flag.certificate_id]
      );
    }

    await db.query(
      `UPDATE fraud_flag
         SET status = ?, review_note = ?, reviewed_by = ?, resolved_at = NOW()
       WHERE id = ?`,
      [
        action === "revoke" ? "resolved" : "dismissed",
        review_note || null,
        req.user.id,
        id,
      ]
    );

    res.json({
      status:  "success",
      message: action === "revoke"
        ? "Certificate revoked and fraud flag resolved."
        : "Flag dismissed. Certificate remains active.",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  streamNotifications,
  getNotificationCount,
  flagFraud,
  getFraudFlags,
  resolveFraudFlag,
};