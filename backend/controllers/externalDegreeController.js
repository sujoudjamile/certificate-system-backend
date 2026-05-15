const db = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const logAction = require("../utils/auditLog");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ── Helper: checks if a string looks like real words ──
const looksReal = (str) => {
  const letters = str.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 3) return false;
  const vowels = letters.match(/[aeiouAEIOU]/g) || [];
  return vowels.length / letters.length >= 0.15;
};

// ── File upload config ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/external_degrees";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `ext_degree_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".jpg", ".jpeg", ".png"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext))
      return cb(new Error("Only PDF and image files are accepted"), false);
    cb(null, true);
  },
});

/*
==================================
ADD EXTERNAL DEGREE
==================================
Admin only. Manually verified foreign degree.
*/
const addExternalDegree = asyncHandler(async (req, res) => {
  const {
    national_id,
    full_name,
    date_of_birth,
    degree,
    major,
    institution,
    country,
    graduation_year,
    notes,
  } = req.body;

  const verified_by   = req.user.id;
  const university_id = req.user.university_id;

  // ── Required base fields ──
  if (!national_id || !degree || !major || !institution || !country || !graduation_year)
    throw new AppError(
      "national_id, degree, major, institution, country and graduation_year are required",
      400
    );

  if (!["Bachelor", "Master"].includes(degree))
    throw new AppError("External degree must be Bachelor or Master", 400);

  // ── Institution name validation ──
  if (!/^[A-Za-z\s\-'.]+$/.test(institution.trim()))
  throw new AppError("Institution name must contain letters only.", 400);
if (institution.trim().length < 5)
  throw new AppError("Please enter a valid institution name.", 400);
if (!looksReal(institution))
  throw new AppError("Please enter a valid institution name.", 400);

  // ── Country validation ──
  if (!/^[A-Za-z\s\-']+$/.test(country.trim()))
  throw new AppError("Country name must contain letters only.", 400);
if (country.trim().length < 3)
  throw new AppError("Please enter a valid country name.", 400);
if (!looksReal(country))
  throw new AppError("Please enter a valid country name.", 400);

  // ── Graduation year validation ──
  const currentYear = new Date().getFullYear();
  const gradYear    = parseInt(graduation_year);
  if (isNaN(gradYear) || gradYear < 1950 || gradYear > currentYear) {
    throw new AppError(
      `Graduation year must be a valid year between 1950 and ${currentYear}.`,
      400
    );
  }

  // ── Step 1: Look up student by national_id ──
  const [studentRows] = await db.query(
    "SELECT id, full_name FROM students_new WHERE national_id = ?",
    [national_id]
  );

  let studentId;

  if (studentRows.length > 0) {
    studentId = studentRows[0].id;
  } else {
    if (!full_name || !date_of_birth)
      throw new AppError(
        "Student not found. Please provide full_name and date_of_birth to register them.",
        404
      );

   if (!/^\d{6,12}$/.test(national_id))
      throw new AppError("National ID must be 6–12 digits.", 400);

    // ── Age validation ──
    const birth = new Date(date_of_birth);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    if (isNaN(age) || birth >= today) throw new AppError("Invalid date of birth.", 400);
    if (age < 21) throw new AppError("Student must be at least 21 years old.", 400);
    if (age > 100) throw new AppError("Invalid date of birth.", 400);

    // ── Full name validation ──
      const nameParts = full_name.trim().split(/\s+/);
      if (nameParts.length < 2)
      throw new AppError("Please enter a full name (first and last name).", 400);
      if (nameParts.some(p => p.length < 2))
      throw new AppError("Each part of the name must be at least 2 characters.", 400);
      if (!/^[A-Za-z\s'-]+$/.test(full_name.trim()))
      throw new AppError("Full name must contain letters only.", 400);
      if (!looksReal(full_name))
      throw new AppError("Full name does not appear to be valid.", 400);

    const [newStudent] = await db.query(
      "INSERT INTO students_new (full_name, national_id, date_of_birth) VALUES (?, ?, DATE(?))",
      [full_name.trim(), national_id.trim(), date_of_birth]
    );
    studentId = newStudent.insertId;
  }

  // ── Step 2: Degree flow + duplicate validation ──

  // 2a. Determine the level of the degree being added
  const degreeLevel = degree === "Master" ? "graduate" : "undergraduate";

  // 2b. If adding a Master, enforce prerequisite Bachelor in same major
  if (degreeLevel === "graduate") {

    // Check external_degrees for a Bachelor in same major
    const [extPrereq] = await db.query(
      `SELECT id FROM external_degrees
       WHERE student_id = ? AND degree = 'Bachelor' AND major = ?`,
      [studentId, major.trim()]
    );

    // Check student_records for an undergraduate in same major
    const [intPrereq] = await db.query(
      `SELECT sr.id
       FROM student_records sr
       JOIN degrees d ON d.name COLLATE utf8mb4_general_ci = sr.degree
       WHERE sr.student_id = ?
         AND sr.major      = ?
         AND d.level       = 'undergraduate'`,
      [studentId, major.trim()]
    );

    if (extPrereq.length === 0 && intPrereq.length === 0) {
      throw new AppError(
        `Cannot register a Master's degree in "${major}" without a prior Bachelor's degree ` +
        `in the same major. Please register the Bachelor's degree first.`,
        400
      );
    }
  }

  // 2c. Prevent duplicate in external_degrees
  const [extDuplicate] = await db.query(
    `SELECT id FROM external_degrees
     WHERE student_id = ? AND degree = ? AND major = ?`,
    [studentId, degree, major.trim()]
  );
  if (extDuplicate.length > 0) {
    throw new AppError(
      `This student already has an external ${degree} in "${major}" registered.`,
      409
    );
  }

  // 2d. Prevent duplicate in student_records
  const [intDuplicate] = await db.query(
    `SELECT sr.id
     FROM student_records sr
     JOIN degrees d ON d.name COLLATE utf8mb4_general_ci = sr.degree
     WHERE sr.student_id = ?
       AND sr.major      = ?
       AND d.level       = ?`,
    [studentId, major.trim(), degreeLevel]
  );
  if (intDuplicate.length > 0) {
    throw new AppError(
      `This student already has an internal ${degree} in "${major}" recorded in the system.`,
      409
    );
  }

  // ── Step 3: Insert external degree ──
  const document_path = req.file ? req.file.path : null;

  const [result] = await db.query(
    `INSERT INTO external_degrees
     (student_id, degree, major, institution, country, graduation_year,
      verified_by, document_path, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      studentId,
      degree,
      major.trim(),
      institution.trim(),
      country.trim(),
      graduation_year,
      verified_by,
      document_path,
      notes || null,
    ]
  );

  await logAction({
    user_id:       verified_by,
    university_id: university_id,
    action:        "ADD_EXTERNAL_DEGREE",
    description:   `Admin added external ${degree} in ${major} from ${institution}, ${country} for student national ID ${national_id}`,
    status:        "success",
    target_type:   "student",
    target_id:     studentId,
    ip_address:    req.ip,
  });

  return res.status(201).json({
    status:     "success",
    message:    "External degree added successfully",
    id:         result.insertId,
    student_id: studentId,
  });
});

/*
==================================
GET ALL EXTERNAL DEGREES
==================================
Returns all external degrees for the admin's university context.
Since external degrees are global (not per university), we return
all of them with student info.
*/
const getAllExternalDegrees = asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `SELECT
       ed.id,
       ed.degree,
       ed.major,
       ed.institution,
       ed.country,
       ed.graduation_year,
       ed.notes,
       ed.verified_at,
       sn.full_name    AS student_name,
       sn.national_id,
       u.name          AS verified_by_name
     FROM external_degrees ed
     JOIN students_new sn ON ed.student_id  = sn.id
     JOIN users        u  ON ed.verified_by = u.id
     ORDER BY ed.verified_at DESC`
  );

  return res.json({ status: "success", external_degrees: rows });
});

/*
==================================
GET EXTERNAL DEGREES FOR A STUDENT
==================================
*/
const getExternalDegrees = asyncHandler(async (req, res) => {
  const { student_id } = req.params;

  const [rows] = await db.query(
    `SELECT ed.*, u.name AS verified_by_name
     FROM external_degrees ed
     JOIN users u ON ed.verified_by = u.id
     WHERE ed.student_id = ?
     ORDER BY ed.verified_at DESC`,
    [student_id]
  );

  return res.json({ status: "success", external_degrees: rows });
});

/*
==================================
DELETE EXTERNAL DEGREE
==================================
Admin only. Only if no certificate issued yet.
*/
const deleteExternalDegree = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { university_id } = req.user;

  const [rows] = await db.query(
    "SELECT * FROM external_degrees WHERE id = ?", [id]
  );
  if (rows.length === 0)
    throw new AppError("External degree record not found", 404);

  const record = rows[0];

  // Delete document file if exists
  if (record.document_path && fs.existsSync(record.document_path)) {
    fs.unlinkSync(record.document_path);
  }

  await db.query("DELETE FROM external_degrees WHERE id = ?", [id]);

  await logAction({
    user_id:       req.user.id,
    university_id: university_id,
    action:        "DELETE_EXTERNAL_DEGREE",
    description:   `Deleted external degree record ID ${id} for student ID ${record.student_id}`,
    status:        "success",
    target_type:   "student",
    target_id:     record.student_id,
    ip_address:    req.ip,
  });

  return res.json({ status: "success", message: "External degree record deleted" });
});

/*
==================================
LOOKUP STUDENT BY NATIONAL ID
==================================
Returns student info if found, or signals "not found"
so the frontend can ask for full_name and date_of_birth.
*/
const lookupStudentByNationalId = asyncHandler(async (req, res) => {
  const { national_id } = req.params;

  const [rows] = await db.query(
    `SELECT id, full_name,
            DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS date_of_birth
     FROM students_new
     WHERE national_id = ?`,
    [national_id]
  );

  if (rows.length === 0) {
    return res.json({ found: false });
  }

  return res.json({
    found:   true,
    student: {
      id:            rows[0].id,
      full_name:     rows[0].full_name,
      date_of_birth: rows[0].date_of_birth,
    },
  });
});

module.exports = {
  addExternalDegree,
  getExternalDegrees,
  deleteExternalDegree,
  lookupStudentByNationalId,
  getAllExternalDegrees,
  upload,
};