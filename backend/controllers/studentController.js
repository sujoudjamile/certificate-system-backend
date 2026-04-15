const db = require("../config/db");

// ==========================
// ADD STUDENT
// ==========================
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
        VALUES (?, ?, ?)`,
        [full_name, national_id, date_of_birth]
      );

      studentId = newStudent.insertId;
    }

    // =====================================
    // STEP 2: GET ALL RECORDS
    // =====================================
    const [records] = await db.query(
      "SELECT * FROM student_records WHERE student_id = ?",
      [studentId]
    );

    // =====================================
    // STEP 3: DEGREE PROGRESSION
    // =====================================
    const degreeOrder = ["Bachelor", "Master", "PhD"];

    const highestDegree = records
      .map(r => r.degree)
      .sort(
        (a, b) =>
          degreeOrder.indexOf(b) - degreeOrder.indexOf(a)
      )[0];

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
          message: `Student already has a ${degree} degree`
        });
      }
    }

    // =====================================
    // STEP 4: GLOBAL MAJOR VALIDATION
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
    // STEP 5: PREVENT SAME DEGREE IN SAME UNI
    // =====================================
    const duplicate = records.find(
      r =>
        r.university_id === university_id &&
        r.student_code === student_id &&
        r.degree === degree
    );

    if (duplicate) {
      return res.status(400).json({
        message: `Student already has a ${degree} degree in this university`
      });
    }

    // =====================================
    // STEP 6: INSERT RECORD
    // =====================================
    await db.query(
      `INSERT INTO student_records 
      (student_id, university_id, created_by, student_code, phone, degree, major)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        studentId,
        university_id,
        created_by,
        student_id,
        phone,
        degree,
        major
      ]
    );

    res.status(201).json({
      message: "Student added successfully"
    });

  } catch (error) {
    console.error("ERROR:", error);
    res.status(500).json({
      message: error.message
    });
  }
};

// ==========================
// GET STUDENTS
// ==========================
const getStudents = async (req, res) => {
  try {
    const university_id = req.user.university_id;

    const [students] = await db.query(
      `SELECT 
          sr.id,
          sr.student_code,
          s.email,
          sr.phone,
          sr.degree,
          sr.major,
          sr.created_at,
          s.full_name,
          s.national_id,
          s.date_of_birth
       FROM student_records sr
       JOIN students_new s ON sr.student_id = s.id
       WHERE sr.university_id = ?
       ORDER BY sr.created_at DESC`,
      [university_id]
    );

    res.status(200).json(students);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==========================
// AUTO-FILL (NEW 🔥)
// ==========================
const getStudentByNationalId = async (req, res) => {
  try {
    const { national_id } = req.params;

    const [student] = await db.query(
      "SELECT full_name, national_id, date_of_birth FROM students_new WHERE national_id = ?",
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

module.exports = {
  addStudent,
  getStudents,
  getStudentByNationalId   // ✅ IMPORTANT
};