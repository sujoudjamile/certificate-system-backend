// controllers/staffController.js

const db = require("../config/db");
const crypto = require("crypto"); //Used to generate a secure random token for email verification.
const sendEmail = require("../utils/sendEmail");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");//Used to create custom error messages like
const logAction = require("../utils/auditLog");//Used to create custom error messages like
/*
==================================
HELPER
==================================
*/
//This checks whether the email format is valid.
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/*
==================================
ADD STAFF
==================================
This function:
1. Allows a university admin to add a staff member
2. Creates staff account as unverified
3. Generates a verification token
4. Sends activation email
*/
const addStaff = asyncHandler(async (req, res) => {
  const { name, email } = req.body; //It takes the staff member’s:

  if (!name || !email) { //If name or email is missing, it throws an error.
    throw new AppError("Name and email are required", 400);
  }

  const nameRegex = /^[a-zA-Z\u0600-\u06FF]+([ '-][a-zA-Z\u0600-\u06FF]+)+$/;

if (!nameRegex.test(name.trim())) {
  throw new AppError(
    "Name must contain at least a first and last name, using letters only (no digits or special characters).",
    400
  );
}

  if (!isValidEmail(email)) { //It checks that the email format is valid.
    throw new AppError("Invalid email format", 400);
  }

  const universityId = req.user.university_id;
  const adminId = req.user.id;
  //A university admin should only add staff for their own university

  if (!universityId) { //If the admin has no university, the process stops.
    throw new AppError("Admin is not linked to any university", 400);
  }

  const [existingUsers] = await db.query(//This checks if the email already exists in the users table.
    "SELECT id FROM users WHERE email = ?", 
    [email]
  );

  if (existingUsers.length > 0) {
    throw new AppError("A user with this email already exists", 400);
  }

  // Get admin info
  const [adminRows] = await db.query(
    "SELECT id, name, email, university_id FROM users WHERE id = ?",//This fetches the admin’s information.
    [adminId]
  );

  if (adminRows.length === 0) {
    throw new AppError("Admin not found", 404);
  }

  const admin = adminRows[0];

  // Get university info
  const [universityRows] = await db.query( // This gets the university name.Why:The email sent to the staff member includes the university name.
    "SELECT id, name FROM universities WHERE id = ?",
    [universityId]
  );

  if (universityRows.length === 0) {
    throw new AppError("University not found", 404);
  }

  const university = universityRows[0];

  const verificationToken = crypto.randomBytes(32).toString("hex");//This creates a secure token used in the activation link.
                                                                   // instead of giving the user a password directly, the system sends a link so they can activate their account safely.//
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [result] = await db.query(
    `INSERT INTO users
     (name, email, password, role, university_id, created_by, is_verified, verification_token, verification_expires)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      email,
      null,
      "staff",
      universityId,
      adminId,
      false,
      verificationToken,
      verificationExpires,
    ]
  );

  const verifyLink = `${process.env.FRONTEND_URL}/activate-account?token=${verificationToken}`;//This builds the URL sent in the email

  try {
    await sendEmail({
      to: email,
      subject: "Activate your CertifyLB staff account",
      html: `
        <h2>Welcome to CertifyLB</h2>
        <p>You were added as a <strong>staff member</strong>.</p>
        <p><strong>Created by:</strong> ${admin.name}</p>
        <p><strong>University:</strong> ${university.name}</p>
        <p>Click the link below to verify your email and set your password:</p>
        <a href="${verifyLink}">${verifyLink}</a>
        <p>This link will expire in 24 hours.</p>
      `,
    });

    await logAction({
      user_id:       adminId,
      university_id: universityId,
      action:        "ADD_STAFF",
      description:   `Added staff member ${name} (${email})`,
      status:        "success",
      target_type:   "staff",
      target_id:     result.insertId,
      ip_address:    req.ip,
    });

    return res.status(201).json({
      status: "success",
      message: "Staff member added successfully. Verification email sent.",
      staffId: result.insertId,
    });
  } catch (emailErr) {
      await logAction({
      user_id:       adminId,
      university_id: universityId,
      action:        "ADD_STAFF",
      description:   `Added staff member ${name} (${email}) — email failed`,
      status:        "success",
      target_type:   "staff",
      target_id:     result.insertId,
      ip_address:    req.ip,
    });

    return res.status(201).json({
      status: "warning",
      message: "Staff member added, but email could not be sent.",
      staffId: result.insertId,
      emailError: emailErr.message,
    });
  }
});

/*
==================================
GET STAFF
==================================
*/

const getStaff = asyncHandler(async (req, res) => {
   const universityId = req.user.university_id;
  
  // 1. Capture the search term from query params (e.g., ?search=jamil)
  const searchTerm = req.query.search ? `%${req.query.search}%` : '%';

  // 2. We use LOWER() to ensure "jamil" matches "Jamil"
  const [staffs] = await db.query(`
    SELECT 
      u.id, u.name, u.email, u.is_verified, u.is_active,
      un.name AS university_name
    FROM users u
    LEFT JOIN universities un ON u.university_id = un.id
    WHERE u.role = 'staff' 
      AND u.university_id = ?
      AND (LOWER(u.name) LIKE LOWER(?) OR LOWER(u.email) LIKE LOWER(?))
    ORDER BY u.created_at DESC
  `, [universityId, searchTerm, searchTerm]);

  res.json({
    status: "success",
    count: staffs.length,
    staffs,
  });
});
const toggleStaffStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { university_id } = req.user;

  const [rows] = await db.query(
    "SELECT id, name, email, is_active, role, university_id FROM users WHERE id = ?",
    [id]
  );

  if (rows.length === 0) throw new AppError("Staff member not found", 404);
  if (rows[0].role !== "staff") throw new AppError("User is not a staff member", 403);
  if (rows[0].university_id !== university_id)
    throw new AppError("Access forbidden", 403);

  const newStatus = rows[0].is_active ? 0 : 1;

  await db.query("UPDATE users SET is_active = ? WHERE id = ?", [newStatus, id]);

  await logAction({
    user_id:       req.user.id,
    university_id: university_id,
    action:        newStatus ? "ACTIVATE_STAFF" : "DEACTIVATE_STAFF",
    description:   `${newStatus ? "Activated" : "Deactivated"} staff member ${rows[0].name} (${rows[0].email})`,
    status:        "success",
    target_type:   "staff",
    target_id:     parseInt(id),
    ip_address:    req.ip,
  });

  return res.json({
    status:    "success",
    message:   `Staff member ${newStatus ? "activated" : "deactivated"} successfully`,
    is_active: newStatus,
  });
});

module.exports = {
  addStaff,
  getStaff,
  toggleStaffStatus,
};