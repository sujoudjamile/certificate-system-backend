const db = require("../config/db");

// Add student
const addStudent = async (req, res) => {
  try {
    const { full_name, email, national_id, date_of_birth } = req.body;

    const universityId = req.user.university_id;
    const createdBy = req.user.id;

    if (!full_name || !national_id || !date_of_birth) {
      return res.status(400).json({
        message: "Required fields missing",
      });
    }

    const [result] = await db.query(
      `INSERT INTO students 
       (university_id, created_by, full_name, email, national_id, date_of_birth)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        universityId,
        createdBy,
        full_name,
        email || null,
        national_id,
        date_of_birth,
      ]
    );

    res.status(201).json({
      status: "success",
      studentId: result.insertId,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get students
const getStudents = async (req, res) => {
  try {
    const universityId = req.user.university_id;

    const [students] = await db.query(
      "SELECT * FROM students WHERE university_id = ?",
      [universityId]
    );

    res.status(200).json({
      status: "success",
      students,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  addStudent,
  getStudents,
};