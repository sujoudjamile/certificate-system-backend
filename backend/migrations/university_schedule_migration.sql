-- ============================================================
-- UNIVERSITY SCHEDULE SYSTEM — DATABASE MIGRATION
-- ============================================================
-- FILE: migrations/university_schedule_migration.sql
--
-- Creates two tables:
--   1. university_schedule  — working hours + working days per university
--   2. university_holidays  — specific off-days (public holidays, etc.)
--
-- HOW TO RUN:
--   mysql -u root -p cert_system < migrations/university_schedule_migration.sql
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- TABLE 1: university_schedule
--
-- work_days: JSON array of day numbers
--   0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday,
--   4 = Thursday, 5 = Friday, 6 = Saturday
--
-- Example LIU (Mon–Fri, 8:00–16:00):
--   work_start = '08:00:00'
--   work_end   = '16:00:00'
--   work_days  = [1,2,3,4,5]
--
-- Example BAU (Mon–Sat, 8:00–17:00):
--   work_start = '08:00:00'
--   work_end   = '17:00:00'
--   work_days  = [1,2,3,4,5,6]
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `university_schedule` (
  `id`            int(11)      NOT NULL AUTO_INCREMENT,
  `university_id` int(11)      NOT NULL,
  `work_start`    time         NOT NULL DEFAULT '08:00:00'
                  COMMENT 'Start of working hours e.g. 08:00:00',
  `work_end`      time         NOT NULL DEFAULT '17:00:00'
                  COMMENT 'End of working hours e.g. 17:00:00',
  `work_days`     json         NOT NULL
                  COMMENT 'Array of working day numbers [0=Sun,1=Mon,...,6=Sat]',
  `timezone`      varchar(60)  NOT NULL DEFAULT 'Asia/Beirut'
                  COMMENT 'IANA timezone for this university',
  `updated_by`    int(11)      DEFAULT NULL,
  `updated_at`    datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  `created_at`    datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_university_schedule` (`university_id`),
  CONSTRAINT `fk_schedule_university`
    FOREIGN KEY (`university_id`) REFERENCES `universities`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────────────────────────
-- TABLE 2: university_holidays
--
-- Each row = one specific off-day for a university.
-- Examples:
--   Lebanese Independence Day : 2025-11-22
--   University foundation day : 2025-03-15
--   Custom holiday            : any date admin adds
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `university_holidays` (
  `id`            int(11)      NOT NULL AUTO_INCREMENT,
  `university_id` int(11)      NOT NULL,
  `holiday_date`  date         NOT NULL
                  COMMENT 'The specific date that is off',
  `label`         varchar(120) NOT NULL
                  COMMENT 'e.g. Lebanese Independence Day',
  `created_by`    int(11)      DEFAULT NULL,
  `created_at`    datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_university_holiday` (`university_id`, `holiday_date`),
  INDEX `idx_holiday_date` (`holiday_date`),
  CONSTRAINT `fk_holiday_university`
    FOREIGN KEY (`university_id`) REFERENCES `universities`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────────────────────────
-- SEED: Give every existing university a default schedule
-- so Rule 7 always has data to read.
-- Admins update this via the API whenever they want.
-- Default: Mon–Fri 08:00–17:00, Asia/Beirut
-- ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO `university_schedule`
  (university_id, work_start, work_end, work_days, timezone)
SELECT
  id,
  '08:00:00',
  '17:00:00',
  JSON_ARRAY(1,2,3,4,5),
  'Asia/Beirut'
FROM `universities`;