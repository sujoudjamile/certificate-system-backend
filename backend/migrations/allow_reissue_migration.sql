-- Add allow_reissue column to certificates table
ALTER TABLE certificates
ADD COLUMN allow_reissue TINYINT(1) NOT NULL DEFAULT 0
COMMENT 'If 1, staff can issue a new certificate for this student record even if a revoked one exists'
AFTER status;