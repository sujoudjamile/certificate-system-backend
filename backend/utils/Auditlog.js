// utils/auditLog.js

const db = require("../config/db");

/*
==================================
AUDIT LOG HELPER
==================================
Call this function anywhere in the system
to record an action into the audit_log table.

Parameters:
  - user_id       : who performed the action
  - university_id : which university
  - action        : short action name e.g. "ADD_STUDENT", "DELETE_STUDENT"
  - description   : human-readable description of what happened
  - status        : "success" or "failure"
  - target_type   : what was affected e.g. "student", "certificate", "staff"
  - target_id     : the ID of the affected record
  - certificate_id: (optional) if action is certificate-related
  - ip_address    : the IP address of the request
*/
const logAction = async ({
  user_id,
  university_id   = null,
  action,
  description,
  status          = "success",
  target_type     = null,
  target_id       = null,
  certificate_id  = null,
  ip_address      = null,
}) => {
  try {
    await db.query(
      `INSERT INTO audit_log
       (user_id, university_id, action, description, status, target_type, target_id, certificate_id, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, university_id, action, description, status, target_type, target_id, certificate_id, ip_address]
    );
  } catch (err) {
    // Audit log failure should NEVER crash the main request
    console.error("AUDIT LOG ERROR:", err.message);
  }
};

module.exports = logAction;