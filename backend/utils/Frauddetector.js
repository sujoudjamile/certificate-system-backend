// utils/fraudDetector.js
// ============================================================
// FRAUD DETECTION ENGINE
// ============================================================
// This file is the brain of the fraud detection system.
// It runs rule-based checks every time a certificate is issued.
//
// HOW IT WORKS:
//   1. certificationController.js calls runFraudChecks() after
//      a certificate is successfully inserted into the DB.
//   2. Each rule runs its own DB query independently.
//   3. If a rule fires, it inserts a row into fraud_flag.
//   4. Fraud flags start as "pending" — admins review them
//      in the dashboard via fraudController.js endpoints.
//
// ADDING A NEW RULE:
//   - Write an async function that receives (certData, connection)
//   - Return { fired: true, reason, riskScore } or { fired: false }
//   - Add it to the RULES array at the bottom of this file.
// ============================================================

const db = require("../config/db");

// ─────────────────────────────────────────────────────────────
// RISK SCORE CONSTANTS
// These weights reflect how serious each rule violation is.
// Scores are intentionally distinct so combined totals are
// meaningful when an admin sorts by total_risk.
// ─────────────────────────────────────────────────────────────
const RISK = {
  VELOCITY:              70,
  CROSS_UNI_DUPLICATE:   90,
  SUSPICIOUS_DATE:       60,
  GPA_OUTLIER:           50,
  EDIT_BEFORE_ISSUE:     85,
  REVOKE_REISSUE:        75,
  OFF_HOURS:             40,
  NEW_ACCOUNT_ISSUE:     65,
};

// ─────────────────────────────────────────────────────────────
// RULE 1 — VELOCITY CHECK
// ─────────────────────────────────────────────────────────────
// Fires when the same staff member issues too many certificates
// within a short rolling time window.
//
// Why this matters:
//   A normal staff member processes a few certs per day.
//   10+ in one hour suggests either a compromised account
//   being used in bulk, or an insider abusing access.
//
// Threshold: 10 certificates within 60 minutes by same user.
// ─────────────────────────────────────────────────────────────
const checkVelocity = async (certData) => {
  const THRESHOLD  = 10;   // max certs allowed in window
  const WINDOW_MIN = 60;   // rolling window in minutes

  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt
     FROM certificates
     WHERE created_by = ?
       AND created_at >= NOW() - INTERVAL ? MINUTE
       AND id != ?`,          // exclude the cert just issued
    [certData.created_by, WINDOW_MIN, certData.cert_id]
  );

  const count = rows[0].cnt;

  if (count >= THRESHOLD) {
    return {
      fired:     true,
      source:    "RULE_VELOCITY",
      reason:    `Staff member (user ID ${certData.created_by}) issued ${count + 1} certificates within ${WINDOW_MIN} minutes. Threshold is ${THRESHOLD}.`,
      riskScore: RISK.VELOCITY,
    };
  }

  return { fired: false };
};

// ─────────────────────────────────────────────────────────────
// RULE 2 — CROSS-UNIVERSITY DUPLICATE
// ─────────────────────────────────────────────────────────────
// Fires when the same student (matched by national_id) has
// received a certificate for the SAME degree + major at a
// DIFFERENT university.
//
// Why this matters:
//   Your per-university duplicate check already exists in
//   issueCertificate(). But nothing stops two different
//   universities from both issuing a Bachelor in CS to the
//   same person. That is suspicious and likely fraudulent.
//
// Note: We only compare non-revoked certificates.
// ─────────────────────────────────────────────────────────────
const checkCrossUniDuplicate = async (certData) => {
  const [rows] = await db.query(
    `SELECT c.id, c.university_id, u.name AS university_name
     FROM certificates c
     JOIN student_records sr ON c.student_record_id = sr.id
     JOIN students_new    sn ON sr.student_id = sn.id
     JOIN universities    u  ON c.university_id = u.id
     WHERE sn.national_id  = ?        -- same real-world person
       AND c.degree         = ?        -- same academic level
       AND c.major          = ?        -- same field of study
       AND c.university_id != ?        -- but a DIFFERENT university
       AND c.status        != 'revoked'
       AND c.id            != ?`,      //exclude the cert just issued
    [
      certData.national_id,
      certData.degree,
      certData.major,
      certData.university_id,
      certData.cert_id,
    ]
  );

  if (rows.length > 0) {
    const names = rows.map((r) => r.university_name).join(", ");
    return {
      fired:     true,
      source:    "RULE_CROSS_UNI_DUPLICATE",
      reason:    `Student (national ID ${certData.national_id}) already holds a ${certData.degree} in ${certData.major} issued by: ${names}. Possible duplicate certificate across institutions.`,
      riskScore: RISK.CROSS_UNI_DUPLICATE,
    };
  }

  return { fired: false };
};

// ─────────────────────────────────────────────────────────────
// RULE 3 — SUSPICIOUS GRADUATION DATE
// ─────────────────────────────────────────────────────────────
// Fires when the graduation_date is either:
//   A) More than 6 years before today  → suspiciously old cert
//   B) In the future                   → cert for someone who
//                                         hasn't graduated yet
//
// Why this matters:
//   Legitimate backdated certs happen (e.g. a student who
//   lost their original), but 6+ years is unusual and the
//   combination of a very old date with a new issuance
//   warrants a human review.
//   Future dates are always wrong — you can't graduate
//   before it happens.
// ─────────────────────────────────────────────────────────────
  const checkSuspiciousDate = async (certData) => {
  const YEARS_BACK_THRESHOLD = 1;

  const gradDate  = new Date(certData.graduation_date);
  const today     = new Date();

  // Calculate how many years ago the graduation date was
  const yearsAgo = (today - gradDate) / (1000 * 60 * 60 * 24 * 365.25);

  if (gradDate > today) {
    return {
      fired:     true,
      source:    "RULE_SUSPICIOUS_DATE",
      reason:    `Graduation date (${certData.graduation_date}) is set in the future. Certificate issued before the student has graduated.`,
      riskScore: RISK.SUSPICIOUS_DATE,
    };
  }

  if (yearsAgo > YEARS_BACK_THRESHOLD) {
    return {
      fired:     true,
      source:    "RULE_SUSPICIOUS_DATE",
      reason:    `Graduation date (${certData.graduation_date}) is ${Math.floor(yearsAgo)} years in the past. Unusually old graduation date for a newly issued certificate.`,
      riskScore: RISK.SUSPICIOUS_DATE,
    };
  }

  return { fired: false };
};

// ─────────────────────────────────────────────────────────────
// RULE 4 — GPA OUTLIER PATTERN
// ─────────────────────────────────────────────────────────────
// Fires when a single staff member has issued a suspiciously
// high number of near-perfect GPA certificates (>= 3.90)
// within the current calendar month.
//
// Why this matters:
//   A perfect GPA is rare. One or two is plausible. But if
//   the same staff account issues 6+ high-GPA certificates
//   in one month, it suggests GPAs are being inflated —
//   either through error or intentional fraud.
//
// Only fires if the current cert itself also has GPA >= 3.90,
// so we don't flag staff who happen to work at top universities
// but are issuing this particular low-GPA cert.
// ─────────────────────────────────────────────────────────────
/*const checkGpaOutlier = async (certData) => {
  const GPA_THRESHOLD   = 3.90;  // what counts as "near perfect"
  const COUNT_THRESHOLD = 5;     // how many is suspicious

  // Only run this rule if the current cert has a high GPA
  if (!certData.GPA || parseFloat(certData.GPA) < GPA_THRESHOLD) {
    return { fired: false };
  }

  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt
     FROM certificates
     WHERE created_by = ?
       AND GPA        >= ?
       AND MONTH(created_at) = MONTH(NOW())
       AND YEAR(created_at)  = YEAR(NOW())
       AND id != ?`,   //exclude the cert just issued
    [certData.created_by, GPA_THRESHOLD, certData.cert_id]
  );

  const count = rows[0].cnt;

  if (count >= COUNT_THRESHOLD) {
    return {
      fired:     true,
      source:    "RULE_GPA_OUTLIER",
      reason:    `Staff member (user ID ${certData.created_by}) has issued ${count + 1} certificates with GPA >= ${GPA_THRESHOLD} this month. Statistically unlikely pattern.`,
      riskScore: RISK.GPA_OUTLIER,
    };
  }

  return { fired: false };
};*/

// ─────────────────────────────────────────────────────────────
// RULE 5 — EDIT BEFORE ISSUE
// ─────────────────────────────────────────────────────────────
// Fires when a student record was modified within a short
// window BEFORE the certificate was issued, by the same
// staff member who issued the certificate.
//
// Why this matters:
//   This is the classic data falsification pattern:
//   1. Staff edits the student's degree or major
//   2. Staff immediately issues the certificate
//   The edit-then-issue sequence within minutes strongly
//   suggests the data was manipulated to match what the
//   staff wanted to certify, not what was actually true.
//
// We read from audit_log because student_records doesn't
// store a modification timestamp history. The audit_log
// already captures every UPDATE_STUDENT action.
//
// Window: 15 minutes before certificate issuance.
// ─────────────────────────────────────────────────────────────
const checkEditBeforeIssue = async (certData) => {
  const WINDOW_MINUTES = 15;

  const [rows] = await db.query(
    `SELECT id, action, description, created_at
     FROM audit_log
     WHERE action      = 'UPDATE_STUDENT'
       AND user_id     = ?               -- same staff member
       AND target_id   = ?               -- same student
       AND created_at >= NOW() - INTERVAL ? MINUTE
     ORDER BY created_at DESC
     LIMIT 1`,
    [certData.created_by, certData.student_id, WINDOW_MINUTES]
  );

  if (rows.length > 0) {
    const editTime = rows[0].created_at;
    return {
      fired:     true,
      source:    "RULE_EDIT_BEFORE_ISSUE",
      reason:    `Student record (ID ${certData.student_id}) was edited by the same staff member at ${editTime}, then a certificate was issued within ${WINDOW_MINUTES} minutes. Possible data falsification before issuance.`,
      riskScore: RISK.EDIT_BEFORE_ISSUE,
    };
  }

  return { fired: false };
};

// ─────────────────────────────────────────────────────────────
// RULE 6 — REVOKE AND REISSUE
// ─────────────────────────────────────────────────────────────
// Fires when a certificate for this student was revoked
// recently (within 2 hours) and a new one was just issued.
//
// Why this matters:
//   The normal revoke → re-issue flow should involve an
//   admin revoking a cert for a legitimate reason (error,
//   fraud discovered, etc.) and then a deliberate review
//   before re-issuing. Revoking and immediately re-issuing
//   — especially within the same hour — bypasses that review
//   process and is a red flag.
//
//   Common abuse pattern: Staff revokes a legitimate cert,
//   changes student data, then re-issues a falsified cert.
//   Combined with RULE_EDIT_BEFORE_ISSUE this is high risk.
// ─────────────────────────────────────────────────────────────
const checkRevokeReissue = async (certData) => {
  const WINDOW_HOURS = 2;

  const [rows] = await db.query(
    `SELECT al.id, al.created_at, al.description
     FROM audit_log al
     WHERE al.action     = 'REVOKE_CERTIFICATE'
       AND al.target_id IN (
         -- Find all previous certificate IDs for this student
         -- at this university (the revoked ones)
         SELECT id FROM certificates
         WHERE student_id    = ?
           AND university_id = ?
           AND status        = 'revoked'
       )
       AND al.created_at >= NOW() - INTERVAL ? HOUR
     ORDER BY al.created_at DESC
     LIMIT 1`,
    [certData.student_id, certData.university_id, WINDOW_HOURS]
  );

  if (rows.length > 0) {
    const revokeTime = rows[0].created_at;
    return {
      fired:     true,
      source:    "RULE_REVOKE_REISSUE",
      reason:    `A certificate for student ID ${certData.student_id} was revoked at ${revokeTime}, and a new certificate was issued within ${WINDOW_HOURS} hours. Rapid revoke-reissue cycle detected.`,
      riskScore: RISK.REVOKE_REISSUE,
    };
  }

  return { fired: false };
};

// ============================================================
// REPLACEMENT FOR RULE 7 — checkOffHours in fraudDetector.js
// ============================================================
//
// WHAT CHANGED AND WHY:
//
// OLD (wrong):
//   const HOUR_START = 1;
//   const HOUR_END   = 5;
//   if (currentHour >= HOUR_START && currentHour < HOUR_END) { fire }
//
//   Problem: hardcoded constants don't reflect the real world.
//   LIU works 8–16, BAU works 8–17, some universities work
//   Saturdays, some don't. A Lebanese holiday means nothing
//   to hardcoded hours.
//
// NEW (correct):
//   1. Read work_start, work_end, work_days from university_schedule
//   2. Check if the current date is a configured holiday
//   3. Fire if the issuance happened OUTSIDE working hours OR
//      on a non-working day OR on a holiday
//
// This way each university admin decides what "off hours" means
// for their institution. The fraud rule adapts automatically.
//
// ============================================================
// HOW TO INTEGRATE:
//
// In fraudDetector.js, REPLACE the entire checkOffHours function
// with the one below. Everything else in the file stays the same.
// ============================================================

const checkOffHours = async (certData) => {
  // ── Step 1: Fetch this university's schedule from DB ──────
  const [scheduleRows] = await db.query(
    `SELECT work_start, work_end, work_days, timezone
     FROM university_schedule
     WHERE university_id = ?
     LIMIT 1`,
    [certData.university_id]
  );

  // If no schedule is configured, fall back to a safe default
  // (Mon–Fri 08:00–17:00) so the rule still works even before
  // the admin has set up their schedule.
  const schedule = scheduleRows[0] || {
    work_start: "08:00:00",
    work_end:   "17:00:00",
    work_days:  [1, 2, 3, 4, 5], // Mon–Fri
    timezone:   "Asia/Beirut",
  };

  // work_days comes from DB as a JSON string or already an array
  const workDays = Array.isArray(schedule.work_days)
    ? schedule.work_days
    : JSON.parse(schedule.work_days);

  // ── Step 2: Get current date/time in the university's timezone ──
  // We use Intl to convert the server's UTC time to the university's
  // local time — so a Beirut university is judged by Beirut time,
  // not by the server's timezone.
  const now = new Date();

  const localTimeStr = now.toLocaleString("en-US", {
    timeZone: schedule.timezone,
    hour12:   false,
    year:     "numeric",
    month:    "2-digit",
    day:      "2-digit",
    hour:     "2-digit",
    minute:   "2-digit",
    second:   "2-digit",
  });

  // Parse the localized string back into parts
  // Format from en-US: "MM/DD/YYYY, HH:MM:SS"
  const [datePart, timePart] = localTimeStr.split(", ");
  const [month, day, year]   = datePart.split("/");
  const [hour, minute]       = timePart.split(":").map(Number);

  // Day of week in the university's local timezone (0=Sun...6=Sat)
  const localDate    = new Date(`${year}-${month}-${day}T${timePart}`);
  const dayOfWeek    = localDate.getDay();
  const todayDateStr = `${year}-${month}-${day}`; // YYYY-MM-DD for holiday lookup

  // ── Step 3: Check if today is a configured holiday ────────
  const [holidayRows] = await db.query(
    `SELECT label FROM university_holidays
     WHERE university_id = ?
       AND holiday_date  = ?
     LIMIT 1`,
    [certData.university_id, `${year}-${month}-${day}`]
  );

  if (holidayRows.length > 0) {
    const holidayLabel = holidayRows[0].label;
    return {
      fired:     true,
      source:    "RULE_OFF_HOURS",
      reason:    `Certificate issued on "${holidayLabel}" (${todayDateStr}), which is a configured university holiday. Staff should not be issuing certificates on this day.`,
      riskScore: RISK.OFF_HOURS,
    };
  }

  // ── Step 4: Check if today is a working day ───────────────
  if (!workDays.includes(dayOfWeek)) {
    const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    return {
      fired:     true,
      source:    "RULE_OFF_HOURS",
      reason:    `Certificate issued on a ${dayNames[dayOfWeek]}, which is not a configured working day for this university. Configured working days: ${workDays.map(d => dayNames[d]).join(", ")}.`,
      riskScore: RISK.OFF_HOURS,
    };
  }

  // ── Step 5: Check if current time is within working hours ─
  // Convert work_start and work_end to comparable numbers (HHMM)
  const [startHour, startMin] = schedule.work_start.split(":").map(Number);
  const [endHour,   endMin]   = schedule.work_end.split(":").map(Number);

  const currentMinutes = hour * 60 + minute;            // e.g. 09:30 → 570
  const startMinutes   = startHour * 60 + startMin;     // e.g. 08:00 → 480
  const endMinutes     = endHour   * 60 + endMin;       // e.g. 16:00 → 960

  const isOutsideHours = currentMinutes < startMinutes || currentMinutes >= endMinutes;

  if (isOutsideHours) {
    const currentTimeFormatted = `${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`;
    return {
      fired:     true,
      source:    "RULE_OFF_HOURS",
      reason:    `Certificate issued at ${currentTimeFormatted} (${schedule.timezone}), which is outside this university's configured working hours (${schedule.work_start.slice(0,5)}–${schedule.work_end.slice(0,5)}). Contact admin if this was legitimate.`,
      riskScore: RISK.OFF_HOURS,
    };
  }

  // All checks passed — issuance is within working hours on a working day
  return { fired: false };
};

// ─────────────────────────────────────────────────────────────
// RULE 8 — NEW ACCOUNT ISSUANCE
// ─────────────────────────────────────────────────────────────
// Fires when the staff account issuing the certificate was
// created (or activated) very recently.
//
// Why this matters:
//   A newly activated account immediately issuing certificates
//   is suspicious. It could mean:
//   - The activation email was intercepted by an attacker
//   - A fake staff account was just added by a rogue admin
//   - A legitimate mistake (new staff given too much access
//     without proper onboarding review)
//
// We check is_verified timestamp indirectly by looking at
// when the account was created vs now. A threshold of 48h
// gives new staff a grace period but still flags rapid abuse.
// ─────────────────────────────────────────────────────────────
/*const checkNewAccountIssue = async (certData) => {
  const HOURS_THRESHOLD = 48; // accounts younger than this are flagged

  const [rows] = await db.query(
    `SELECT id, name, created_at
     FROM users
     WHERE id = ?
       AND created_at >= NOW() - INTERVAL ? HOUR`,
    [certData.created_by, HOURS_THRESHOLD]
  );

  if (rows.length > 0) {
    const accountAge = rows[0].created_at;
    return {
      fired:     true,
      source:    "RULE_NEW_ACCOUNT_ISSUE",
      reason:    `Staff account (user ID ${certData.created_by}) was created at ${accountAge} — less than ${HOURS_THRESHOLD} hours ago — and is already issuing certificates. Newly created accounts should not issue certificates immediately.`,
      riskScore: RISK.NEW_ACCOUNT_ISSUE,
    };
  }

  return { fired: false };
};
*/
// ─────────────────────────────────────────────────────────────
// RULE REGISTRY
// ─────────────────────────────────────────────────────────────
// All rules are registered here. To disable a rule temporarily,
// just comment it out. To add a new rule, append it here.
// Each entry must be an async function matching the signature:
//   async (certData) => { fired, source, reason, riskScore }
// ─────────────────────────────────────────────────────────────
const RULES = [
  checkVelocity,
  checkCrossUniDuplicate,
  checkSuspiciousDate,
  
  checkEditBeforeIssue,
  checkRevokeReissue,
  checkOffHours,
  
];

// ─────────────────────────────────────────────────────────────
// INSERT A SINGLE FRAUD FLAG INTO THE DATABASE
// ─────────────────────────────────────────────────────────────
// Each rule that fires creates one row in fraud_flag.
// Multiple rows per certificate is intentional — it lets admins
// see exactly which rules fired and why, independently.
// ─────────────────────────────────────────────────────────────
const insertFraudFlag = async ({
  certificate_id,
  user_id,
  university_id,
  source,
  reason,
  riskScore,
}) => {
  await db.query(
    `INSERT INTO fraud_flag
       (certificate_id, user_id, reason, source, target_type, risk_score, status)
     VALUES (?, ?, ?, ?, 'certificate', ?, 'pending')`,
    [certificate_id, user_id, reason, source, riskScore]
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN ENTRY POINT — RUN ALL FRAUD CHECKS
// ─────────────────────────────────────────────────────────────
// Called from certificationController.js right after a
// certificate is committed to the DB.
//
// certData shape (all fields come from the controller):
// {
//   cert_id:        number   ← the newly inserted cert id
//   created_by:     number   ← staff user id
//   student_id:     number   ← student id from students_new
//   university_id:  number
//   national_id:    string   ← pulled from student record
//   degree:         string
//   major:          string
//   GPA:            number | null
//   graduation_date: string  ← "YYYY-MM-DD"
// }
//
// This function NEVER throws — fraud detection failure must
// never break the main certificate issuance flow. Errors are
// logged but swallowed.
// ─────────────────────────────────────────────────────────────
const runFraudChecks = async (certData) => {
  // Run each rule in parallel for performance.
  // Promise.allSettled ensures one rule crashing doesn't stop others.
  const results = await Promise.allSettled(
    RULES.map((rule) => rule(certData))
  );

  // Collect the flags that fired
  const firedFlags = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];

    if (result.status === "rejected") {
      // A rule threw an error — log it but continue
      console.error(
        `[FraudDetector] Rule ${RULES[i].name} threw an error:`,
        result.reason?.message || result.reason
      );
      continue;
    }

    const ruleResult = result.value;

    if (ruleResult?.fired) {
      firedFlags.push(ruleResult);
      console.warn(
        `[FraudDetector] 🚨 ${ruleResult.source} fired for cert ID ${certData.cert_id} — risk: ${ruleResult.riskScore}`
      );
    }
  }

  // Insert all fired flags into the database
  // We do these sequentially to avoid race conditions on the same cert
  for (const flag of firedFlags) {
    try {
      await insertFraudFlag({
        certificate_id: certData.cert_id,
        user_id:        certData.created_by,
        university_id:  certData.university_id,
        source:         flag.source,
        reason:         flag.reason,
        riskScore:      flag.riskScore,
      });
    } catch (insertErr) {
      // Insertion failure should never crash issuance
      console.error(
        `[FraudDetector] Failed to insert flag for rule ${flag.source}:`,
        insertErr.message
      );
    }
  }

  // Return a summary — useful for logging in the controller
  return {
    rules_checked: RULES.length,
    flags_raised:  firedFlags.length,
    total_risk:    firedFlags.reduce((sum, f) => sum + f.riskScore, 0),
    fired_rules:   firedFlags.map((f) => f.source),
  };
};

module.exports = { runFraudChecks };