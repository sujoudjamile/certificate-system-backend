const express = require("express");
const router  = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRoles    = require("../middleware/roleMiddleware");
const {
  addExternalDegree,
  getExternalDegrees,
  deleteExternalDegree,
  lookupStudentByNationalId,
  getAllExternalDegrees,
  upload,
} = require("../controllers/externalDegreeController");

// Admin only for all routes
router.use(authenticateToken);
router.use(authorizeRoles("admin"));

// ✅ Specific routes FIRST — before any /:id wildcards
router.get("/lookup/:national_id", lookupStudentByNationalId);
router.get("/student/:student_id", getExternalDegrees);
router.get("/", getAllExternalDegrees);
// ✅ General routes after
router.post("/", upload.single("document"), addExternalDegree);
router.delete("/:id", deleteExternalDegree);

module.exports = router;