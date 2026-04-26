// controllers/auditController.js

const db = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

/*
==================================
HELPER — FORMAT DATE
==================================
*/
const formatDate = (raw) => {
  if (!raw) return null;
  const d = new Date(raw);
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day   = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins  = String(d.getMinutes()).padStart(2, "0");
  const secs  = String(d.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
};

/*
==================================
GET AUDIT LOGS
==================================
super_admin sees all logs across all universities.
Admin sees only their own university's logs.

Query filters:
  - action      : e.g. "ADD_STUDENT", "LOGIN_FAILED"
  - target_type : e.g. "student", "certificate", "user"
  - status      : "success" or "failure"
  - from        : start date e.g. "2024-01-01"
  - to          : end date e.g. "2024-12-31"
  - page        : page number (default 1)
  - limit       : results per page (default 20)
*/
const getAuditLogs = asyncHandler(async (req, res) => {
  const { role, university_id } = req.user;
  const { action, target_type, status, from, to } = req.query;

  // Pagination
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  // Base query
  let query = `
    SELECT
      al.id,
      al.action,
      al.description,
      al.status,
      al.target_type,
      al.target_id,
      al.certificate_id,
      al.ip_address,
      DATE_FORMAT(al.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
      u.name  AS performed_by,
      u.role  AS performer_role,
      un.name AS university_name
    FROM audit_log al
    LEFT JOIN users u  ON al.user_id = u.id
    LEFT JOIN universities un ON al.university_id = un.id
  `;

  const conditions = [];
  const values     = [];

  // Scope by university for admin
  if (role === "admin") {
    conditions.push("al.university_id = ?");
    values.push(university_id);
  }

  if (action) {
    conditions.push("al.action = ?");
    values.push(action.toUpperCase());
  }

  if (target_type) {
    conditions.push("al.target_type = ?");
    values.push(target_type.toLowerCase());
  }

  if (status) {
    conditions.push("al.status = ?");
    values.push(status.toLowerCase());
  }

  if (from) {
    conditions.push("al.created_at >= ?");
    values.push(from);
  }

  if (to) {
    conditions.push("al.created_at <= ?");
    values.push(to + " 23:59:59");
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  // Count total for pagination
  let countQuery = `SELECT COUNT(*) AS total FROM audit_log al`;
  if (conditions.length > 0) {
    countQuery += " WHERE " + conditions.join(" AND ");
  }

  const [countResult] = await db.query(countQuery, values);
  const total = countResult[0].total;

  // Add ordering and pagination
  query += " ORDER BY al.created_at DESC LIMIT ? OFFSET ?";
  values.push(limit, offset);

  const [logs] = await db.query(query, values);

  res.json({
    status:      "success",
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
    logs,
  });
});


/*
==================================
GET AUDIT LOGS FOR A SPECIFIC TARGET
==================================
Returns all logs related to a specific record.

Example:
  GET /api/audit/target/student/42
  GET /api/audit/target/certificate/10
*/
const getAuditLogsByTarget = asyncHandler(async (req, res) => {
  const { target_type, target_id } = req.params;
  const { role, university_id }    = req.user;

  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(100, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  let query = `
    SELECT
      al.id,
      al.action,
      al.description,
      al.status,
      al.target_type,
      al.target_id,
      al.certificate_id,
      al.ip_address,
      DATE_FORMAT(al.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
      u.name  AS performed_by,
      u.role  AS performer_role,
      un.name AS university_name
    FROM audit_log al
    LEFT JOIN users u  ON al.user_id = u.id
    LEFT JOIN universities un ON al.university_id = un.id
    WHERE al.target_type = ? AND al.target_id = ?
  `;

  const values = [target_type.toLowerCase(), target_id];

  if (role === "admin") {
    query += " AND al.university_id = ?";
    values.push(university_id);
  }

  query += " ORDER BY al.created_at DESC LIMIT ? OFFSET ?";
  values.push(limit, offset);

  const [logs] = await db.query(query, values);

  res.json({
    status: "success",
    total:  logs.length,
    page,
    limit,
    logs,
  });
});


/*
==================================
GET AUDIT SUMMARY
==================================
Returns a count of each action type —
useful for a dashboard overview.
*/
const getAuditSummary = asyncHandler(async (req, res) => {
  const { role, university_id } = req.user;

  let query = `
    SELECT
      action,
      status,
      COUNT(*) AS count
    FROM audit_log
  `;

  const values = [];

  if (role === "admin") {
    query += " WHERE university_id = ?";
    values.push(university_id);
  }

  query += " GROUP BY action, status ORDER BY count DESC";

  const [summary] = await db.query(query, values);

  res.json({
    status: "success",
    summary,
  });
});


module.exports = { getAuditLogs, getAuditLogsByTarget, getAuditSummary };