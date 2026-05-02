// controllers/certificationController.js
const pdfParse = require("pdf-parse");
  console.log("pdfParse type:", typeof pdfParse);
const db           = require("../config/db");
const crypto       = require("crypto");
const QRCode       = require("qrcode");
const asyncHandler = require("../utils/asyncHandler");
const AppError     = require("../utils/AppError");
const multer       = require("multer");
const { signWithVault, getVaultPublicKey }          = require("../utils/vaultClient");
const { signPdf, verifyPdfSignature, buildPdfBuffer } = require("../utils/pdfSigner");
const logAction = require("../utils/auditLog");
// ── pdf-parse: safe import that works on Node v24 ──


/*
==================================
MULTER — memory storage for PDF uploads
==================================
*/
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf")
      return cb(new Error("Only PDF files are accepted"), false);
    cb(null, true);
  },
});

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

const normalizeGPA = (GPA) => {
  if (GPA === null || GPA === undefined || GPA === "") return "";
  const n = Number(GPA);
  return isNaN(n) ? "" : n.toFixed(2);
};

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

const formatDatePdf = (raw) => {
  if (!raw) return "N/A";
  const str = raw instanceof Date
    ? raw.toISOString().split("T")[0]
    : String(raw).split("T")[0].split(" ")[0];
  const [y, m, d] = str.split("-").map(Number);
  if (!y || !m || !d) return String(raw);
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  return `${String(d).padStart(2,"0")} ${months[m-1]} ${y}`;
};

/*
==================================
ISSUE CERTIFICATE
==================================
Uses a DB transaction so the INSERT + PDF signing + UPDATE
are all atomic — if anything fails, the whole thing rolls back.
No orphaned rows, no need to revoke-and-retry.
*/
const issueCertificate = asyncHandler(async (req, res) => {
  const { student_id, degree, major, GPA, graduation_date } = req.body;

  if (!student_id || !degree || !major || !graduation_date)
    throw new AppError("student_id, degree, major, and graduation_date are required", 400);

  const university_id = req.user.university_id;
  const created_by    = req.user.id;

  if (!university_id)
    throw new AppError("Staff is not linked to any university", 400);

  // ── Fetch student ──
  const [studentRows] = await db.query(
    `SELECT s.id, s.full_name, s.national_id, sr.id AS record_id
     FROM students_new s
     JOIN student_records sr ON sr.student_id = s.id
     WHERE s.id = ? AND sr.university_id = ? AND sr.degree = ? AND sr.major = ?
     LIMIT 1`,
    [student_id, university_id, degree, major]
  ).catch(err => { console.error("SQL Error:", err.message); return [[]]; });

  if (studentRows.length === 0)
    throw new AppError("Student not found in your university with the selected degree", 404);

  const student           = studentRows[0];
  const student_record_id = student.record_id;

  // ── Check no active cert exists ──
  const [existingCert] = await db.query(
    "SELECT id FROM certificates WHERE student_record_id = ? AND status != 'revoked'",
    [student_record_id]
  );
  if (existingCert.length > 0)
    throw new AppError(
      "A certificate already exists for this student record. Revoke it before issuing a new one.", 409
    );

  // ── Fetch university ──
  const [univRows] = await db.query(
    "SELECT id, name, key_reference, x509_cert, pdf_signing_key FROM universities WHERE id = ?",
    [university_id]
  );
  if (univRows.length === 0) throw new AppError("University not found", 404);
  const university = univRows[0];

  if (!university.key_reference)
    throw new AppError("University does not have a Vault signing key configured", 500);

  // ── Build data hash + Vault signature ──
  const cert_number  = generateCertNumber(university_id);
  const normGradDate = normalizeDate(graduation_date);

  const payload = buildHashPayload({
    cert_number,
    student_id,
    university_id,
    student_name:    student.full_name,
    degree,
    major,
    GPA,
    graduation_date: normGradDate,
  });

  console.log("ISSUE payload:", payload);

  const certification_hash = crypto.createHash("sha256").update(payload).digest("hex");
  console.log("ISSUE hash   :", certification_hash);

  const hashBase64        = Buffer.from(certification_hash, "hex").toString("base64");
  const digital_signature = await signWithVault(university.key_reference, hashBase64);

  const verifyUrl = `${process.env.FRONTEND_URL}/verify/${cert_number}`;
  const qr_code   = await QRCode.toDataURL(verifyUrl);

  // ── Transaction: INSERT + fetch + sign PDF + store blob ──
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Step 1: INSERT certificate row
    const [insertResult] = await connection.query(
      `INSERT INTO certificates
         (student_id, university_id, created_by, cert_number, degree, major, GPA,
          graduation_date, digital_signature, qr_code, certification_hash, status, student_record_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?)`,
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
    target_id:      insertResult.insertId,
certificate_id:     insertResult.insertId,
    ip_address:     req.ip,
  });

    const certId = insertResult.insertId;

    // Step 2: Fetch full row (needed by PDF builder for created_at etc.)
    const [fetchedRows] = await connection.query(
      `SELECT c.*,
              sn.full_name AS student_name,
              sn.national_id,
              u.name       AS university_name,
              u.x509_cert,
              u.pdf_signing_key
       FROM certificates c
       JOIN students_new sn ON c.student_id    = sn.id
       JOIN universities u  ON c.university_id = u.id
       WHERE c.id = ?`,
      [certId]
    );

    if (fetchedRows.length === 0)
      throw new Error("Could not fetch newly inserted certificate row.");

    const newCert = fetchedRows[0];

    // Step 3: Build + sign the PDF
    let signedPdfBuffer = null;
    let pdfSigned       = false;

    if (university.x509_cert && university.pdf_signing_key) {
      try {
        signedPdfBuffer = await signPdf(newCert, {
          name:            university.name,
          x509_cert:       university.x509_cert,
          pdf_signing_key: university.pdf_signing_key,
        });
        pdfSigned = true;
        console.log(`✅ PDF signed for cert ${cert_number}`);
      } catch (pdfErr) {
        console.error("PDF signing error (non-fatal):", pdfErr.message);
      }
    } else {
      console.warn(`⚠️  University ${university.name} has no X.509 cert — PDF not signed`);
    }

    // Step 4: Store signed PDF blob
    if (signedPdfBuffer) {
      await connection.query(
        "UPDATE certificates SET signed_pdf = ? WHERE id = ?",
        [signedPdfBuffer, certId]
      );
      console.log(`✅ signed_pdf stored for cert id ${certId}`);
    }

    // Step 5: Commit
    await connection.commit();

    return res.status(201).json({
      status: "success",
      message: pdfSigned
        ? "Certificate issued successfully with PKCS#7 digital signature."
        : "Certificate issued. PDF signing skipped — check university X.509 configuration.",
      certificate: {
        id:               certId,
        cert_number,
        certification_hash,
        student:          student.full_name,
        degree,
        major,
        GPA:              GPA ?? null,
        graduation_date:  normGradDate,
        university:       university.name,
        qr_code,
        verify_url:       verifyUrl,
        status:           "issued",
        pdf_signed:       pdfSigned,
      },
    });

  } catch (err) {
    await connection.rollback();
    console.error("issueCertificate transaction failed:", err.message);
    throw err;
  } finally {
    connection.release();
  }
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
      cr.name        AS created_by_name,
      (c.signed_pdf IS NOT NULL) AS has_pdf_signature
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
            cr.name AS created_by_name,
            (c.signed_pdf IS NOT NULL) AS has_pdf_signature
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
VERIFY CERTIFICATE — QR SCAN (PUBLIC)
==================================
Uses certification_hash + Vault RSA signature.
Unchanged from the original system.
*/
const verifyCertificate = asyncHandler(async (req, res) => {
  const { cert_number } = req.params;

  const [rows] = await db.query(
    `SELECT c.*, sn.full_name AS student_name, sn.national_id,
            u.name AS university_name, u.public_key AS university_public_key,
            u.key_reference AS university_key_reference,
            (c.signed_pdf IS NOT NULL) AS has_pdf_signature
     FROM certificates c
     JOIN students_new sn ON c.student_id    = sn.id
     JOIN universities u  ON c.university_id = u.id
     WHERE c.cert_number = ?`,
    [cert_number]
  );

  if (rows.length === 0)
    return res.status(404).json({
      status: "error", valid: false, message: "Certificate not found",
    });

  const cert = rows[0];

  if (cert.status === "revoked") {
    return res.json({
      status:  "success",
      valid:   false,
      reason:  "revoked",
      message: "This certificate has been revoked",
      certificate: {
        id:              cert.id,
        cert_number:     cert.cert_number,
        student_name:    cert.student_name,
        national_id:     cert.national_id,
        university:      cert.university_name,
        degree:          cert.degree,
        major:           cert.major,
        GPA:             cert.GPA,
        graduation_date: cert.graduation_date,
        issued_at:       cert.created_at,
        status:          cert.status,
        has_pdf_signature: !!cert.has_pdf_signature,
      },
    });
  }

  const payload = buildHashPayload({
    cert_number:     cert.cert_number,
    student_id:      cert.student_id,
    university_id:   cert.university_id,
    student_name:    cert.student_name,
    degree:          cert.degree,
    major:           cert.major,
    GPA:             cert.GPA,
    graduation_date: cert.graduation_date,
  });

  console.log("VERIFY payload  :", payload);

  const expectedHash = crypto.createHash("sha256").update(payload).digest("hex");
  console.log("VERIFY expected :", expectedHash);
  console.log("VERIFY stored   :", cert.certification_hash);

  const hashMatch = expectedHash === cert.certification_hash;

  let signatureValid = false;
  try {
    const rawSig    = cert.digital_signature.replace(/^vault:v\d+:/, "");
    const publicKey = await getVaultPublicKey(cert.university_key_reference);

    const verifier  = crypto.createVerify("SHA256");
    verifier.update(payload);
    signatureValid  = verifier.verify(
      {
        key:        publicKey,
        padding:    crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_AUTO,
      },
      Buffer.from(rawSig, "base64")
    );
  } catch (err) {
    console.error("Signature verify error:", err.message);
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
    certificate: {
      id:              cert.id,
      cert_number:     cert.cert_number,
      student_name:    cert.student_name,
      national_id:     cert.national_id,
      university:      cert.university_name,
      degree:          cert.degree,
      major:           cert.major,
      GPA:             cert.GPA,
      graduation_date: cert.graduation_date,
      issued_at:       cert.created_at,
      status:          cert.status,
      has_pdf_signature: !!cert.has_pdf_signature,
    },
    checks: {
      hash_match:       hashMatch,
      signature_valid:  signatureValid,
      pdf_signed:       !!cert.has_pdf_signature,
    },
  });
});

/*
==================================
VERIFY PDF UPLOAD (PUBLIC)
==================================
1. Validate magic bytes
2. Extract cert_number from PDF text
3. Verify embedded PKCS#7 signature
4. Cross-check DB for revocation
*/
const verifyPdfUpload = asyncHandler(async (req, res) => {
  if (!req.file)
    throw new AppError("Please upload a PDF file", 400);

  // ── 1. Magic bytes check ──
  const magic = req.file.buffer.slice(0, 4).toString("ascii");
  if (!magic.startsWith("%PDF"))
    throw new AppError("Uploaded file is not a valid PDF", 400);

  // ── 2. Extract cert_number from PDF text ──
 let cert_number = null;
try {
  const pdfData = await pdfParse(req.file.buffer);
  const match = pdfData.text.match(/UNIV-\d+-\d{4}-[A-F0-9]+/i);

  if (match) {
    cert_number = match[0].toUpperCase();
  }
} catch (parseErr) {
  console.error("pdf-parse error:", parseErr.message);
}
  if (!cert_number)
    throw new AppError(
      "Could not find a CertifyLB certificate number in this PDF. " +
      "Make sure you are uploading the original certificate PDF.",
      400
    );

  // ── 3. Verify PKCS#7 signature ──
  const sigResult = verifyPdfSignature(req.file.buffer);

  console.log("=== PDF VERIFY RESULT ===");
  console.log(JSON.stringify(sigResult, null, 2));
  console.log("=========================");

  // ── 4. Cross-check with DB ──
  const [rows] = await db.query(
    `SELECT c.cert_number, c.status, c.degree, c.major, c.GPA,
            c.graduation_date, c.created_at,
            sn.full_name AS student_name, sn.national_id,
            u.name AS university_name
     FROM certificates c
     JOIN students_new sn ON c.student_id    = sn.id
     JOIN universities u  ON c.university_id = u.id
     WHERE c.cert_number = ?`,
    [cert_number]
  );

  if (rows.length === 0) {
    return res.json({
      status:    "success",
      pdf_valid: false,
      message:   "Certificate number found in PDF but not in our database.",
      cert_number,
      signature: sigResult,
    });
  }

  const cert      = rows[0];
  const isRevoked = cert.status === "revoked";
  const overallValid = sigResult.valid && !isRevoked;

  return res.json({
    status:    "success",
    pdf_valid: overallValid,
    revoked:   isRevoked,
    cert_number,
    certificate: {
      cert_number:     cert.cert_number,
      student_name:    cert.student_name,
      national_id:     cert.national_id,
      degree:          cert.degree,
      major:           cert.major,
      GPA:             cert.GPA,
      graduation_date: cert.graduation_date,
      issued_at:       cert.created_at,
      university:      cert.university_name,
      cert_status:     cert.status,
    },
    signature: {
      valid:            sigResult.valid,
      signature_valid:  sigResult.signature_valid,
      cert_chain_valid: sigResult.cert_chain_valid,
      ca_match:         sigResult.ca_match,
      cert_expired:     sigResult.cert_expired,
      signer_name:      sigResult.signer_name,
      cert_valid_from:  sigResult.cert_valid_from,
      cert_valid_to:    sigResult.cert_valid_to,
    },
    message: isRevoked
      ? "❌ This certificate has been revoked."
      : overallValid
      ? `✅ PDF is authentic. Signed by ${sigResult.signer_name}, certified by CertifyLB.`
      : `❌ ${sigResult.message}`,
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
Serves the signed_pdf blob stored at issuance.
Falls back to signing on demand, then unsigned if no keys.
*/
const downloadCertificatePdf = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role, university_id } = req.user;

  const [rows] = await db.query(
    `SELECT c.*, sn.full_name AS student_name, sn.national_id,
            u.name AS university_name, u.x509_cert, u.pdf_signing_key
     FROM certificates c
     JOIN students_new sn ON c.student_id    = sn.id
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

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="certificate_${cert.cert_number}.pdf"`
  );

  // Case 1: serve stored signed PDF directly
  if (cert.signed_pdf) {
    return res.send(cert.signed_pdf);
  }

  // Case 2: no stored PDF — sign on demand
  if (cert.x509_cert && cert.pdf_signing_key) {
    try {
      const signedBuffer = await signPdf(cert, {
        name:            cert.university_name,
        x509_cert:       cert.x509_cert,
        pdf_signing_key: cert.pdf_signing_key,
      });
      await db.query(
        "UPDATE certificates SET signed_pdf = ? WHERE id = ?",
        [signedBuffer, id]
      );
      return res.send(signedBuffer);
    } catch (err) {
      console.error("On-demand PDF signing failed:", err.message);
    }
  }

  // Case 3: fallback unsigned PDF
  const unsignedBuffer = await buildPdfBuffer(cert);
  return res.send(unsignedBuffer);
});

module.exports = {
  issueCertificate,
  getCertificates,
  getCertificateById,
  verifyCertificate,
  verifyPdfUpload,
  revokeCertificate,
  downloadCertificatePdf,
  upload,
};