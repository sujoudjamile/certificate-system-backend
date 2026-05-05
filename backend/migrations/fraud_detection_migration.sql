-- ============================================================
-- FRAUD DETECTION SYSTEM — DATABASE MIGRATION
-- ============================================================
-- FILE: migrations/fraud_detection_migration.sql
--
-- Run this file ONCE against your cert_system database.
-- It does four things:
--   1. Adds missing columns to fraud_flag that our code needs
--   2. Adds indexes for fast querying
--   3. Fixes the certificate lock trigger so that fraud
--      resolution (which revokes locked certs) still works
--   4. Creates a view for the admin dashboard summary query
--
-- HOW TO RUN:
--   mysql -u root -p cert_system < migrations/fraud_detection_migration.sql
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- STEP 1: Add missing columns to fraud_flag
-- ─────────────────────────────────────────────────────────────
-- Your existing fraud_flag table is missing `source` and
-- `university_id`. We add them here safely using IF NOT EXISTS
-- style (ALTER TABLE only adds if column doesn't exist).
-- ─────────────────────────────────────────────────────────────

-- Add `source` column: stores which rule fired (e.g. "RULE_VELOCITY")
ALTER TABLE `fraud_flag`
  ADD COLUMN IF NOT EXISTS `source` varchar(60) DEFAULT NULL
    COMMENT 'Which fraud rule triggered this flag, e.g. RULE_VELOCITY'
  AFTER `reason`;

-- Add `university_id` for scoped admin queries
ALTER TABLE `fraud_flag`
  ADD COLUMN IF NOT EXISTS `university_id` int(11) DEFAULT NULL
    COMMENT 'Denormalized university_id for faster admin-scoped queries'
  AFTER `user_id`;

-- ─────────────────────────────────────────────────────────────
-- STEP 2: Add indexes to fraud_flag for fast dashboard queries
-- ─────────────────────────────────────────────────────────────
-- Without these, every admin dashboard load does a full table
-- scan. These indexes cover every query in fraudController.js.
-- ─────────────────────────────────────────────────────────────

-- Index on status: most queries filter by status = 'pending'
ALTER TABLE `fraud_flag`
  ADD INDEX IF NOT EXISTS `idx_fraud_status` (`status`);

-- Index on source: filter by rule name
ALTER TABLE `fraud_flag`
  ADD INDEX IF NOT EXISTS `idx_fraud_source` (`source`);

-- Index on risk_score: ORDER BY risk_score DESC
ALTER TABLE `fraud_flag`
  ADD INDEX IF NOT EXISTS `idx_fraud_risk_score` (`risk_score`);

-- Index on flagged_at: date range filters and trend queries
ALTER TABLE `fraud_flag`
  ADD INDEX IF NOT EXISTS `idx_fraud_flagged_at` (`flagged_at`);

-- Composite: university + status (most common admin query)
ALTER TABLE `fraud_flag`
  ADD INDEX IF NOT EXISTS `idx_fraud_uni_status` (`university_id`, `status`);

-- ─────────────────────────────────────────────────────────────
-- STEP 3: Fix the certificate lock trigger
-- ─────────────────────────────────────────────────────────────
-- PROBLEM:
--   Your existing trigger `prevent_locked_certificate_update`
--   blocks ALL updates on locked certificates.
--   But when an admin resolves a fraud flag, our code needs to
--   revoke a LOCKED certificate (status: 'locked' → 'revoked').
--   Without this fix, resolveFlag() will throw a DB error.
--
-- SOLUTION:
--   Replace the trigger with a smarter version that:
--   - Still blocks ALL non-revocation changes on locked certs
--   - Allows the specific change from 'locked' → 'revoked'
--     (which is the only legitimate mutation of a locked cert)
--
-- This preserves all original fraud-prevention behavior while
-- adding the one exception we need for fraud resolution.
-- ─────────────────────────────────────────────────────────────

-- Drop the old trigger first
DROP TRIGGER IF EXISTS `prevent_locked_certificate_update`;

-- Create the updated trigger
DELIMITER $$

CREATE TRIGGER `prevent_locked_certificate_update`
BEFORE UPDATE ON `certificates`
FOR EACH ROW
BEGIN
  -- If the certificate is locked, only ONE change is allowed:
  -- changing status from 'locked' to 'revoked' (fraud resolution).
  -- Every other update on a locked cert is blocked.
  IF OLD.status = 'locked' THEN

    -- Check if this is a pure revocation (only status changes, to 'revoked')
    -- If it is NOT a revocation, block it.
    IF NOT (NEW.status = 'revoked' AND
            NEW.cert_number        = OLD.cert_number        AND
            NEW.student_id         = OLD.student_id         AND
            NEW.university_id      = OLD.university_id      AND
            NEW.degree             = OLD.degree             AND
            NEW.major              = OLD.major              AND
            NEW.GPA                <=> OLD.GPA              AND  -- <=> handles NULL equality
            NEW.graduation_date    = OLD.graduation_date    AND
            NEW.certification_hash = OLD.certification_hash AND
            NEW.digital_signature  = OLD.digital_signature) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Certificate is locked and cannot be modified. Only revocation is allowed.';
    END IF;

  END IF;
END$$

DELIMITER ;

-- ─────────────────────────────────────────────────────────────
-- STEP 4: Create the fraud summary view
-- ─────────────────────────────────────────────────────────────
-- This view pre-joins fraud_flag with certificates and users
-- so the dashboard query is a simple SELECT from one place.
-- Used by getFraudStats in fraudController.js.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW `v_fraud_summary` AS
SELECT
  ff.id                           AS flag_id,
  ff.certificate_id,
  ff.user_id,
  ff.university_id,
  ff.source                       AS rule_name,
  ff.reason,
  ff.risk_score,
  ff.status                       AS flag_status,
  ff.flagged_at,
  ff.resolved_at,
  ff.review_note,
  ff.reviewed_by,

  -- Certificate details
  c.cert_number,
  c.degree,
  c.major,
  c.GPA,
  c.status                        AS cert_status,
  c.university_id                 AS cert_university_id,

  -- Student details
  sn.full_name                    AS student_name,
  sn.national_id,

  -- University name
  u.name                          AS university_name,

  -- Staff who issued (suspected person)
  staff.name                      AS issued_by_name,
  staff.email                     AS issued_by_email,

  -- Reviewer
  reviewer.name                   AS reviewed_by_name

FROM fraud_flag ff
JOIN certificates  c        ON ff.certificate_id = c.id
JOIN students_new  sn       ON c.student_id       = sn.id
JOIN universities  u        ON c.university_id    = u.id
LEFT JOIN users    staff    ON ff.user_id          = staff.id
LEFT JOIN users    reviewer ON ff.reviewed_by      = reviewer.id;

-- ─────────────────────────────────────────────────────────────
-- STEP 5: Populate university_id in existing fraud_flag rows
-- ─────────────────────────────────────────────────────────────
-- If you already have rows in fraud_flag, backfill university_id
-- from the certificates table so scoped admin queries work.
-- ─────────────────────────────────────────────────────────────

UPDATE fraud_flag ff
JOIN certificates c ON ff.certificate_id = c.id
SET ff.university_id = c.university_id
WHERE ff.university_id IS NULL;

-- Done. You can verify with:
-- SHOW COLUMNS FROM fraud_flag;
-- SHOW TRIGGERS LIKE 'prevent_locked_certificate_update';
-- SELECT * FROM v_fraud_summary LIMIT 5;