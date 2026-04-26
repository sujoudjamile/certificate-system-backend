// routes/certificationRoutes.js

const express = require("express");
const router  = express.Router();

const {
  issueCertificate,
  getCertificates,
  getCertificateById,
  verifyCertificate,
  verifyPdfUpload,
  revokeCertificate,
  downloadCertificatePdf,
  upload,
} = require("../controllers/certificationController");

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRoles    = require("../middleware/roleMiddleware");

// PUBLIC — verify by cert_number (QR scan)
router.get("/verify/:cert_number", verifyCertificate);

// PUBLIC — verify by uploading the actual PDF file
router.post("/verify-pdf", upload.single("pdf"), verifyPdfUpload);

// PROTECTED — issue certificate
router.post(
  "/",
  authenticateToken,
  authorizeRoles("staff", "admin"),
  issueCertificate
);

// PROTECTED — list certificates
router.get(
  "/",
  authenticateToken,
  authorizeRoles("staff", "admin", "super_admin"),
  getCertificates
);

// PROTECTED — single certificate
router.get(
  "/:id",
  authenticateToken,
  authorizeRoles("staff", "admin", "super_admin"),
  getCertificateById
);

// PROTECTED — revoke
router.patch(
  "/:id/revoke",
  authenticateToken,
  authorizeRoles("admin", "super_admin"),
  revokeCertificate
);

// PROTECTED — download signed PDF
router.get(
  "/:id/pdf",
  authenticateToken,
  authorizeRoles("staff", "admin", "super_admin"),
  downloadCertificatePdf
);

module.exports = router;