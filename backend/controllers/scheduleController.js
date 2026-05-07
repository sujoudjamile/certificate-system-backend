// controllers/scheduleController.js
//
// Allows a university admin to configure:
//   - Their working hours (work_start, work_end)
//   - Their working days (Mon–Fri, Mon–Sat, etc.)
//   - Their timezone
//   - Specific off-days (public holidays, custom days off)
//
// Rule 7 in fraudDetector.js reads from these tables instead
// of using hardcoded hours — this is the correct real-world design.

const db          = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const AppError    = require("../utils/AppError");
const logAction   = require("../utils/auditLog");

// Valid day numbers: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
const VALID_DAYS = [0, 1, 2, 3, 4, 5, 6];

// ─────────────────────────────────────────────────────────────
// GET SCHEDULE
// Returns the working hours + working days for the university.
// If not configured yet, returns the default values.
//
// GET /api/schedule
// ─────────────────────────────────────────────────────────────
const getSchedule = asyncHandler(async (req, res) => {
  const universityId = req.user.university_id;

  const [rows] = await db.query(
    `SELECT
       us.id,
       us.work_start,
       us.work_end,
       us.work_days,
       us.timezone,
       us.updated_at,
       u.name AS updated_by_name
     FROM university_schedule us
     LEFT JOIN users u ON us.updated_by = u.id
     WHERE us.university_id = ?`,
    [universityId]
  );

  if (rows.length === 0) {
    // No schedule configured yet — return defaults
    return res.json({
      status: "success",
      schedule: {
        work_start: "08:00:00",
        work_end:   "17:00:00",
        work_days:  [1, 2, 3, 4, 5], // Mon–Fri
        timezone:   "Asia/Beirut",
        configured: false,           // tells frontend this is the default
      },
    });
  }

  res.json({
    status: "success",
    schedule: {
      ...rows[0],
      configured: true,
    },
  });
});

// ─────────────────────────────────────────────────────────────
// SET SCHEDULE (create or update)
// Admin sets their university's working hours and days.
//
// PUT /api/schedule
// Body:
// {
//   "work_start": "08:00",
//   "work_end":   "16:00",
//   "work_days":  [1,2,3,4,5],
//   "timezone":   "Asia/Beirut"
// }
// ─────────────────────────────────────────────────────────────
const setSchedule = asyncHandler(async (req, res) => {
  const universityId = req.user.university_id;
  const adminId      = req.user.id;
  let { work_start, work_end, work_days, timezone } = req.body;

  // ── Validation ───────────────────────────────────────────
  if (!work_start || !work_end || !work_days) {
    throw new AppError("work_start, work_end, and work_days are required", 400);
  }

  // work_days must be an array
  if (!Array.isArray(work_days) || work_days.length === 0) {
    throw new AppError("work_days must be a non-empty array of day numbers (0=Sun ... 6=Sat)", 400);
  }

  // Each day number must be valid
  for (const day of work_days) {
    if (!VALID_DAYS.includes(day)) {
      throw new AppError(
        `Invalid day number: ${day}. Use 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat`,
        400
      );
    }
  }

  // Time format validation HH:MM or HH:MM:SS
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
  if (!timeRegex.test(work_start)) {
    throw new AppError("work_start must be in HH:MM or HH:MM:SS format", 400);
  }
  if (!timeRegex.test(work_end)) {
    throw new AppError("work_end must be in HH:MM or HH:MM:SS format", 400);
  }

  // work_end must be after work_start
  if (work_start >= work_end) {
    throw new AppError("work_end must be later than work_start", 400);
  }

  // Default timezone if not provided
  timezone = timezone || "Asia/Beirut";

  // ── Upsert (INSERT or UPDATE) ────────────────────────────
  // If the university already has a schedule, update it.
  // If not, create it. This way the admin can call PUT anytime.
  await db.query(
    `INSERT INTO university_schedule
       (university_id, work_start, work_end, work_days, timezone, updated_by)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       work_start  = VALUES(work_start),
       work_end    = VALUES(work_end),
       work_days   = VALUES(work_days),
       timezone    = VALUES(timezone),
       updated_by  = VALUES(updated_by)`,
    [universityId, work_start, work_end, JSON.stringify(work_days), timezone, adminId]
  );

  await logAction({
    user_id:       adminId,
    university_id: universityId,
    action:        "UPDATE_SCHEDULE",
    description:   `Updated working schedule: ${work_start}–${work_end}, days: [${work_days}], tz: ${timezone}`,
    status:        "success",
    target_type:   "university",
    target_id:     universityId,
    ip_address:    req.ip,
  });

  res.json({
    status:  "success",
    message: "Working schedule updated successfully.",
    schedule: { work_start, work_end, work_days, timezone },
  });
});

// ─────────────────────────────────────────────────────────────
// GET HOLIDAYS
// Returns all off-days configured for this university.
//
// GET /api/schedule/holidays
// ─────────────────────────────────────────────────────────────
const getHolidays = asyncHandler(async (req, res) => {
  const universityId = req.user.university_id;

  const [holidays] = await db.query(
    `SELECT
       uh.id,
       uh.holiday_date,
       uh.label,
       uh.created_at,
       u.name AS added_by
     FROM university_holidays uh
     LEFT JOIN users u ON uh.created_by = u.id
     WHERE uh.university_id = ?
     ORDER BY uh.holiday_date ASC`,
    [universityId]
  );

  res.json({ status: "success", holidays });
});

// ─────────────────────────────────────────────────────────────
// ADD HOLIDAY
// Admin adds a specific off-day.
//
// POST /api/schedule/holidays
// Body: { "holiday_date": "2025-11-22", "label": "Lebanese Independence Day" }
// ─────────────────────────────────────────────────────────────
const addHoliday = asyncHandler(async (req, res) => {
  const universityId = req.user.university_id;
  const adminId      = req.user.id;
  const { holiday_date, label } = req.body;

  if (!holiday_date || !label) {
    throw new AppError("holiday_date and label are required", 400);
  }

  // Validate date format YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(holiday_date)) {
    throw new AppError("holiday_date must be in YYYY-MM-DD format", 400);
  }

  // Check it's a real date
  const parsed = new Date(holiday_date);
  if (isNaN(parsed.getTime())) {
    throw new AppError("holiday_date is not a valid date", 400);
  }

  // Prevent duplicate
  const [existing] = await db.query(
    "SELECT id FROM university_holidays WHERE university_id = ? AND holiday_date = ?",
    [universityId, holiday_date]
  );
  if (existing.length > 0) {
    throw new AppError(`${holiday_date} is already marked as a holiday`, 400);
  }

  const [result] = await db.query(
    `INSERT INTO university_holidays (university_id, holiday_date, label, created_by)
     VALUES (?, ?, ?, ?)`,
    [universityId, holiday_date, label.trim(), adminId]
  );

  await logAction({
    user_id:       adminId,
    university_id: universityId,
    action:        "ADD_HOLIDAY",
    description:   `Added holiday: ${label} on ${holiday_date}`,
    status:        "success",
    target_type:   "university",
    target_id:     universityId,
    ip_address:    req.ip,
  });

  res.status(201).json({
    status:  "success",
    message: "Holiday added successfully.",
    holiday: { id: result.insertId, holiday_date, label },
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE HOLIDAY
// Admin removes a specific off-day (e.g. university decides
// to work on a previously announced holiday).
//
// DELETE /api/schedule/holidays/:id
// ─────────────────────────────────────────────────────────────
const deleteHoliday = asyncHandler(async (req, res) => {
  const universityId = req.user.university_id;
  const adminId      = req.user.id;
  const { id }       = req.params;

  const [rows] = await db.query(
    "SELECT * FROM university_holidays WHERE id = ? AND university_id = ?",
    [id, universityId]
  );

  if (rows.length === 0) {
    throw new AppError("Holiday not found", 404);
  }

  await db.query("DELETE FROM university_holidays WHERE id = ?", [id]);

  await logAction({
    user_id:       adminId,
    university_id: universityId,
    action:        "DELETE_HOLIDAY",
    description:   `Removed holiday: ${rows[0].label} (${rows[0].holiday_date})`,
    status:        "success",
    target_type:   "university",
    target_id:     universityId,
    ip_address:    req.ip,
  });

  res.json({
    status:  "success",
    message: `Holiday "${rows[0].label}" removed.`,
  });
});

module.exports = { getSchedule, setSchedule, getHolidays, addHoliday, deleteHoliday };