const db = require("../config/db");

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
    // STEP 0 — VALIDATION
    // ================================
    const emailRegex        = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const lebanonPhoneRegex = /^(?:3|70|71|76|78|79|81|82|83|84|85|86|87|88|89)\d{6}$/;
    const nationalIdRegex   = /^\d{6,12}$/;
    const studentIdRegex    = /^\d{8}$/;
    const fullNameRegex     = /^[A-Za-z]+(?:\s[A-Za-z]+)+$/;

    const parseAge = (dob) => {
      const birth = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      return age;
    };

    const required = { national_id, full_name, date_of_birth, student_id, email, phone, major, degree };
    const missing  = Object.entries(required).filter(([, v]) => v === undefined || v === null || String(v).trim() === "");
    if (missing.length > 0) return res.status(400).json({ message: "All fields are required" });

    full_name = full_name.trim().split(" ")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

    if (!fullNameRegex.test(full_name))
      return res.status(400).json({ message: "Full name must contain first name and family name" });

    if (!studentIdRegex.test(student_id))
      return res.status(400).json({ message: "Student ID must be exactly 8 digits" });

    email = email.trim().toLowerCase();
    if (!emailRegex.test(email))
      return res.status(400).json({ message: "Invalid email format" });

    phone = phone.trim();
    if (!lebanonPhoneRegex.test(phone))
      return res.status(400).json({ message: "Invalid Lebanese phone number" });

    if (!nationalIdRegex.test(national_id))
      return res.status(400).json({ message: "National ID must be 6–12 digits" });

    const age = parseAge(date_of_birth);
    if (isNaN(age)) return res.status(400).json({ message: "Invalid date of birth" });
    if (age < 17 || age > 100) return res.status(400).json({ message: "Wrong date of birth" });
    
    degree = degree.trim();
    major = major.trim().toLowerCase();
    major = major.charAt(0).toUpperCase() + major.slice(1);

    // ================================
    // STEP 1: CHECK OR CREATE STUDENT
    // ================================
    const [existingStudent] = await db.query(
      "SELECT * FROM students_new WHERE national_id = ?", [national_id]
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
    // STEP 2 — GLOBAL DEGREE VALIDATION
    // ================================
    const [allRecords] = await db.query(
  "SELECT degree, major FROM student_records WHERE student_id = ?",
  [studentId]
);

const hasBachelor = allRecords.some(r => r.degree === "Bachelor");
const hasMaster   = allRecords.some(r => r.degree === "Master");

// ======================
// STEP 1 — DEGREE FLOW
// ======================
if (degree === "Master" && !hasBachelor) {
  return res.status(400).json({
    message: "Student must have a Bachelor degree before Master"
  });
}

if (degree === "PhD" && !hasMaster) {
  return res.status(400).json({
    message: "Student must have a Master degree before PhD"
  });
}

// ======================
// STEP 2 — MAJOR CONSISTENCY
// ======================
const bachelorMajors = allRecords
  .filter(r => r.degree === "Bachelor")
  .map(r => r.major);

const masterMajors = allRecords
  .filter(r => r.degree === "Master")
  .map(r => r.major);

// Master check
if (degree === "Master" && bachelorMajors.length > 0) {
  if (!bachelorMajors.includes(major)) {
    return res.status(400).json({
      message: "Master major must match at least one Bachelor major"
    });
  }
}

// PhD check
if (degree === "PhD" && masterMajors.length > 0) {
  if (!masterMajors.includes(major)) {
    return res.status(400).json({
      message: "PhD major must match at least one Master major"
    });
  }
}

const [existing] = await db.query(
  `SELECT id, university_id, degree, major
   FROM student_records
   WHERE student_id = ? AND degree = ? AND major = ?`,
  [studentId, degree, major]
);

if (existing.length > 0) {
  return res.status(400).json({
    message: "This student already has this degree and major in another university.",
    conflict: {
      university_id: existing[0].university_id,
      degree: existing[0].degree,
      major: existing[0].major
    }
  });
}
    // ================================
    // STEP 4 — INSERT RECORD
    // ================================
    await db.query(
      `INSERT INTO student_records
       (student_id, university_id, created_by, student_code, email, phone, degree, major)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [studentId, university_id, created_by, student_id, email, phone, degree, major]
    );

    res.status(201).json({ message: "Student added successfully" });

  } catch (error) {
    console.error(error);

    // Friendly messages for known DB constraint violations
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


// ==========================
// GET STUDENTS
// ==========================
const getStudents = async (req, res) => {
  try {
    const university_id = req.user.university_id;
    console.log("Current university:", university_id); // 👈 ADD THIS
    const [rows] = await db.query(
      `SELECT
        sr.id        AS record_id,
        sn.id,
        sn.full_name,
        sr.university_id,   -- 👈 ADD THIS
        sn.national_id,
        sn.date_of_birth,
        sr.student_code,
        sr.email,
        sr.phone,
        sr.degree,
        sr.major,
        sr.created_at AS enrolled_at
      FROM students_new sn
      JOIN student_records sr ON sr.student_id = sn.id
      WHERE sr.university_id = ?
      ORDER BY sn.full_name ASC, sr.created_at ASC`,
      [university_id]
    );
    console.log("Returned rows:", rows); // 👈 ADD THIS
    res.json({ status: "success", students: rows });
  } catch (error) {
    console.error("GET STUDENTS ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// ==========================
// AUTO-FILL (enhanced)
// ==========================
// Returns one of three states:
//   { exists: false }
//   { exists: true, in_university: false, student: {...} }
//   { exists: true, in_university: true,  student: {...}, university_record: {...} }
// ==========================
const getStudentByNationalId = async (req, res) => {
  try {
    const { national_id } = req.params;
    const university_id   = req.user.university_id;

    const [studentRows] = await db.query(
      "SELECT id, full_name, national_id, date_of_birth FROM students_new WHERE national_id = ?",
      [national_id]
    );

    if (studentRows.length === 0) return res.json({ exists: false });

    const student = studentRows[0];

    // Check if enrolled at this university
    const [recordRows] = await db.query(
      `SELECT student_code, email, phone
       FROM student_records
       WHERE student_id = ? AND university_id = ?
       ORDER BY created_at DESC LIMIT 1`,
      [student.id, university_id]
    );

    res.json({
      exists:        true,
      in_university: recordRows.length > 0,
      student: {
        full_name:     student.full_name,
        national_id:   student.national_id,
        date_of_birth: student.date_of_birth,
      },
      university_record: recordRows.length > 0 ? recordRows[0] : null,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { addStudent, getStudents, getStudentByNationalId };