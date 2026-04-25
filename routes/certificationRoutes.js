// routes/certificateRoutes.js

const express = require("express");
const router = express.Router();

const {
  issueCertificate,
  getCertificates,
  getCertificateById,
  verifyCertificate,
  revokeCertificate,
  downloadCertificatePdf,
} = require("../controllers/certificationController");

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

/*
==================================
CERTIFICATE ROUTES
==================================
*/

// PUBLIC — anyone can verify a certificate by cert_number
router.get("/verify/:cert_number", verifyCertificate);


// PROTECTED — staff & admin can issue certificates
router.post(
  "/",
  authenticateToken,
  authorizeRoles("staff", "admin"),
  issueCertificate
);

// PROTECTED — staff & admin see their university's certs; super_admin sees all
router.get(
  "/",
  authenticateToken,
  authorizeRoles("staff", "admin", "super_admin"),
  getCertificates
);

// PROTECTED — get single certificate details
router.get(
  "/:id",
  authenticateToken,
  authorizeRoles("staff", "admin", "super_admin"),
  getCertificateById
);

// PROTECTED — only admin (or super_admin) can revoke
router.patch(
  "/:id/revoke",
  authenticateToken,
  authorizeRoles("admin", "super_admin"),
  revokeCertificate
);

// PROTECTED — download printable PDF
router.get(
  "/:id/pdf",
  authenticateToken,
  authorizeRoles("staff", "admin", "super_admin"),
  downloadCertificatePdf
);

module.exports = router;