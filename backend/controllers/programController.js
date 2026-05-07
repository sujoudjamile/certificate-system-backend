// controllers/programController.js

const db          = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const AppError     = require("../utils/AppError");
const logAction    = require("../utils/auditLog");

/*
==================================
GET ALL MAJORS
==================================
Returns the global majors catalogue grouped by field.
Used by the admin UI when picking programs.
*/
const getAllMajors = asyncHandler(async (req, res) => {
  const [majors] = await db.query(
    `SELECT id, name, field
     FROM majors
     ORDER BY field, name`
  );
  res.json({ status: "success", majors });
});

/*
==================================
GET ALL DEGREES
==================================
Returns the global degrees catalogue.
*/
const getAllDegrees = asyncHandler(async (req, res) => {
  const [degrees] = await db.query(
    `SELECT id, name, abbreviation, level
     FROM degrees
     ORDER BY FIELD(level,'undergraduate','graduate','doctoral','professional'), name`
  );
  res.json({ status: "success", degrees });
});

/*
==================================
GET ALLOWED DEGREES FOR A MAJOR
==================================
When admin picks a major, this returns only the degrees
that are globally valid for that major.
e.g. Pharmacy → [PharmD]
     Computer Science → [Bachelor, Master, PhD]
*/
const getDegreesForMajor = asyncHandler(async (req, res) => {
  const { majorId } = req.params;

  const [degrees] = await db.query(
    `SELECT d.id, d.name, d.short_name , d.level
     FROM degrees d
     JOIN major_allowed_degrees mad ON d.id = mad.degree_id
     WHERE mad.major_id = ?
     ORDER BY FIELD(d.level,'undergraduate','graduate','doctoral','professional'), d.name`,
    [majorId]
  );

  if (degrees.length === 0) {
    // Check if major even exists
    const [m] = await db.query("SELECT id FROM majors WHERE id = ?", [majorId]);
    if (m.length === 0) throw new AppError("Major not found", 404);
  }

  res.json({ status: "success", degrees });
});

/*
==================================
GET UNIVERSITY PROGRAMS (Admin)
==================================
Returns all active + inactive programs for the
logged-in admin's university, grouped for the UI.
*/
const getUniversityPrograms = asyncHandler(async (req, res) => {
  const { university_id } = req.user;
  if (!university_id) throw new AppError("Not linked to a university", 400);

  const [programs] = await db.query(
    `SELECT
       up.id,
       up.is_active,
       m.id          AS major_id,
       m.name        AS major_name,
       m.field,
       d.id          AS degree_id,
       d.name        AS degree_name,
       d.short_name,
       d.level
     FROM university_programs up
     JOIN majors  m ON up.major_id  = m.id
     JOIN degrees d ON up.degree_id = d.id
     WHERE up.university_id = ?
     ORDER BY m.field, m.name,
              FIELD(d.level,'undergraduate','graduate','doctoral','professional')`,
    [university_id]
  );

  res.json({ status: "success", programs });
});

/*
==================================
ADD PROGRAM TO UNIVERSITY (Admin)
==================================
Admin selects a major + degree combo that already exists
in major_allowed_degrees, and activates it for their uni.

Body: { major_id, degree_id }
*/
const addUniversityProgram = asyncHandler(async (req, res) => {
  const { university_id, id: adminId } = req.user;
  const { major_id, degree_id }        = req.body;

  if (!university_id) throw new AppError("Not linked to a university", 400);
  if (!major_id || !degree_id)
    throw new AppError("major_id and degree_id are required", 400);

  // ── Guard: the combo must be globally valid ──
  const [allowed] = await db.query(
    "SELECT id FROM major_allowed_degrees WHERE major_id = ? AND degree_id = ?",
    [major_id, degree_id]
  );
  if (allowed.length === 0)
    throw new AppError(
      "This degree is not academically valid for the selected major. " +
      "Check the allowed degrees list.",
      400
    );

  // ── Fetch names for logging / response ──
  const [[major]]  = await db.query("SELECT name FROM majors  WHERE id = ?", [major_id]);
  const [[degree]] = await db.query("SELECT name FROM degrees WHERE id = ?", [degree_id]);
  if (!major)  throw new AppError("Major not found",  404);
  if (!degree) throw new AppError("Degree not found", 404);

  // ── Check if already exists (might just be deactivated) ──
  const [existing] = await db.query(
    `SELECT id, is_active
     FROM university_programs
     WHERE university_id = ? AND major_id = ? AND degree_id = ?`,
    [university_id, major_id, degree_id]
  );

  if (existing.length > 0) {
    if (existing[0].is_active)
      throw new AppError(
        `"${degree.name} in ${major.name}" is already active for your university.`,
        400
      );

    // Reactivate
    await db.query(
      "UPDATE university_programs SET is_active = 1 WHERE id = ?",
      [existing[0].id]
    );

    await logAction({
      user_id:       adminId,
      university_id,
      action:        "ACTIVATE_PROGRAM",
      description:   `Reactivated: ${degree.name} in ${major.name}`,
      status:        "success",
      target_type:   "university",
      target_id:     university_id,
      ip_address:    req.ip,
    });

    return res.json({
      status:  "success",
      message: `${degree.name} in ${major.name} reactivated.`,
      id:      existing[0].id,
    });
  }

  // ── Insert new program ──
  const [result] = await db.query(
    `INSERT INTO university_programs (university_id, major_id, degree_id)
     VALUES (?, ?, ?)`,
    [university_id, major_id, degree_id]
  );

  await logAction({
    user_id:       adminId,
    university_id,
    action:        "ADD_PROGRAM",
    description:   `Added program: ${degree.name} in ${major.name}`,
    status:        "success",
    target_type:   "university",
    target_id:     university_id,
    ip_address:    req.ip,
  });

  res.status(201).json({
    status:  "success",
    message: `${degree.name} in ${major.name} added to your university.`,
    id:      result.insertId,
  });
});

/*
==================================
BULK ADD PROGRAMS (Admin)
==================================
Lets the admin activate several programs in one request.
Body: { programs: [{ major_id, degree_id }, ...] }
Useful for the initial setup wizard in the frontend.
*/
const bulkAddUniversityPrograms = asyncHandler(async (req, res) => {
  const { university_id, id: adminId } = req.user;
  const { programs }                   = req.body;

  if (!university_id) throw new AppError("Not linked to a university", 400);
  if (!Array.isArray(programs) || programs.length === 0)
    throw new AppError("programs must be a non-empty array", 400);
  if (programs.length > 100)
    throw new AppError("Maximum 100 programs per bulk request", 400);

  const results  = { added: 0, reactivated: 0, skipped: 0, errors: [] };
  const conn     = await db.getConnection();

  try {
    await conn.beginTransaction();

    for (const { major_id, degree_id } of programs) {
      if (!major_id || !degree_id) {
        results.errors.push({ major_id, degree_id, reason: "Missing major_id or degree_id" });
        continue;
      }

      // Check globally allowed
      const [allowed] = await conn.query(
        "SELECT id FROM major_allowed_degrees WHERE major_id = ? AND degree_id = ?",
        [major_id, degree_id]
      );
      if (allowed.length === 0) {
        results.errors.push({ major_id, degree_id, reason: "Not a valid degree for this major" });
        continue;
      }

      // Check existing
      const [existing] = await conn.query(
        `SELECT id, is_active FROM university_programs
         WHERE university_id = ? AND major_id = ? AND degree_id = ?`,
        [university_id, major_id, degree_id]
      );

      if (existing.length > 0) {
        if (existing[0].is_active) { results.skipped++;   continue; }
        await conn.query(
          "UPDATE university_programs SET is_active = 1 WHERE id = ?",
          [existing[0].id]
        );
        results.reactivated++;
      } else {
        await conn.query(
          "INSERT INTO university_programs (university_id, major_id, degree_id) VALUES (?, ?, ?)",
          [university_id, major_id, degree_id]
        );
        results.added++;
      }
    }

    await conn.commit();

    await logAction({
      user_id:       adminId,
      university_id,
      action:        "BULK_ADD_PROGRAMS",
      description:   `Bulk add: ${results.added} added, ${results.reactivated} reactivated, ${results.skipped} skipped`,
      status:        "success",
      target_type:   "university",
      target_id:     university_id,
      ip_address:    req.ip,
    });

    res.json({ status: "success", results });

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

/*
==================================
REMOVE PROGRAM FROM UNIVERSITY (Admin)
==================================
Soft-deletes (deactivates) so existing student records
that reference this major+degree are not orphaned.
*/
const removeUniversityProgram = asyncHandler(async (req, res) => {
  const { id }                   = req.params;
  const { university_id, id: adminId } = req.user;

  if (!university_id) throw new AppError("Not linked to a university", 400);

  // Verify ownership
  const [rows] = await db.query(
    `SELECT up.id, m.name AS major_name, d.name AS degree_name
     FROM university_programs up
     JOIN majors  m ON up.major_id  = m.id
     JOIN degrees d ON up.degree_id = d.id
     WHERE up.id = ? AND up.university_id = ?`,
    [id, university_id]
  );
  if (rows.length === 0)
    throw new AppError("Program not found or not owned by your university", 404);

  const { major_name, degree_name } = rows[0];

  // Soft delete
  await db.query(
    "UPDATE university_programs SET is_active = 0 WHERE id = ?",
    [id]
  );

  await logAction({
    user_id:       adminId,
    university_id,
    action:        "REMOVE_PROGRAM",
    description:   `Deactivated: ${degree_name} in ${major_name}`,
    status:        "success",
    target_type:   "university",
    target_id:     university_id,
    ip_address:    req.ip,
  });

  res.json({
    status:  "success",
    message: `${degree_name} in ${major_name} deactivated.`,
  });
});

/*
==================================
GET STAFF PROGRAMS (Staff + Admin)
==================================
Returns the list of active programs for the staff's
university. Used to populate the "Add Student" form
dropdowns — staff only sees what their uni offers.

Response shape:
{
  programs: [
    { major: "Computer Science", degree: "Bachelor", level: "undergraduate" },
    ...
  ]
}
*/
const getStaffPrograms = asyncHandler(async (req, res) => {
  const { university_id } = req.user;
  if (!university_id) throw new AppError("Not linked to a university", 400);

  const [programs] = await db.query(
    `SELECT
       m.name  AS major,
       d.name  AS degree,
       d.level
     FROM university_programs up
     JOIN majors  m ON up.major_id  = m.id
     JOIN degrees d ON up.degree_id = d.id
     WHERE up.university_id = ? AND up.is_active = 1
     ORDER BY m.name,
              FIELD(d.level,'undergraduate','graduate','doctoral','professional')`,
    [university_id]
  );

  res.json({ status: "success", programs });
});

module.exports = {
  getAllMajors,
  getAllDegrees,
  getDegreesForMajor,
  getUniversityPrograms,
  addUniversityProgram,
  bulkAddUniversityPrograms,
  removeUniversityProgram,
  getStaffPrograms,
};