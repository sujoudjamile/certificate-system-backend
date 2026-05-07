// routes/programRoutes.js

const express          = require("express");
const router           = express.Router();
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRoles   = require("../middleware/roleMiddleware");
const {
  getAllMajors,
  getAllDegrees,
  getDegreesForMajor,
  getUniversityPrograms,
  addUniversityProgram,
  bulkAddUniversityPrograms,
  removeUniversityProgram,
  getStaffPrograms,
} = require("../controllers/programController");

/*
==================================
PUBLIC REFERENCE DATA
==================================
Any authenticated user can read the global catalogues.
Used by both admin (setup) and staff (add-student form).
*/

// GET /api/programs/majors
// Returns all majors grouped by field
router.get("/majors", authenticateToken, getAllMajors);

// GET /api/programs/degrees
// Returns all degree types
router.get("/degrees", authenticateToken, getAllDegrees);

// GET /api/programs/majors/:majorId/degrees
// Returns allowed degrees for a specific major
// e.g. Pharmacy → [PharmD]
router.get(
  "/majors/:majorId/degrees",
  authenticateToken,
  getDegreesForMajor
);

/*
==================================
STAFF — READ THEIR UNIVERSITY'S PROGRAMS
==================================
Staff (and admin) call this to populate the
"Add Student" dropdowns — returns only what
the university has activated.
*/

// GET /api/programs/staff-programs
router.get(
  "/staff-programs",
  authenticateToken,
  authorizeRoles("staff", "admin"),
  getStaffPrograms
);

/*
==================================
ADMIN — MANAGE UNIVERSITY PROGRAMS
==================================
Only university admins can add / remove programs.
Super admin can also call these via role guard.
*/

// GET /api/programs/university
// View all programs (active + inactive) for this uni
router.get(
  "/university",
  authenticateToken,
  authorizeRoles("admin", "super_admin"),
  getUniversityPrograms
);

// POST /api/programs/university
// Add a single program  { major_id, degree_id }
router.post(
  "/university",
  authenticateToken,
  authorizeRoles("admin"),
  addUniversityProgram
);

// POST /api/programs/university/bulk
// Add multiple programs at once  { programs: [{major_id, degree_id}] }
router.post(
  "/university/bulk",
  authenticateToken,
  authorizeRoles("admin"),
  bulkAddUniversityPrograms
);

// DELETE /api/programs/university/:id
// Deactivate (soft-delete) a program
router.delete(
  "/university/:id",
  authenticateToken,
  authorizeRoles("admin"),
  removeUniversityProgram
);

module.exports = router;