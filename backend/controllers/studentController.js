// controllers/studentController.js

const db        = require("../config/db");
const logAction = require("../utils/auditLog");

/*
==================================
CONSTANTS & HELPERS
==================================
*/
const emailRegex        = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const lebanonPhoneRegex = /^(?:3|70|71|76|78|79|81|82|83|84|85|86|87|88|89)\d{6}$/;
const nationalIdRegex   = /^\d{6,12}$/;
const studentIdRegex    = /^\d{8}$/;
const fullNameRegex = /^[A-Za-z\s'-]+(?:\s[A-Za-z\s'-]+)*$/;
 

// Rejects future dates and calculates age
const parseAge = (dob) => {
  const birth = new Date(dob);
  const today = new Date();
  if (birth >= today) return NaN;
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

// Capitalises each word in a name
const formatName = (name) =>
  name.trim().split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

/*
==================================
HELPER — VALIDATE PROGRAM EXISTS
==================================
Checks that the requested degree + major combination is
active for the given university in university_programs.

Returns the degree's level ("undergraduate", "graduate",
"doctoral", "professional") on success, or an error string.
*/
const validateProgramExists = async (university_id, degree, major) => {
  const [rows] = await db.query(
    `SELECT d.level
     FROM university_programs up
     JOIN majors  m ON up.major_id  = m.id
     JOIN degrees d ON up.degree_id = d.id
     WHERE up.university_id = ?
       AND m.name  = ?
       AND d.name  = ?
       AND up.is_active = 1
     LIMIT 1`,
    [university_id, major, degree]
  );

  if (rows.length === 0) {
    return {
      error: `The program "${degree} in ${major}" is not offered by your university. ` +
             `Ask your admin to add it under Programs Management.`,
    };
  }

  return { level: rows[0].level };
};

/*
==================================
HELPER — DEGREE FLOW VALIDATION
==================================
Uses the degrees.level column to enforce the prerequisite
chain globally across ALL universities:

  undergraduate → no prerequisite
  graduate      → needs at least one undergraduate record
  doctoral      → needs at least one graduate record
  professional  → standalone (PharmD, MD, DDS, JD, DNP …)

Also enforces major consistency:
  graduate  → major must match one of the student's undergraduate majors
  doctoral  → major must match one of the student's graduate majors

Pass excludeRecordId when editing so the current record
is not counted against itself.
*/
const validateDegreeFlow = async (studentId, degree, major, excludeRecordId = null) => {

  // ── 1. Get the level of the requested degree ──
  const [degreeRows] = await db.query(
    "SELECT level FROM degrees WHERE name = ?",
    [degree]
  );

  const requestedLevel = degreeRows.length > 0 ? degreeRows[0].level : "undergraduate";

  // Professional and undergraduate degrees have no prerequisites
  if (requestedLevel === "professional" || requestedLevel === "undergraduate") {
    return null;
  }

  // ── 2. Fetch all existing INTERNAL records for this student ──
  const params = [studentId];
  let query = `
    SELECT sr.degree, sr.major,
           COALESCE(d.level, 'undergraduate') AS degree_level
    FROM student_records sr
    LEFT JOIN degrees d ON d.name COLLATE utf8mb4_general_ci = sr.degree
    WHERE sr.student_id = ?
  `;
  if (excludeRecordId) {
    query += " AND sr.id != ?";
    params.push(excludeRecordId);
  }
  const [internalRecords] = await db.query(query, params);

  // ── 2b. Fetch verified EXTERNAL (foreign) degrees for this student ──
  const [externalRecords] = await db.query(
  `SELECT ed.degree, ed.major,
          COALESCE(d.level, 'undergraduate') AS degree_level
   FROM external_degrees ed
   LEFT JOIN degrees d ON d.name COLLATE utf8mb4_general_ci = ed.degree
   WHERE ed.student_id = ?`,
  [studentId]
);

  // ── 2c. Combine both sources ──
  const allRecords = [...internalRecords, ...externalRecords];

  const hasUndergrad = allRecords.some(r => r.degree_level === "undergraduate");
  const hasGrad      = allRecords.some(r => r.degree_level === "graduate");

  // ── 3. Prerequisite check ──
  if (requestedLevel === "graduate" && !hasUndergrad) {
    return `Student must complete an undergraduate degree before enrolling in a ${degree} program.`;
  }

  if (requestedLevel === "doctoral" && !hasGrad) {
    return `Student must complete a graduate degree before enrolling in a ${degree} program.`;
  }

  // ── 4. Major consistency ──
  if (requestedLevel === "graduate" && hasUndergrad) {
    const undergradMajors = allRecords
      .filter(r => r.degree_level === "undergraduate")
      .map(r => r.major);

    if (undergradMajors.length > 0 && !undergradMajors.includes(major)) {
      return `${degree} major must match one of the student's undergraduate degree majors ` +
             `(${undergradMajors.join(", ")}).`;
    }
  }

  if (requestedLevel === "doctoral" && hasGrad) {
    const gradMajors = allRecords
      .filter(r => r.degree_level === "graduate")
      .map(r => r.major);

    if (gradMajors.length > 0 && !gradMajors.includes(major)) {
      return `${degree} major must match one of the student's graduate degree majors ` +
             `(${gradMajors.join(", ")}).`;
    }
  }

  return null; // all good
};

/*
==================================
HELPER — CERTIFICATE LOCK CHECK
==================================
Returns true if the student record has any certificates
(issued or revoked). Once issued, the record is locked.
*/
const hasCertificates = async (record_id) => {
  const [certs] = await db.query(
    "SELECT id FROM certificates WHERE student_record_id = ?",
    [record_id]
  );
  return certs.length > 0;
};

/*
==================================
ADD STUDENT
==================================
Staff adds a student to their university.

Changes from old version:
  • degree is no longer validated against a hardcoded array.
    It is validated against university_programs (DB).
  • major is no longer free-text. It must exactly match a
    major name that the university has activated.
  • validateDegreeFlow is now DB-driven (uses degrees.level).
*/
const addStudent = async (req, res) => {
  try {
    let {
      full_name,
      student_id,
      email,
      phone,
      national_id,
      date_of_birth,
      degree,
      major,
    } = req.body;

    const university_id = req.user.university_id;
    const created_by    = req.user.id;

    // ── STEP 1 — University guard ──
    if (!university_id) {
      return res.status(403).json({
        message: "Your account is not linked to any university.",
      });
    }

    // ── STEP 1B — Role guard (staff only) ──
    if (req.user.role !== "staff") {
      return res.status(403).json({
        message: "Only staff members can add student records.",
      });
    }

    // ── STEP 2 — Required fields ──
    const required = {
      national_id, full_name, date_of_birth,
      student_id, email, phone, major, degree,
    };
    const missing = Object.entries(required)
      .filter(([, v]) => v === undefined || v === null || String(v).trim() === "");
    if (missing.length > 0) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // ── STEP 3 — Format & validate personal fields ──
    full_name = formatName(full_name);
   if (!fullNameRegex.test(full_name)) {
      return res.status(400).json({
        message: "Full name must contain a first name and a family name.",
      });
    }
    if (full_name.trim().split(/\s+/).some(p => /(.)\1{3,}/.test(p)))
      return res.status(400).json({ message: "Full name does not appear to be valid." });

    national_id = national_id.trim();
    if (!nationalIdRegex.test(national_id)) {
      return res.status(400).json({ message: "National ID must be 6–12 digits." });
    }

    student_id = student_id.trim();
    if (!studentIdRegex.test(student_id)) {
      return res.status(400).json({
        message: "Student ID must be exactly 8 digits.",
      });
    }

    email = email.trim().toLowerCase();
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    phone = phone.trim();
    if (!lebanonPhoneRegex.test(phone)) {
      return res.status(400).json({
        message: "Invalid Lebanese phone number.",
      });
    }

    const age = parseAge(date_of_birth);
    if (isNaN(age)) {
      return res.status(400).json({ message: "Invalid date of birth." });
    }
    if (age < 17 || age > 100) {
      return res.status(400).json({ message: "Wrong date of birth." });
    }

    degree = degree.trim();
    major  = major.trim();

    // ── STEP 4 — Validate program against university_programs ──
    // This replaces the old hardcoded allowedDegrees check.
    // The degree AND major must both be active for this university.
    const programCheck = await validateProgramExists(university_id, degree, major);
    if (programCheck.error) {
      return res.status(400).json({ message: programCheck.error });
    }

    // ── STEP 5 — Check or create student record in students_new ──
    const [existingStudent] = await db.query(
      "SELECT * FROM students_new WHERE national_id = ?",
      [national_id]
    );

    let studentId;
    if (existingStudent.length > 0) {
      studentId = existingStudent[0].id;
    } else {
      const [newStudent] = await db.query(
        "INSERT INTO students_new (full_name, national_id, date_of_birth) VALUES (?, ?, DATE(?))",
        [full_name, national_id, date_of_birth]
      );
      studentId = newStudent.insertId;
    }

    // ── STEP 6 — Degree flow validation (DB-driven) ──
    const degreeError = await validateDegreeFlow(studentId, degree, major);
    if (degreeError) {
      return res.status(400).json({ message: degreeError });
    }


    // ── STEP 6B — Prevent adding if same degree+major exists in external_degrees ──
    const [extDuplicate] = await db.query(
      `SELECT id FROM external_degrees
       WHERE student_id = ?
         AND degree     = ?
         AND major      COLLATE utf8mb4_general_ci = ?`,
      [studentId, degree, major]
    );
    if (extDuplicate.length > 0) {
      return res.status(400).json({
        message: `This student already has an external ${degree} in "${major}" registered. ` +
                 `A duplicate internal record cannot be created.`,
      });
    }

    // ── STEP 7 — Prevent duplicate degree+major at any university ──
    const [existing] = await db.query(
      `SELECT id, university_id, degree, major
       FROM student_records
       WHERE student_id = ? AND degree = ? AND major = ?`,
      [studentId, degree, major]
    );
    if (existing.length > 0) {
      return res.status(400).json({
        message: "This student already has this degree and major registered.",
        conflict: {
          university_id: existing[0].university_id,
          degree:        existing[0].degree,
          major:         existing[0].major,
        },
      });
    }

    // ── STEP 8 — Insert student_record ──
    await db.query(
      `INSERT INTO student_records
       (student_id, university_id, created_by, student_code, email, phone, degree, major)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [studentId, university_id, created_by, student_id, email, phone, degree, major]
    );

    await logAction({
      user_id:       created_by,
      university_id,
      action:        "ADD_STUDENT",
      description:   `Added student ${full_name} (${degree} - ${major})`,
      status:        "success",
      target_type:   "student",
      target_id:     studentId,
      ip_address:    req.ip,
    });

    res.status(201).json({ message: "Student added successfully." });

  } catch (error) {
    console.error("ADD STUDENT ERROR:", error);

    if (error.code === "ER_DUP_ENTRY") {
      if (error.sqlMessage?.includes("unique_student_per_uni")) {
        return res.status(400).json({
          message:
            "This student code is already registered at your university. " +
            "Use a different student code.",
        });
      }
      if (error.sqlMessage?.includes("unique_email_per_uni")) {
        return res.status(400).json({
          message: "This email is already registered at your university.",
        });
      }
      return res.status(400).json({
        message: "Duplicate entry — this student record already exists.",
      });
    }

    res.status(500).json({ message: error.message });
  }
};

const getStudents = async (req, res) => {
  try {
    const university_id = req.user.university_id;

    if (!university_id) {
      return res.status(403).json({
        message: "Your account is not linked to any university.",
      });
    }

    const { search } = req.query;
    const searchTerm = search ? `%${search}%` : '%';

    const [rows] = await db.query(
      `SELECT
          sr.id           AS record_id,
          sn.id,
          sn.full_name,
          sr.university_id,
          sn.national_id,
          DATE_FORMAT(sn.date_of_birth, '%Y-%m-%d') AS date_of_birth,
          sr.student_code,
          sr.email,
          sr.phone,
          sr.degree,
          sr.major,
          sr.created_at  AS enrolled_at
       FROM students_new sn
       JOIN student_records sr ON sr.student_id = sn.id
       WHERE sr.university_id = ?
         AND (
           LOWER(sn.full_name) LIKE LOWER(?) OR 
           LOWER(sr.email) LIKE LOWER(?) OR 
           sn.national_id LIKE ? OR 
           sr.student_code LIKE ? OR
           LOWER(SUBSTRING_INDEX(sn.full_name, ' ', 1)) LIKE LOWER(?)
         )
       ORDER BY sn.full_name ASC, sr.created_at ASC`,
      [university_id, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]
    );

    res.json({ status: "success", students: rows });
  } catch (error) {
    console.error("GET STUDENTS ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

const getStudentByNationalId = async (req, res) => {
  try {
    const { national_id } = req.params;
    const university_id   = req.user.university_id;

    if (!university_id) {
      return res.status(403).json({
        message: "Your account is not linked to any university.",
      });
    }

    const [studentRows] = await db.query(
      `SELECT id, full_name, national_id,
              DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS date_of_birth
       FROM students_new WHERE national_id = ?`,
      [national_id]
    );

    if (studentRows.length === 0) return res.json({ exists: false });

    const student = studentRows[0];

    const [recordRows] = await db.query(
      `SELECT student_code, email, phone
       FROM student_records
       WHERE student_id = ? AND university_id = ?
       ORDER BY created_at DESC LIMIT 1`,
      [student.id, university_id]
    );

    res.json({
      exists:            true,
      in_university:     recordRows.length > 0,
      student: {
        full_name:     student.full_name,
        national_id:   student.national_id,
        date_of_birth: student.date_of_birth,
      },
      university_record: recordRows.length > 0 ? recordRows[0] : null,
    });

  } catch (error) {
    console.error("GET STUDENT BY NATIONAL ID ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};
/*
==================================
UPDATE STUDENT RECORD
==================================
Staff can update:
  student_records → email, phone, student_code, degree, major
  students_new    → full_name, date_of_birth

Rules (unchanged):
  - national_id is NEVER editable
  - If the record has issued certificates → fully locked
  - Degree changes follow the global flow (DB-driven)
  - Only records belonging to the user's university can be edited

NEW rule:
  - If degree or major changes, the new combination must exist
    in university_programs for this university.
*/
const updateStudent = async (req, res) => {
  try {
    const { record_id } = req.params;
    const university_id = req.user.university_id;

    // ── STEP 1 — University guard ──
    if (!university_id) {
      return res.status(403).json({
        message: "Your account is not linked to any university.",
      });
    }

    // ── STEP 1B — Role guard (staff only) ──
    if (req.user.role !== "staff") {
      return res.status(403).json({
        message: "Only staff members can edit student records.",
      });
    }

    let {
      email, phone, student_code,
      degree, major,
      full_name, date_of_birth,
    } = req.body;

    // ── STEP 2 — At least one field required ──
    if (!email && !phone && !student_code && !degree && !major &&
        !full_name && !date_of_birth) {
      return res.status(400).json({
        message: "Provide at least one field to update.",
      });
    }

    // ── STEP 3 — Verify record ownership ──
    const [recordRows] = await db.query(
      "SELECT id, student_id, degree, major FROM student_records WHERE id = ? AND university_id = ?",
      [record_id, university_id]
    );
    if (recordRows.length === 0) {
      return res.status(404).json({
        message: "Student record not found or does not belong to your university.",
      });
    }

    const { student_id: studentId, degree: currentDegree, major: currentMajor } = recordRows[0];

    // ── STEP 4 — Certificate lock ──
    const locked = await hasCertificates(record_id);
    if (locked) {
      return res.status(400).json({
        message:
          "This student record is locked because certificates have been issued. " +
          "No edits are allowed to prevent falsification.",
      });
    }

    // ── STEP 5 — If degree or major is changing, validate the new program ──
    const newDegree = degree ? degree.trim() : currentDegree;
    const newMajor  = major  ? major.trim()  : currentMajor;

    const programChanged = (degree && degree.trim() !== currentDegree) ||
                           (major  && major.trim()  !== currentMajor);

    if (programChanged) {
      // Validate new combo against university_programs
      const programCheck = await validateProgramExists(university_id, newDegree, newMajor);
      if (programCheck.error) {
        return res.status(400).json({ message: programCheck.error });
      }

      // Validate degree flow with the new values
      const degreeError = await validateDegreeFlow(
        studentId, newDegree, newMajor, record_id
      );
      if (degreeError) {
        return res.status(400).json({ message: degreeError });
      }
    }



    // ── STEP 5B — If program changed, check external_degrees for duplicate ──
    if (programChanged) {
      const [extDuplicate] = await db.query(
        `SELECT id FROM external_degrees
         WHERE student_id = ?
           AND degree     = ?
           AND major      COLLATE utf8mb4_general_ci = ?`,
        [studentId, newDegree, newMajor]
      );
      if (extDuplicate.length > 0) {
        return res.status(400).json({
          message: `This student already has an external ${newDegree} in "${newMajor}" registered. ` +
                   `Cannot update the record to duplicate it.`,
        });
      }
    }

    // ── STEP 6 — Update student_records ──
    const recordUpdates = [];
    const recordValues  = [];

    if (email) {
      email = email.trim().toLowerCase();
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format." });
      }
      recordUpdates.push("email = ?");
      recordValues.push(email);
    }

    if (phone) {
      phone = phone.trim();
      if (!lebanonPhoneRegex.test(phone)) {
        return res.status(400).json({
          message: "Invalid Lebanese phone number.",
        });
      }
      recordUpdates.push("phone = ?");
      recordValues.push(phone);
    }

    if (student_code) {
      student_code = student_code.trim();
      if (!studentIdRegex.test(student_code)) {
        return res.status(400).json({
          message: "Student code must be exactly 8 digits.",
        });
      }
      recordUpdates.push("student_code = ?");
      recordValues.push(student_code);
    }

    if (degree) {
      recordUpdates.push("degree = ?");
      recordValues.push(degree.trim());
    }

    if (major) {
      recordUpdates.push("major = ?");
      recordValues.push(major.trim());
    }

    if (recordUpdates.length > 0) {
      recordValues.push(record_id);
      await db.query(
        `UPDATE student_records SET ${recordUpdates.join(", ")} WHERE id = ?`,
        recordValues
      );
    }

    // ── STEP 7 — Update students_new ──
    const identityUpdates = [];
    const identityValues  = [];

    if (full_name) {
      full_name = formatName(full_name);
      if (!fullNameRegex.test(full_name)) {
        return res.status(400).json({
          message: "Full name must contain a first name and a family name.",
        });
      }
      identityUpdates.push("full_name = ?");
      identityValues.push(full_name);
    }

    if (date_of_birth) {
      const age = parseAge(date_of_birth);
      if (isNaN(age)) {
        return res.status(400).json({ message: "Invalid date of birth." });
      }
      if (age < 17 || age > 100) {
        return res.status(400).json({ message: "Wrong date of birth." });
      }
      identityUpdates.push("date_of_birth = DATE(?)");
      identityValues.push(date_of_birth);
    }

    if (identityUpdates.length > 0) {
      identityValues.push(studentId);
      await db.query(
        `UPDATE students_new SET ${identityUpdates.join(", ")} WHERE id = ?`,
        identityValues
      );
    }

    await logAction({
      user_id:       req.user.id,
      university_id,
      action:        "UPDATE_STUDENT",
      description:   `Updated student record ID ${record_id}`,
      status:        "success",
      target_type:   "student",
      target_id:     parseInt(record_id),
      ip_address:    req.ip,
    });

    res.json({ status: "success", message: "Student record updated successfully." });

  } catch (error) {
    console.error("UPDATE STUDENT ERROR:", error);

    if (error.code === "ER_DUP_ENTRY") {
      if (error.sqlMessage?.includes("unique_email_per_uni")) {
        return res.status(400).json({
          message: "This email is already registered at your university.",
        });
      }
      if (error.sqlMessage?.includes("unique_student_per_uni")) {
        return res.status(400).json({
          message: "This student code is already registered at your university.",
        });
      }
    }

    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  addStudent,
  getStudents,
  getStudentByNationalId,
  updateStudent,
};