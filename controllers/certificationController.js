// controllers/certificationController.js

const db = require("../config/db");
const crypto = require("crypto");
const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { signWithVault, getVaultPublicKey } = require("../utils/vaultClient");
const logAction = require("../utils/auditLog");

/*
==================================
HELPERS
==================================
*/
const generateCertNumber = (universityId) => {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `UNIV-${universityId}-${year}-${rand}`;
};

const normalizeDate = (d) => {
  if (!d) return "";
  if (d instanceof Date && !isNaN(d)) {
    const year  = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day   = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const match = String(d).trim().match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
};

/*
  normalizeGPA — MySQL decimal(4,2) always returns "3.00".
  We apply toFixed(2) at both issuance and verification so the
  payload string is identical on both sides.
*/
const normalizeGPA = (GPA) => {
  if (GPA === null || GPA === undefined || GPA === "") return "";
  const n = Number(GPA);
  return isNaN(n) ? "" : n.toFixed(2);
};

/*
  buildHashPayload — deterministic pipe-delimited string.
  MUST use identical fields and order in issueCertificate and verifyCertificate.
  student_name is included so a name change is detectable.
*/
const buildHashPayload = ({
  cert_number, student_id, university_id, student_name,
  degree, major, GPA, graduation_date,
}) =>
  [
    cert_number,
    student_id,
    university_id,
    student_name,
    degree,
    major,
    normalizeGPA(GPA),
    normalizeDate(graduation_date),
  ].join("|");

/*
  formatDatePdf — clean human-readable date for the PDF, no timezone suffix.
*/
const formatDatePdf = (raw) => {
  if (!raw) return "N/A";
  const str = raw instanceof Date
    ? raw.toISOString().split("T")[0]
    : String(raw).split("T")[0].split(" ")[0];
  const [y, m, d] = str.split("-").map(Number);
  if (!y || !m || !d) return String(raw);
  const months = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
  return `${String(d).padStart(2,"0")} ${months[m-1]} ${y}`;
};

/*
==================================
ISSUE CERTIFICATE
==================================
Signing flow (pre-hashed mode):

  payload  = buildHashPayload(...)          ← deterministic string
  hash     = SHA256(payload)                ← hex, 64 chars
  hashB64  = Buffer.from(hash,"hex")        ← raw 32 bytes → base64
             .toString("base64")
  Vault    = sign(hashB64, prehashed:true)  ← signs the 32 raw bytes

Vault's operation is mathematically identical to:
  RSA-PSS( SHA256(payload) )
which is exactly what Node's SHA256 createVerify checks at verification.
*/
const issueCertificate = asyncHandler(async (req, res) => {
  const { student_id, degree, major, GPA, graduation_date } = req.body;

  if (!student_id || !degree || !major || !graduation_date) {
    throw new AppError("student_id, degree, major, and graduation_date are required", 400);
  }

  const university_id = req.user.university_id;
  const created_by   = req.user.id;

  if (!university_id) throw new AppError("Staff is not linked to any university", 400);

  // In issueCertificate — replace the studentRows query:
const [studentRows] = await db.query(
  `SELECT s.id, s.full_name, s.national_id, sr.id AS record_id
   FROM students_new s
   JOIN student_records sr ON sr.student_id = s.id
   WHERE s.id = ? AND sr.university_id = ? AND sr.degree = ? AND sr.major = ?
   LIMIT 1`,
  [student_id, university_id, degree, major]   // ✅ add major to match exactly
).catch(err => { console.error("SQL Error:", err.message); return [[]]; });

  if (studentRows.length === 0)
    throw new AppError("Student not found in your university with the selected degree", 404);

  const student          = studentRows[0];
  const student_record_id = student.record_id;

  const [existingCert] = await db.query(
    "SELECT id FROM certificates WHERE student_record_id = ? AND status != 'revoked'",
    [student_record_id]
  );
  if (existingCert.length > 0)
    throw new AppError(
      "A certificate already exists for this student record. Revoke it before issuing a new one.", 409
    );

  const [univRows] = await db.query(
    "SELECT id, name, key_reference FROM universities WHERE id = ?", [university_id]
  );
  if (univRows.length === 0) throw new AppError("University not found", 404);
  const university = univRows[0];
  if (!university.key_reference)
    throw new AppError("University does not have a signing key configured", 500);

  const cert_number  = generateCertNumber(university_id);
  const normGradDate = normalizeDate(graduation_date);

  const payload = buildHashPayload({
    cert_number,
    student_id,
    university_id,
    student_name: student.full_name,
    degree,
    major,
    GPA,
    graduation_date: normGradDate,
  });

  console.log("ISSUE payload:", payload);

  const certification_hash = crypto.createHash("sha256").update(payload).digest("hex");
  console.log("ISSUE hash   :", certification_hash);

  // Convert hex hash → raw 32 bytes → base64 for Vault's prehashed mode
  const hashBase64        = Buffer.from(certification_hash, "hex").toString("base64");
  const digital_signature = await signWithVault(university.key_reference, hashBase64);

  const verifyUrl = `${process.env.FRONTEND_URL}/verify/${cert_number}`;
  const qr_code   = await QRCode.toDataURL(verifyUrl);

  const [result] = await db.query(
    `INSERT INTO certificates
       (student_id, university_id, created_by, cert_number, degree, major, GPA,
        graduation_date, digital_signature, qr_code, certification_hash, status, student_record_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'locked', ?)`,
    [
      student_id, university_id, created_by, cert_number, degree, major,
      GPA ?? null, normGradDate, digital_signature, qr_code,
      certification_hash, student_record_id,
    ]
  );

  await logAction({
    user_id:        created_by,
    university_id:  university_id,
    action:         "ISSUE_CERTIFICATE",
    description:    `Issued certificate ${cert_number} for student ID ${student_id} (${degree} - ${major})`,
    status:         "success",
    target_type:    "certificate",
    target_id:      result.insertId,
    certificate_id: result.insertId,
    ip_address:     req.ip,
  });

  return res.status(201).json({
    status: "success",
    message: "Certificate issued successfully and locked successfully",
    certificate: {
      id: result.insertId,
      cert_number,
      certification_hash,
      student: student.full_name,
      degree,
      major,
      GPA: GPA ?? null,
      graduation_date: normGradDate,
      university: university.name,
      qr_code,
      verify_url: verifyUrl,
      status: "locked",
    },
  });
});

/*
==================================
GET CERTIFICATES
==================================
*/
const getCertificates = asyncHandler(async (req, res) => {
  const { role, university_id } = req.user;

  let query = `
    SELECT
      c.id, c.cert_number, c.degree, c.major, c.GPA, c.graduation_date,
      c.status, c.created_at, c.certification_hash, c.qr_code,
      sn.full_name   AS student_name,
      sn.national_id,
      u.name         AS university_name,
      cr.name        AS created_by_name
    FROM certificates c
    JOIN students_new  sn ON c.student_id    = sn.id
    JOIN universities  u  ON c.university_id = u.id
    JOIN users         cr ON c.created_by    = cr.id
  `;
  const params = [];
  if (role !== "super_admin") {
    query += " WHERE c.university_id = ?";
    params.push(university_id);
  }
  query += " ORDER BY c.created_at DESC";

  const [certificates] = await db.query(query, params);
  return res.json({ status: "success", certificates });
});

/*
==================================
GET SINGLE CERTIFICATE
==================================
*/
const getCertificateById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role, university_id } = req.user;

  const [rows] = await db.query(
    `SELECT c.*, sn.full_name AS student_name, sn.national_id,
            u.name AS university_name, u.public_key AS university_public_key,
            cr.name AS created_by_name
     FROM certificates c
     JOIN students_new sn ON c.student_id    = sn.id
     JOIN universities u  ON c.university_id = u.id
     JOIN users        cr ON c.created_by    = cr.id
     WHERE c.id = ?`,
    [id]
  );
  if (rows.length === 0) throw new AppError("Certificate not found", 404);
  const cert = rows[0];
  if (role !== "super_admin" && cert.university_id !== university_id)
    throw new AppError("Access forbidden", 403);
  return res.json({ status: "success", certificate: cert });
});

/*
==================================
VERIFY CERTIFICATE (PUBLIC)
==================================

Two independent checks must BOTH pass for valid:true

  1. HASH CHECK
     Rebuild the payload from DB fields, re-hash, compare against
     the stored certification_hash. Detects any DB-level tampering.

  2. SIGNATURE CHECK
     ┌───────────────────────────────────────────────────────────┐
     │  WHY WE USE createVerify("SHA256") + payload              │
     │                                                           │
     │  At issuance:                                             │
     │    Vault received:  SHA256(payload) as raw bytes (base64) │
     │    Vault signed:    RSA-PSS( SHA256(payload) )            │
     │                     with prehashed:true, saltLen=32        │
     │                                                           │
     │  These two are MATHEMATICALLY IDENTICAL:                  │
     │    Vault prehashed:  sign( H )  where H = SHA256(payload) │
     │    Node verify:      verify( SHA256(payload), sig )       │
     │                                                           │
     │  So: feed the PAYLOAD to createVerify("SHA256") and let   │
     │  Node compute SHA256 internally — no null-algorithm       │
     │  ambiguity, no manual buffer gymnastics.                  │
     │                                                           │
     │  saltLength:32 must be set explicitly to match Vault's    │
     │  PSS default (hashLen = 32 for SHA-256).                  │
     └───────────────────────────────────────────────────────────┘
*/
const verifyCertificate = asyncHandler(async (req, res) => {
  const { cert_number } = req.params;

  const [rows] = await db.query(
  `SELECT c.*, sn.full_name AS student_name, sn.national_id,
          u.name AS university_name, u.public_key AS university_public_key,
          u.key_reference AS university_key_reference
   FROM certificates c
   JOIN students_new sn ON c.student_id    = sn.id
   JOIN universities u  ON c.university_id = u.id
   WHERE c.cert_number = ?`,
  [cert_number]
);

  if (rows.length === 0)
    return res.status(404).json({ status: "error", valid: false, message: "Certificate not found" });

  const cert = rows[0];

  // Revoked — return info but mark invalid
  if (cert.status === "revoked") {
    return res.json({
      status: "success",
      valid: false,
      reason: "revoked",
      message: "This certificate has been revoked",
      certificate: {
        id: cert.id,
        cert_number: cert.cert_number,
        student_name: cert.student_name,
        national_id: cert.national_id,
        university: cert.university_name,
        degree: cert.degree,
        major: cert.major,
        GPA: cert.GPA,
        graduation_date: cert.graduation_date,
        issued_at: cert.created_at,
        status: cert.status,
      },
    });
  }

  // ── Rebuild payload (same function, same fields, same order) ─
  const payload = buildHashPayload({
    cert_number:   cert.cert_number,
    student_id:    cert.student_id,
    university_id: cert.university_id,
    student_name:  cert.student_name,
    degree:        cert.degree,
    major:         cert.major,
    GPA:           cert.GPA,           // normalizeGPA handles "3.00" → "3.00"
    graduation_date: cert.graduation_date, // normalizeDate strips timezone
  });

  console.log("VERIFY payload  :", payload);

  // ── 1. HASH CHECK ─────────────────────────────────────────────
  const expectedHash = crypto.createHash("sha256").update(payload).digest("hex");

  console.log("VERIFY expected :", expectedHash);
  console.log("VERIFY stored   :", cert.certification_hash);

  const hashMatch = expectedHash === cert.certification_hash;

  // ── 2. SIGNATURE CHECK ────────────────────────────────────────
  //
  // Using createVerify("SHA256") + the payload string.
  //
  // Node will compute SHA256(payload) internally and verify the
  // RSA-PSS signature — identical to what Vault did at issuance.
  //
  // saltLength:32 matches Vault's PSS default (= SHA-256 digest size).
  //
  // ── 2. SIGNATURE CHECK ────────────────────────────────────────
let signatureValid = false;

try {
  const rawSig = cert.digital_signature.replace(/^vault:v\d+:/, "");

  // Fetch the real public key live from Vault (not the stale DB copy)
  const publicKey = await getVaultPublicKey(cert.university_key_reference);

  console.log("PUBLIC KEY FROM VAULT:\n", publicKey);  // confirm it's fetched correctly

  // Feed the original payload to createVerify — Node computes SHA256 internally.
  // This is identical to what Vault did: RSA-PSS-Sign(SHA256(payload))
  const verifier = crypto.createVerify("SHA256");
  verifier.update(payload);

  signatureValid = verifier.verify(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_AUTO, // ✅ auto-detect, correct for verification
    },
    Buffer.from(rawSig, "base64")
  );

} catch (err) {
  console.error("Signature verification error:", err.message, err.stack);
  signatureValid = false;
}

  console.log("VERIFY hashMatch:", hashMatch, "| sigValid:", signatureValid);

  const valid = hashMatch && signatureValid;

  await logAction({
    user_id:        null,
    university_id:  cert.university_id,
    action:         "VERIFY_CERTIFICATE",
    description:    `Certificate ${cert_number} verified — valid: ${valid}`,
    status:         valid ? "success" : "failure",
    target_type:    "certificate",
    target_id:      cert.id,
    certificate_id: cert.id,
    ip_address:     req.ip,
  });

  return res.json({
    status: "success",
    valid,
    // Always return certificate data — frontend needs it even when invalid
    certificate: {
      id:             cert.id,
      cert_number:    cert.cert_number,
      student_name:   cert.student_name,
      national_id:    cert.national_id,
      university:     cert.university_name,
      degree:         cert.degree,
      major:          cert.major,
      GPA:            cert.GPA,
      graduation_date: cert.graduation_date,
      issued_at:      cert.created_at,
      status:         cert.status,
    },
    checks: { hash_match: hashMatch, signature_valid: signatureValid },
  });
});

/*
==================================
REVOKE CERTIFICATE
==================================
*/
const revokeCertificate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role, university_id } = req.user;

  const [rows] = await db.query(
    "SELECT id, university_id, status FROM certificates WHERE id = ?", [id]
  );
  if (rows.length === 0) throw new AppError("Certificate not found", 404);

  const cert = rows[0];

  if (role !== "super_admin" && cert.university_id !== university_id)
    throw new AppError("Access forbidden", 403);

  if (cert.status === "revoked")
    throw new AppError("Certificate is already revoked", 400);

  // Admin can revoke locked certificates
  // Once revoked, the student record remains permanently locked
  await db.query("UPDATE certificates SET status = 'revoked' WHERE id = ?", [id]);

  await logAction({
    user_id:        req.user.id,
    university_id:  req.user.university_id,
    action:         "REVOKE_CERTIFICATE",
    description:    `Revoked certificate ID ${id}`,
    status:         "success",
    target_type:    "certificate",
    target_id:      parseInt(id),
    certificate_id: parseInt(id),
    ip_address:     req.ip,
  });

  return res.json({ status: "success", message: "Certificate revoked successfully" });
});

/*
==================================
DOWNLOAD CERTIFICATE AS PDF
==================================
*/
const downloadCertificatePdf = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role, university_id } = req.user;

  const [rows] = await db.query(
    `SELECT c.*, sn.full_name AS student_name, sn.national_id, u.name AS university_name
     FROM certificates c
     JOIN students_new sn ON c.student_id = sn.id
     JOIN universities u  ON c.university_id = u.id
     WHERE c.id = ?`,
    [id]
  );
  if (rows.length === 0) throw new AppError("Certificate not found", 404);
  const cert = rows[0];
  if (role !== "super_admin" && cert.university_id !== university_id)
    throw new AppError("Access forbidden", 403);
  if (cert.status === "revoked")
    throw new AppError("Cannot download a revoked certificate", 400);

  const doc = new PDFDocument({ size: "A4", margins: { top: 60, bottom: 60, left: 72, right: 72 } });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="certificate_${cert.cert_number}.pdf"`);
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const L = 72;

  doc.rect(0, 0, pageWidth, 10).fill("#1a3c6e");
  doc.moveDown(1).font("Helvetica-Bold").fontSize(22).fillColor("#1a3c6e")
     .text(cert.university_name, { align: "center" });
  doc.moveDown(0.3).font("Helvetica").fontSize(11).fillColor("#555555")
     .text("Official Academic Certificate", { align: "center" });
  doc.moveDown(0.8);
  doc.moveTo(L, doc.y).lineTo(pageWidth - L, doc.y).strokeColor("#1a3c6e").lineWidth(1.5).stroke();
  doc.moveDown(1.5).font("Helvetica-Bold").fontSize(18).fillColor("#222222")
     .text("CERTIFICATE OF GRADUATION", { align: "center" });
  doc.moveDown(0.4).font("Helvetica").fontSize(12).fillColor("#444444")
     .text("This is to certify that", { align: "center" });
  doc.moveDown(0.6).font("Helvetica-Bold").fontSize(20).fillColor("#1a3c6e")
     .text(cert.student_name, { align: "center" });
  doc.moveDown(0.4).font("Helvetica").fontSize(11).fillColor("#444444")
     .text(`National ID: ${cert.national_id}`, { align: "center" });
  doc.moveDown(0.8).font("Helvetica").fontSize(12).fillColor("#333333")
     .text("has successfully completed the requirements for the degree of", { align: "center" });
  doc.moveDown(0.4).font("Helvetica-Bold").fontSize(15).fillColor("#222222")
     .text(`${cert.degree} in ${cert.major}`, { align: "center" });
  if (cert.GPA)
    doc.moveDown(0.4).font("Helvetica").fontSize(12).fillColor("#444444")
       .text(`with a GPA of ${parseFloat(cert.GPA).toFixed(2)}`, { align: "center" });
  doc.moveDown(0.4).font("Helvetica").fontSize(12).fillColor("#444444")
     .text(`Graduation Date: ${formatDatePdf(cert.graduation_date)}`, { align: "center" });
  doc.moveDown(1.2);
  doc.moveTo(L, doc.y).lineTo(pageWidth - L, doc.y).strokeColor("#cccccc").lineWidth(0.8).stroke();

  const metaY = doc.y + 16;
  doc.font("Helvetica").fontSize(9).fillColor("#666666")
    .text(`Certificate No: ${cert.cert_number}`, L, metaY)
    .text(`Issued: ${formatDatePdf(cert.created_at)}`, L, metaY + 14)
    .text(`Status: ${cert.status.toUpperCase()}`, L, metaY + 28)
    .text(`Hash (SHA-256): ${cert.certification_hash}`, L, metaY + 42,
          { width: pageWidth - L * 2 - 130 });

  if (cert.qr_code) {
    const qrBuffer = Buffer.from(cert.qr_code.replace(/^data:image\/png;base64,/, ""), "base64");
    doc.image(qrBuffer, pageWidth - L - 110, metaY - 10, { width: 110, height: 110 });
    doc.font("Helvetica").fontSize(7).fillColor("#888888")
       .text("Scan to verify", pageWidth - L - 110, metaY + 112, { width: 110, align: "center" });
  }

  const footerY = doc.page.height - 40;
  doc.rect(0, footerY, pageWidth, 10).fill("#1a3c6e");
  doc.font("Helvetica").fontSize(8).fillColor("#888888").text(
    `This certificate was digitally signed and can be verified at ${process.env.FRONTEND_URL}/verify/${cert.cert_number}`,
    L, footerY - 14, { align: "center", width: pageWidth - L * 2 }
  );

  doc.end();
});

module.exports = {
  issueCertificate,
  getCertificates,
  getCertificateById,
  verifyCertificate,
  revokeCertificate,
  downloadCertificatePdf,
};