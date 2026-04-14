const db = require("../config/db");

// Add student
const addStudent = async (req, res) => {
  console.log("ADD STUDENT HIT");

  try {
    let {
      full_name,
      student_id, // now becomes permanent student_code
      email,
      phone,
      national_id,
      date_of_birth,
      degree
    } = req.body;

    const universityId = req.user.university_id;
    const createdBy = req.user.id;

    // 🧹 Clean input
    full_name = full_name?.trim();
    student_id = student_id?.trim();
    email = email?.toLowerCase().trim();
    phone = phone?.trim();
    national_id = national_id?.trim();

    // 🚨 Required
    if (!full_name || !student_id || !email || !phone || !national_id || !date_of_birth || !degree) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 🔐 VALIDATIONS
    if (!/^[A-Z][a-z]+(\s[A-Z][a-z]+)+$/.test(full_name)) {
      return res.status(400).json({ message: "Full name must be like: John Doe" });
    }

    if (!/^[0-9]{4,20}$/.test(student_id)) {
      return res.status(400).json({ message: "Invalid student ID" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Invalid email" });
    }

    if (!/^[0-9]{7,15}$/.test(phone)) {
      return res.status(400).json({ message: "Invalid phone" });
    }

    if (!/^[0-9]{6,20}$/.test(national_id)) {
      return res.status(400).json({ message: "Invalid national ID" });
    }

    // 🔐 AGE CHECK
    const dob = new Date(date_of_birth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    if (age < 17 || age > 100) {
      return res.status(400).json({ message: "Invalid age" });
    }

    // 🔍 STEP 1: Check if student exists
    const [existingStudent] = await db.query(
      "SELECT * FROM students_new WHERE national_id = ?",
      [national_id]
    );

    let studentId;
    let studentCode;

    if (existingStudent.length > 0) {
      studentId = existingStudent[0].id;
      studentCode = existingStudent[0].student_code;

      // 🚫 Prevent changing student ID
      if (studentCode !== student_id) {
        return res.status(400).json({
          message: "Student ID cannot be changed for existing student"
        });
      }

    } else {
      // ✅ Create new identity
      const [newStudent] = await db.query(
        `INSERT INTO students_new (full_name, national_id, date_of_birth, student_code)
         VALUES (?, ?, ?, ?)`,
        [full_name, national_id, date_of_birth, student_id]
      );

      studentId = newStudent.insertId;
      studentCode = student_id;
    }

    // 🎓 STEP 2: Degree progression check
    const [existingDegrees] = await db.query(
      `SELECT degree FROM student_records WHERE student_id = ?`,
      [studentId]
    );

    const degrees = existingDegrees.map(d => d.degree);

    // 🚫 Master without Bachelor
    if (degree === "Master" && !degrees.includes("Bachelor")) {
      return res.status(400).json({
        message: "Student must complete Bachelor before Master"
      });
    }

    // 🚫 PhD without Master
    if (degree === "PhD" && !degrees.includes("Master")) {
      return res.status(400).json({
        message: "Student must complete Master before PhD"
      });
    }

    // 🚫 Prevent duplicate SAME degree in SAME university
    const [degreeCheck] = await db.query(
      `SELECT id FROM student_records 
       WHERE student_id = ? AND university_id = ? AND degree = ?`,
      [studentId, universityId, degree]
    );

    if (degreeCheck.length > 0) {
      return res.status(400).json({
        message: "Student already has this degree in this university"
      });
    }

    // 🚫 Prevent duplicate email in same university
    const [emailCheck] = await db.query(
      `SELECT id FROM student_records 
       WHERE university_id = ? AND email = ?`,
      [universityId, email]
    );

    if (emailCheck.length > 0) {
      return res.status(400).json({
        message: "Email already exists in this university"
      });
    }

    // ✅ STEP 3: Insert academic record
    await db.query(
      `INSERT INTO student_records 
      (student_id, university_id, created_by, email, phone, degree)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        studentId,
        universityId,
        createdBy,
        email,
        phone,
        degree
      ]
    );

    res.status(201).json({
      message: "Student added successfully"
    });

  } catch (error) {
    console.error("ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get students
const getStudents = async (req, res) => {
  try {
    const universityId = req.user.university_id;

    const [students] = await db.query(
      `SELECT sr.*, s.full_name, s.national_id, s.date_of_birth, s.student_code
       FROM student_records sr
       JOIN students_new s ON sr.student_id = s.id
       WHERE sr.university_id = ?
       ORDER BY sr.created_at DESC`,
      [universityId]
    );

    res.json({ students });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  addStudent,
  getStudents,
};