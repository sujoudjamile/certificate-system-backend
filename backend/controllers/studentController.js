const db = require("../config/db");
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
const fullNameRegex     = /^[A-Za-z]+(?:\s[A-Za-z]+)+$/;
const allowedDegrees    = ["Bachelor", "Master", "PhD"];

// Rejects future dates and calculates age
const parseAge = (dob) => {
  const birth = new Date(dob);
  const today = new Date();
  if (birth >= today) return NaN; // future date
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

// Capitalizes each word in a name
const formatName = (name) =>
  name.trim().split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

// Capitalizes first letter of major
const formatMajor = (major) => {
  major = major.trim().toLowerCase();
  return major.charAt(0).toUpperCase() + major.slice(1);
};

/*
==================================
SHARED HELPER — DEGREE FLOW VALIDATION
==================================
Checks that the degree progression is valid
globally across ALL universities.

- Master requires a Bachelor somewhere
- PhD requires a Master somewhere
- Also checks major consistency between degrees

Pass excludeRecordId when editing so the current
record is not counted against itself.
*/
const validateDegreeFlow = async (studentId, degree, major, excludeRecordId = null) => {
  let query = "SELECT degree, major FROM student_records WHERE student_id = ?";
  const params = [studentId];

  if (excludeRecordId) {
    query += " AND id != ?";
    params.push(excludeRecordId);
  }

  const [allRecords] = await db.query(query, params);

  const hasBachelor = allRecords.some(r => r.degree === "Bachelor");
  const hasMaster   = allRecords.some(r => r.degree === "Master");

  if (degree === "Master" && !hasBachelor) {
    return "Student must have a Bachelor degree before enrolling in a Master program";
  }

  if (degree === "PhD" && !hasMaster) {
    return "Student must have a Master degree before enrolling in a PhD program";
  }

  const bachelorMajors = allRecords.filter(r => r.degree === "Bachelor").map(r => r.major);
  const masterMajors   = allRecords.filter(r => r.degree === "Master").map(r => r.major);

  if (degree === "Master" && bachelorMajors.length > 0) {
    if (!bachelorMajors.includes(major)) {
      return "Master major must match at least one of the student's Bachelor majors";
    }
  }

  if (degree === "PhD" && masterMajors.length > 0) {
    if (!masterMajors.includes(major)) {
      return "PhD major must match at least one of the student's Master majors";
    }
  }

  return null; // no error
};

/*
==================================
SHARED HELPER — CERTIFICATE LOCK CHECK
==================================
Returns true if the student record has
any issued (non-revoked) certificates.
Once a certificate is issued, the record
is locked — no edits or deletions allowed.
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
      major
    } = req.body;

    const university_id = req.user.university_id;
    const created_by    = req.user.id;

    // ================================
    // STEP 1 — UNIVERSITY GUARD
    // ================================
    if (!university_id) {
      return res.status(403).json({ message: "Your account is not linked to any university" });
    }

    // ================================
    // STEP 1B — ROLE GUARD (staff only)
    // ================================
    if (req.user.role !== "staff") {
      return res.status(403).json({
        message: "Only staff members can add student records."
      });
    }

    // ================================
    // STEP 2 — REQUIRED FIELDS
    // ================================
    const required = { national_id, full_name, date_of_birth, student_id, email, phone, major, degree };
    const missing  = Object.entries(required).filter(([, v]) => v === undefined || v === null || String(v).trim() === "");
    if (missing.length > 0) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // ================================
    // STEP 3 — FORMAT & VALIDATE
    // ================================
    full_name = formatName(full_name);
    if (!fullNameRegex.test(full_name)) {
      return res.status(400).json({ message: "Full name must contain first name and family name" });
    }

    national_id = national_id.trim();
    if (!nationalIdRegex.test(national_id)) {
      return res.status(400).json({ message: "National ID must be 6–12 digits" });
    }

    student_id = student_id.trim();
    if (!studentIdRegex.test(student_id)) {
      return res.status(400).json({ message: "Student ID must be exactly 8 digits" });
    }

    email = email.trim().toLowerCase();
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    phone = phone.trim();
    if (!lebanonPhoneRegex.test(phone)) {
      return res.status(400).json({ message: "Invalid Lebanese phone number" });
    }

    const age = parseAge(date_of_birth);
    if (isNaN(age)) return res.status(400).json({ message: "Invalid date of birth" });
    if (age < 17 || age > 100) return res.status(400).json({ message: "Wrong date of birth" });

    degree = degree.trim();
    if (!allowedDegrees.includes(degree)) {
      return res.status(400).json({ message: "Degree must be Bachelor, Master, or PhD" });
    }

    major = formatMajor(major);

    // ================================
    // STEP 4 — CHECK OR CREATE STUDENT
    // ================================
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

    // ================================
    // STEP 5 — DEGREE FLOW VALIDATION
    // ================================
    const degreeError = await validateDegreeFlow(studentId, degree, major);
    if (degreeError) {
      return res.status(400).json({ message: degreeError });
    }

    // ================================
    // STEP 6 — PREVENT DUPLICATE DEGREE
    // ================================
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
        }
      });
    }

    // ================================
    // STEP 7 — INSERT RECORD
    // ================================
    await db.query(
      `INSERT INTO student_records
       (student_id, university_id, created_by, student_code, email, phone, degree, major)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [studentId, university_id, created_by, student_id, email, phone, degree, major]
    );

    await logAction({
      user_id:       created_by,
      university_id: university_id,
      action:        "ADD_STUDENT",
      description:   `Added student ${full_name} (${degree} - ${major})`,
      status:        "success",
      target_type:   "student",
      target_id:     studentId,
      ip_address:    req.ip,
    });

    res.status(201).json({ message: "Student added successfully" });

  } catch (error) {
    console.error("ADD STUDENT ERROR:", error);

    if (error.code === "ER_DUP_ENTRY") {
      if (error.sqlMessage?.includes("unique_student_per_uni")) {
        return res.status(400).json({
          message: "This student code is already registered at your university. Use a different student code.",
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


/*
==================================
GET STUDENTS
==================================
Returns all students enrolled at the
logged-in user's university.
*/
const getStudents = async (req, res) => {
  try {
    const university_id = req.user.university_id;

    if (!university_id) {
      return res.status(403).json({ message: "Your account is not linked to any university" });
    }

    const [rows] = await db.query(
      `SELECT
        sr.id          AS record_id,
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
      ORDER BY sn.full_name ASC, sr.created_at ASC`,
      [university_id]
    );

    res.json({ status: "success", students: rows });
  } catch (error) {
    console.error("GET STUDENTS ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};


/*
==================================
AUTO-FILL BY NATIONAL ID
==================================
Returns one of three states:
  { exists: false }
  { exists: true, in_university: false, student: {...} }
  { exists: true, in_university: true,  student: {...}, university_record: {...} }
*/
const getStudentByNationalId = async (req, res) => {
  try {
    const { national_id } = req.params;
    const university_id   = req.user.university_id;

    if (!university_id) {
      return res.status(403).json({ message: "Your account is not linked to any university" });
    }

    const [studentRows] = await db.query(
      "SELECT id, full_name, national_id, DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS date_of_birth FROM students_new WHERE national_id = ?",
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
Staff and admin can update:
  student_records → email, phone, student_code, degree, major
  students_new    → full_name, date_of_birth

Rules:
  - national_id is NEVER editable
  - If the record has issued certificates → fully locked, no edits allowed
  - Degree changes follow the global Bachelor → Master → PhD flow
  - Only records belonging to the user's university can be edited
*/
const updateStudent = async (req, res) => {
  try {
    const { record_id } = req.params;
    const university_id = req.user.university_id;

    // ================================
    // STEP 1 — UNIVERSITY GUARD
    // ================================
    if (!university_id) {
      return res.status(403).json({ message: "Your account is not linked to any university" });
    }

    // ================================
    // STEP 1B — ROLE GUARD (staff only)
    // ================================
    if (req.user.role !== "staff") {
      return res.status(403).json({
        message: "Only staff members can edit student records."
      });
    }

    let { email, phone, student_code, degree, major, full_name, date_of_birth } = req.body;

    // ================================
    // STEP 2 — AT LEAST ONE FIELD
    // ================================
    if (!email && !phone && !student_code && !degree && !major && !full_name && !date_of_birth) {
      return res.status(400).json({ message: "Provide at least one field to update" });
    }

    // ================================
    // STEP 3 — VERIFY RECORD OWNERSHIP
    // ================================
    const [recordRows] = await db.query(
      "SELECT id, student_id FROM student_records WHERE id = ? AND university_id = ?",
      [record_id, university_id]
    );

    if (recordRows.length === 0) {
      return res.status(404).json({
        message: "Student record not found or does not belong to your university"
      });
    }

    const studentId = recordRows[0].student_id;

    // ================================
    // STEP 4 — CERTIFICATE LOCK
    // Nobody can edit a student record once certificates
    // have been issued — prevents data falsification.
    // Admin can only revoke certificates, not edit student data.
    // ================================
    const locked = await hasCertificates(record_id);
    if (locked) {
      return res.status(400).json({
        message: "This student record is locked because certificates have been issued. No edits are allowed to prevent falsification."
      });
    }

    // ================================
    // STEP 5 — DEGREE FLOW VALIDATION
    // ================================
    if (degree) {
      degree = degree.trim();
      if (!allowedDegrees.includes(degree)) {
        return res.status(400).json({ message: "Degree must be Bachelor, Master, or PhD" });
      }

      // Use current major if major is not being updated
      let majorToCheck = major ? formatMajor(major) : null;

      if (majorToCheck) {
        const degreeError = await validateDegreeFlow(studentId, degree, majorToCheck, record_id);
        if (degreeError) {
          return res.status(400).json({ message: degreeError });
        }
      }
    }

    // ================================
    // STEP 6 — UPDATE student_records
    // ================================
    const recordUpdates = [];
    const recordValues  = [];

    if (email) {
      email = email.trim().toLowerCase();
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }
      recordUpdates.push("email = ?");
      recordValues.push(email);
    }

    if (phone) {
      phone = phone.trim();
      if (!lebanonPhoneRegex.test(phone)) {
        return res.status(400).json({ message: "Invalid Lebanese phone number" });
      }
      recordUpdates.push("phone = ?");
      recordValues.push(phone);
    }

    if (student_code) {
      student_code = student_code.trim();
      if (!studentIdRegex.test(student_code)) {
        return res.status(400).json({ message: "Student code must be exactly 8 digits" });
      }
      recordUpdates.push("student_code = ?");
      recordValues.push(student_code);
    }

    if (degree) {
      recordUpdates.push("degree = ?");
      recordValues.push(degree);
    }

    if (major) {
      major = formatMajor(major);
      recordUpdates.push("major = ?");
      recordValues.push(major);
    }

    if (recordUpdates.length > 0) {
      recordValues.push(record_id);
      await db.query(
        `UPDATE student_records SET ${recordUpdates.join(", ")} WHERE id = ?`,
        recordValues
      );
    }

    // ================================
    // STEP 7 — UPDATE students_new
    // ================================
    const identityUpdates = [];
    const identityValues  = [];

    if (full_name) {
      full_name = formatName(full_name);
      if (!fullNameRegex.test(full_name)) {
        return res.status(400).json({ message: "Full name must contain first name and family name" });
      }
      identityUpdates.push("full_name = ?");
      identityValues.push(full_name);
    }

    if (date_of_birth) {
      const age = parseAge(date_of_birth);
      if (isNaN(age)) return res.status(400).json({ message: "Invalid date of birth" });
      if (age < 17 || age > 100) return res.status(400).json({ message: "Wrong date of birth" });
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
      university_id: university_id,
      action:        "UPDATE_STUDENT",
      description:   `Updated student record ID ${record_id}`,
      status:        "success",
      target_type:   "student",
      target_id:     parseInt(record_id),
      ip_address:    req.ip,
    });

    res.json({ status: "success", message: "Student record updated successfully" });

  } catch (error) {
    console.error("UPDATE STUDENT ERROR:", error);

    if (error.code === "ER_DUP_ENTRY") {
      if (error.sqlMessage?.includes("unique_email_per_uni")) {
        return res.status(400).json({ message: "This email is already registered at your university." });
      }
      if (error.sqlMessage?.includes("unique_student_per_uni")) {
        return res.status(400).json({ message: "This student code is already registered at your university." });
      }
    }

    res.status(500).json({ message: error.message });
  }
};



module.exports = { addStudent, getStudents, getStudentByNationalId, updateStudent };