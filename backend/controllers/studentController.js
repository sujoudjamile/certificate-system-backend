const db = require("../config/db");

/*
==================================
ADD STUDENT
==================================
*/
const addStudent = async (req, res) => {
  try {
    const {
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
    const created_by = req.user.id;

    // ================================
    // STEP 1: CHECK OR CREATE STUDENT
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
        `INSERT INTO students_new 
        (full_name, national_id, date_of_birth)
        VALUES (?, ?, DATE(?))`,
        [full_name, national_id, date_of_birth]
      );

      studentId = newStudent.insertId;
    }

    // =====================================
    // STEP 2 — GLOBAL RECORDS (ALL UNIVERSITIES)
    // =====================================
    const [allRecords] = await db.query(
      "SELECT degree FROM student_records WHERE student_id = ?",
      [studentId]
    );

    // =====================================
    // 🔥 GLOBAL DEGREE VALIDATION
    // =====================================
    const hasBachelor = allRecords.some(r => r.degree === "Bachelor");
    const hasMaster = allRecords.some(r => r.degree === "Master");

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

    // =====================================
    // STEP 3 — PER UNIVERSITY RECORDS
    // =====================================
    const [records] = await db.query(
      "SELECT * FROM student_records WHERE student_id = ? AND university_id = ?",
      [studentId, university_id]
    );

    // =====================================
    // STEP 4 — DEGREE PROGRESSION (PER UNI)
    // =====================================
    const degreeOrder = ["Bachelor", "Master", "PhD"];

    const highestDegree = records
      .map(r => r.degree)
      .sort((a, b) => degreeOrder.indexOf(b) - degreeOrder.indexOf(a))[0];

    if (highestDegree) {
      const currentIndex = degreeOrder.indexOf(highestDegree);
      const newIndex = degreeOrder.indexOf(degree);

      if (newIndex < currentIndex) {
        return res.status(400).json({
          message: `Cannot downgrade from ${highestDegree} to ${degree}`
        });
      }

      if (newIndex === currentIndex) {
        return res.status(400).json({
          message: `Student already has a ${degree} degree in this university`
        });
      }
    }

    // =====================================
    // STEP 5 — MAJOR VALIDATION
    // =====================================
    if (degree === "Master") {
      const bachelor = records.find(r => r.degree === "Bachelor");
      if (bachelor && bachelor.major !== major) {
        return res.status(400).json({
          message: "Master must match Bachelor major"
        });
      }
    }

    if (degree === "PhD") {
      const master = records.find(r => r.degree === "Master");
      if (master && master.major !== major) {
        return res.status(400).json({
          message: "PhD must match Master major"
        });
      }
    }

    // =====================================
    // STEP 6 — INSERT RECORD
    // =====================================
    await db.query(
      `INSERT INTO student_records 
      (student_id, university_id, created_by, student_code, email, phone, degree, major)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        studentId,
        university_id,
        created_by,
        student_id,
        email,
        phone,
        degree,
        major
      ]
    );

    res.status(201).json({
      message: "Student added successfully"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

/*
==================================
AUTO-FILL STUDENT (BY NATIONAL ID)
==================================
*/
const getStudentByNationalId = async (req, res) => {
  try {
    const { national_id } = req.params;

    const [student] = await db.query(
      `SELECT 
        full_name, 
        national_id, 
        DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS date_of_birth
       FROM students_new 
       WHERE national_id = ?`,
      [national_id]
    );

    if (student.length === 0) {
      return res.json({ exists: false });
    }

    res.json({
      exists: true,
      student: student[0]
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/*
==================================
EXPORTS
==================================
*/
module.exports = {
  addStudent,
  getStudentByNationalId   // ✅ THIS FIXES YOUR ERROR
};