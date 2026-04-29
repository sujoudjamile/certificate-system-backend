// utils/fraudDetection.js
// ─────────────────────────────────────────────────────────────────────────────
// Rule-based fraud detection engine.
// Runs automatically (fire-and-forget) after each certificate is committed.
// Inserts rows into fraud_flag and pushes SSE events to connected admins.
// ─────────────────────────────────────────────────────────────────────────────

const db = require("../config/db");

// ══════════════════════════════════════════════════════════════════════════════
// RULE DEFINITIONS
// Each rule exposes:
//   riskScore  – 0-100 severity number stored in fraud_flag.risk_score
//   check()    – async function returning { triggered, reason, [targetType, targetId] }
// ══════════════════════════════════════════════════════════════════════════════
const RULES = {

  // ── R-1 ──────────────────────────────────────────────────────────────────
  // Student already holds an active cert for the SAME degree+major
  // at a DIFFERENT university → strong signal of document cloning.
  DUPLICATE_CERT_CROSS_UNI: {
    riskScore: 90,
    label: "Cross-University Duplicate",
    async check({ certId, studentId, universityId, degree, major }) {
      const [rows] = await db.query(
        `SELECT c.id, u.name AS uni_name
         FROM certificates c
         JOIN universities u ON c.university_id = u.id
         WHERE c.student_id    = ?
           AND c.degree        = ?
           AND c.major         = ?
           AND c.status       != 'revoked'
           AND c.university_id != ?
           AND c.id            != ?`,
        [studentId, degree, major, universityId, certId]
      );
      if (rows.length > 0) {
        return {
          triggered: true,
          reason: `Student already has an active ${degree} in "${major}" at ${rows[0].uni_name}. ` +
                  `This may indicate a duplicate or fraudulent issuance.`,
        };
      }
      return { triggered: false };
    },
  },

  // ── R-2 ──────────────────────────────────────────────────────────────────
  // Student has ANOTHER active cert at the same degree level (any university).
  // Legitimate edge case: two Bachelor majors are allowed by the system,
  // but a second IDENTICAL degree+major is blocked upstream — this catches
  // any bypass or race condition.
  CONCURRENT_ACTIVE_CERTS: {
    riskScore: 88,
    label: "Concurrent Active Certificates",
    async check({ certId, studentId, degree }) {
      const [rows] = await db.query(
        `SELECT id FROM certificates
         WHERE student_id = ?
           AND degree     = ?
           AND status    != 'revoked'
           AND id        != ?`,
        [studentId, degree, certId]
      );
      if (rows.length > 0) {
        return {
          triggered: true,
          reason: `Student has ${rows.length} other active ${degree} certificate(s). ` +
                  `Concurrent issuance at the same degree level requires review.`,
        };
      }
      return { triggered: false };
    },
  },

  // ── R-3 ──────────────────────────────────────────────────────────────────
  // Graduation date is more than 30 days in the future.
  // Legitimate future dates (e.g. a graduation ceremony next month) are allowed
  // up to 30 days. Anything further is suspicious.
  PREMATURE_GRADUATION: {
    riskScore: 82,
    label: "Premature Graduation Date",
    async check({ graduationDate }) {
      const grad   = new Date(graduationDate);
      const today  = new Date();
      const diffDays = Math.round((grad - today) / (1000 * 60 * 60 * 24));
      if (diffDays > 30) {
        return {
          triggered: true,
          reason: `Graduation date (${graduationDate}) is ${diffDays} days in the future. ` +
                  `Certificates should not be issued far ahead of the actual graduation date.`,
        };
      }
      return { triggered: false };
    },
  },

  // ── R-4 ──────────────────────────────────────────────────────────────────
  // Student is statistically too young for their declared degree level.
  AGE_DEGREE_MISMATCH: {
    riskScore: 78,
    label: "Age / Degree Mismatch",
    async check({ studentId, degree }) {
      const [rows] = await db.query(
        "SELECT date_of_birth FROM students_new WHERE id = ?",
        [studentId]
      );
      if (rows.length === 0) return { triggered: false };

      const dob   = new Date(rows[0].date_of_birth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;

      const minAge = { Bachelor: 17, Master: 20, PhD: 23 };
      const threshold = minAge[degree] ?? 17;
      if (age < threshold) {
        return {
          triggered: true,
          reason: `Student is ${age} years old — below the minimum expected age of ` +
                  `${threshold} for a ${degree} degree.`,
        };
      }
      return { triggered: false };
    },
  },

  // ── R-5 ──────────────────────────────────────────────────────────────────
  // Same staff member issued ≥ 5 certificates within 60 minutes.
  // This flags both the certificate AND the staff member as targets.
  RAPID_STAFF_ISSUANCE: {
    riskScore: 75,
    label: "Rapid Staff Issuance",
    async check({ certId, createdBy }) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
        .toISOString().slice(0, 19).replace("T", " ");
      const [rows] = await db.query(
        `SELECT COUNT(*) AS cnt
         FROM certificates
         WHERE created_by = ?
           AND created_at >= ?`,
        [createdBy, oneHourAgo]
      );
      const cnt = Number(rows[0].cnt);
      if (cnt >= 5) {
        return {
          triggered: true,
          reason: `Staff member (ID ${createdBy}) has issued ${cnt} certificates in the last hour. ` +
                  `Bulk issuance at this rate is unusual and may indicate unauthorized activity.`,
          targetType: "staff",
          targetId:   createdBy,
        };
      }
      return { triggered: false };
    },
  },

  // ── R-6 ──────────────────────────────────────────────────────────────────
  // Degree earned less than 12 months after the preceding degree
  // at THE SAME university — unrealistically fast progression.
  ACCELERATED_PROGRESSION: {
    riskScore: 65,
    label: "Accelerated Degree Progression",
    async check({ certId, studentId, universityId, degree, graduationDate }) {
      if (degree === "Bachelor") return { triggered: false };
      const prevDegree = degree === "Master" ? "Bachelor" : "Master";

      const [rows] = await db.query(
        `SELECT graduation_date
         FROM certificates
         WHERE student_id    = ?
           AND degree        = ?
           AND university_id = ?
           AND status       != 'revoked'
           AND id           != ?
         ORDER BY graduation_date DESC
         LIMIT 1`,
        [studentId, prevDegree, universityId, certId]
      );
      if (rows.length === 0) return { triggered: false };

      const prevGrad    = new Date(rows[0].graduation_date);
      const currentGrad = new Date(graduationDate);
      const months      = Math.round((currentGrad - prevGrad) / (1000 * 60 * 60 * 24 * 30));

      if (months < 12) {
        return {
          triggered: true,
          reason: `${degree} issued only ${months} month(s) after ${prevDegree} ` +
                  `at the same university (minimum expected: 12 months).`,
        };
      }
      return { triggered: false };
    },
  },

  // ── R-7 ──────────────────────────────────────────────────────────────────
  // GPA outside plausible bounds, or a suspiciously perfect score on a PhD.
  GPA_ANOMALY: {
    riskScore: 55,
    label: "GPA Anomaly",
    async check({ GPA, degree }) {
      if (GPA === null || GPA === undefined || GPA === "") return { triggered: false };
      const gpa = parseFloat(GPA);
      if (isNaN(gpa)) return { triggered: false };

      if (gpa > 4.0) {
        return {
          triggered: true,
          reason: `Reported GPA of ${gpa} exceeds the maximum possible value of 4.0.`,
        };
      }
      if (gpa < 2.0) {
        return {
          triggered: true,
          reason: `Reported GPA of ${gpa} is below the standard graduation threshold of 2.0.`,
        };
      }
      if (gpa === 4.0 && degree === "PhD") {
        return {
          triggered: true,
          reason: `A perfect GPA of 4.0 on a PhD is statistically rare and warrants manual verification.`,
        };
      }
      return { triggered: false };
    },
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// ENGINE — run all rules and collect triggered flags
// ══════════════════════════════════════════════════════════════════════════════
const runFraudChecks = async ({
  certId,
  studentId,
  universityId,
  createdBy,
  degree,
  major,
  GPA,
  graduationDate,
}) => {
  const pendingFlags = [];

  for (const [ruleId, rule] of Object.entries(RULES)) {
    try {
      const result = await rule.check({
        certId, studentId, universityId, createdBy,
        degree, major, GPA, graduationDate,
      });

      if (result.triggered) {
        pendingFlags.push({
          certificate_id: certId,
          user_id:        null,                          // system-generated flag
          reason:         result.reason,
          source:         `AUTO:${ruleId}`,
          target_type:    result.targetType || "certificate",
          target_id:      result.targetId   ?? null,
          risk_score:     rule.riskScore,
        });

        console.log(`[FraudEngine] ⚠  Rule ${ruleId} triggered for cert ${certId} (risk ${rule.riskScore})`);
      }
    } catch (err) {
      console.error(`[FraudEngine] Rule ${ruleId} check error:`, err.message);
    }
  }

  return pendingFlags;
};

// ══════════════════════════════════════════════════════════════════════════════
// PERSIST — write flags to DB and push SSE notifications
// ══════════════════════════════════════════════════════════════════════════════
const applyFraudFlags = async (flags, universityId) => {
  if (flags.length === 0) return [];

  const inserted = [];

  for (const flag of flags) {
    try {
      const [result] = await db.query(
        `INSERT INTO fraud_flag
           (certificate_id, user_id, reason, source, target_type, risk_score, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [
          flag.certificate_id,
          flag.user_id,
          flag.reason,
          flag.source,
          flag.target_type,
          flag.risk_score,
        ]
      );
      inserted.push({ ...flag, id: result.insertId });
    } catch (err) {
      console.error("[FraudEngine] DB insert error:", err.message);
    }
  }

  if (inserted.length > 0) {
    console.log(`[FraudEngine] ✅ Persisted ${inserted.length} flag(s) for university ${universityId}`);
    _notifyAdmins(universityId, inserted);
  }

  return inserted;
};

// ══════════════════════════════════════════════════════════════════════════════
// SSE CLIENT STORE — maps universityId → Set<res>
// ══════════════════════════════════════════════════════════════════════════════
const _sseClients = new Map(); // Map<universityId, Set<express.Response>>

/**
 * Register an SSE response object for a university admin.
 * Call this when the admin connects to /api/fraud/notifications/stream.
 */
const registerSSEClient = (universityId, res) => {
  if (!_sseClients.has(universityId)) {
    _sseClients.set(universityId, new Set());
  }
  _sseClients.get(universityId).add(res);
  console.log(`[FraudEngine] SSE: admin for uni ${universityId} connected (${_sseClients.get(universityId).size} total)`);
};

/**
 * Unregister an SSE response (called when admin disconnects).
 */
const unregisterSSEClient = (universityId, res) => {
  _sseClients.get(universityId)?.delete(res);
  console.log(`[FraudEngine] SSE: admin for uni ${universityId} disconnected`);
};

/**
 * Push a FRAUD_ALERT event to all admins of the given university.
 */
const _notifyAdmins = (universityId, flags) => {
  // Notify the university's own admins
  _pushToUniversity(universityId, flags);
  // Also notify super_admin (universityId = null stored as key 0)
  _pushToUniversity(0, flags);
};

const _pushToUniversity = (uniKey, flags) => {
  const clients = _sseClients.get(uniKey);
  if (!clients || clients.size === 0) return;

  const payload = JSON.stringify({
    type:  "FRAUD_ALERT",
    count: flags.length,
    flags: flags.map(f => ({
      id:          f.id,
      cert_id:     f.certificate_id,
      reason:      f.reason,
      source:      f.source,
      target_type: f.target_type,
      risk_score:  f.risk_score,
    })),
    timestamp: new Date().toISOString(),
  });

  const dead = [];
  clients.forEach(client => {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      dead.push(client); // connection dropped
    }
  });
  dead.forEach(c => clients.delete(c));
};

// Export rule metadata so the frontend can display human-readable labels
const RULE_LABELS = Object.fromEntries(
  Object.entries(RULES).map(([id, r]) => [id, r.label])
);

module.exports = {
  runFraudChecks,
  applyFraudFlags,
  registerSSEClient,
  unregisterSSEClient,
  RULE_LABELS,
};