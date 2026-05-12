// routes/certificationRoutes.js

const express = require("express");
const router  = express.Router();

const {
  issueCertificate,
  getCertificates,
  getPendingReissue,
  getCertificateById,
  verifyCertificate,
  verifyPdfUpload,
  revokeCertificate,
  downloadCertificatePdf,
  upload,
  getRevokedCertificates,
  requestReissue,
  allowReissue,
} = require("../controllers/certificationController");

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRoles    = require("../middleware/roleMiddleware");

// ── PUBLIC ────────────────────────────────────────────────────────────────────

// Verify by cert_number (QR scan)
router.get("/verify/:cert_number", verifyCertificate);

// Verify by uploading the actual PDF file
router.post("/verify-pdf", upload.single("pdf"), verifyPdfUpload);

// ── COLLECTION ROUTES (no :id) ────────────────────────────────────────────────

// Issue certificate
router.post(
  "/",
  authenticateToken,
  authorizeRoles("staff", "admin"),
  issueCertificate
);

// List certificates
router.get(
  "/",
  authenticateToken,
  authorizeRoles("staff", "admin", "super_admin"),
  getCertificates
);

// Get revoked certificates (admin only)
router.get(
  "/revoked",
  authenticateToken,
  authorizeRoles("admin", "super_admin"),
  getRevokedCertificates
);

// Get pending reissue list (staff + admin)
router.get(
  "/pending-reissue",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  getPendingReissue
);

// ── ITEM ROUTES (with :id) — ALL sub-routes MUST come before plain /:id ──────

// Download signed PDF
router.get(
  "/:id/pdf",
  authenticateToken,
  authorizeRoles("staff", "admin", "super_admin"),
  downloadCertificatePdf
);

// Revoke a certificate
router.patch(
  "/:id/revoke",
  authenticateToken,
  authorizeRoles("admin", "super_admin"),
  revokeCertificate
);

// Allow reissue for a revoked certificate
router.patch(
  "/:id/allow-reissue",
  authenticateToken,
  authorizeRoles("admin", "super_admin"),
  allowReissue
);

// Staff requests admin approval to reissue
router.post(
  "/:id/request-reissue",
  authenticateToken,
  authorizeRoles("staff"),
  requestReissue
);

// Single certificate — MUST be last among /:id routes
router.get(
  "/:id",
  authenticateToken,
  authorizeRoles("staff", "admin", "super_admin"),
  getCertificateById
);

module.exports = router;