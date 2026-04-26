// utils/pdfSigner.js

const forge  = require("node-forge");
const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");
const { plainAddPlaceholder } = require("@signpdf/placeholder-plain");
const { P12Signer }           = require("@signpdf/signer-p12");
const signpdf                 = require("@signpdf/signpdf").default;
const PDFDocument             = require("pdfkit");

/*
==================================
ROOT CA — loaded once at startup
==================================
*/
const ROOT_CA_CERT_PATH = path.join(__dirname, "../certs/rootCA.cert.pem");
const ROOT_CA_KEY_PATH  = path.join(__dirname, "../certs/rootCA.key.pem");

let _rootCACert = null;
let _rootCAKey  = null;

const loadRootCA = () => {
  if (_rootCACert && _rootCAKey) return;

  if (!fs.existsSync(ROOT_CA_CERT_PATH) || !fs.existsSync(ROOT_CA_KEY_PATH)) {
    throw new Error(
      "Root CA not found. Run: node scripts/generateRootCA.js"
    );
  }

  _rootCACert = forge.pki.certificateFromPem(
    fs.readFileSync(ROOT_CA_CERT_PATH, "utf8")
  );
  _rootCAKey = forge.pki.privateKeyFromPem(
    fs.readFileSync(ROOT_CA_KEY_PATH, "utf8")
  );
};

const getRootCACertPem = () => {
  loadRootCA();
  return forge.pki.certificateToPem(_rootCACert);
};

/*
==================================
ENCRYPT / DECRYPT UNIVERSITY KEY
==================================
*/
const ALGO = "aes-256-gcm";

const encryptPrivateKey = (privateKeyPem) => {
  const secret = process.env.PDF_KEY_SECRET;
  if (!secret || secret.length < 64) {
    throw new Error(
      "PDF_KEY_SECRET must be a 64-character hex string in .env. " +
      "Generate: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  const key    = Buffer.from(secret, "hex").slice(0, 32);
  const iv     = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(privateKeyPem, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
};

const decryptPrivateKey = (stored) => {
  const secret = process.env.PDF_KEY_SECRET;
  if (!secret || secret.length < 64) {
    throw new Error("PDF_KEY_SECRET must be a 64-character hex string in .env.");
  }

  const [ivHex, authTagHex, encryptedHex] = stored.split(":");
  const key       = Buffer.from(secret, "hex").slice(0, 32);
  const iv        = Buffer.from(ivHex, "hex");
  const authTag   = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted) + decipher.final("utf8");
};

/*
==================================
GENERATE UNIVERSITY X.509 CERT
==================================
*/
const generateUniversityCert = (universityName) => {
  loadRootCA();

  console.log(`🔐 Generating X.509 cert for: ${universityName}`);

  const keys = forge.pki.rsa.generateKeyPair(2048);

  const cert        = forge.pki.createCertificate();
  cert.publicKey    = keys.publicKey;
  cert.serialNumber = crypto.randomBytes(8).toString("hex").toUpperCase();

  cert.validity.notBefore = new Date();
  cert.validity.notAfter  = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);

  cert.setSubject([
    { name: "commonName",          value: universityName },
    { name: "organizationName",    value: universityName },
    { name: "countryName",         value: "LB"           },
    { name: "stateOrProvinceName", value: "Lebanon"      },
  ]);

  cert.setIssuer(_rootCACert.subject.attributes);

  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, nonRepudiation: true, critical: true },
    { name: "extKeyUsage", emailProtection: true },
    { name: "subjectKeyIdentifier" },
  ]);

  cert.sign(_rootCAKey, forge.md.sha256.create());

  const x509CertPem      = forge.pki.certificateToPem(cert);
  const privateKeyPem    = forge.pki.privateKeyToPem(keys.privateKey);
  const encryptedPrivKey = encryptPrivateKey(privateKeyPem);

  console.log(`✅ X.509 cert generated for ${universityName}`);

  return { x509CertPem, encryptedPrivateKey: encryptedPrivKey };
};

/*
==================================
BUILD P12 BUNDLE
==================================
*/
const buildP12 = (x509CertPem, encryptedPrivKey, universityName) => {
  loadRootCA();

  const privateKeyPem = decryptPrivateKey(encryptedPrivKey);
  const privateKey    = forge.pki.privateKeyFromPem(privateKeyPem);
  const uniCert       = forge.pki.certificateFromPem(x509CertPem);

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
    privateKey,
    [uniCert, _rootCACert],
    "certifylb",
    { algorithm: "3des", friendlyName: universityName }
  );

  return Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), "binary");
};

/*
==================================
BUILD PDF BUFFER (unsigned)
==================================
*/
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

const buildPdfBuffer = (cert) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size:    "A4",
      margins: { top: 60, bottom: 60, left: 72, right: 72 },
    });

    const chunks = [];
    doc.on("data",  (c) => chunks.push(c));
    doc.on("end",   ()  => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const L = 72;

    doc.rect(0, 0, pageWidth, 10).fill("#1a3c6e");

    doc.moveDown(1)
       .font("Helvetica-Bold").fontSize(22).fillColor("#1a3c6e")
       .text(cert.university_name, { align: "center" });

    doc.moveDown(0.3)
       .font("Helvetica").fontSize(11).fillColor("#555555")
       .text("Official Academic Certificate", { align: "center" });

    doc.moveDown(0.8);
    doc.moveTo(L, doc.y).lineTo(pageWidth - L, doc.y)
       .strokeColor("#1a3c6e").lineWidth(1.5).stroke();

    doc.moveDown(1.5)
       .font("Helvetica-Bold").fontSize(18).fillColor("#222222")
       .text("CERTIFICATE OF GRADUATION", { align: "center" });

    doc.moveDown(0.4)
       .font("Helvetica").fontSize(12).fillColor("#444444")
       .text("This is to certify that", { align: "center" });

    doc.moveDown(0.6)
       .font("Helvetica-Bold").fontSize(20).fillColor("#1a3c6e")
       .text(cert.student_name, { align: "center" });

    doc.moveDown(0.4)
       .font("Helvetica").fontSize(11).fillColor("#444444")
       .text(`National ID: ${cert.national_id}`, { align: "center" });

    doc.moveDown(0.8)
       .font("Helvetica").fontSize(12).fillColor("#333333")
       .text("has successfully completed the requirements for the degree of", { align: "center" });

    doc.moveDown(0.4)
       .font("Helvetica-Bold").fontSize(15).fillColor("#222222")
       .text(`${cert.degree} in ${cert.major}`, { align: "center" });

    if (cert.GPA)
      doc.moveDown(0.4)
         .font("Helvetica").fontSize(12).fillColor("#444444")
         .text(`with a GPA of ${parseFloat(cert.GPA).toFixed(2)}`, { align: "center" });

    doc.moveDown(0.4)
       .font("Helvetica").fontSize(12).fillColor("#444444")
       .text(`Graduation Date: ${formatDatePdf(cert.graduation_date)}`, { align: "center" });

    doc.moveDown(1.2);
    doc.moveTo(L, doc.y).lineTo(pageWidth - L, doc.y)
       .strokeColor("#cccccc").lineWidth(0.8).stroke();

    const metaY = doc.y + 16;

    doc.font("Helvetica").fontSize(9).fillColor("#666666")
       .text(`Certificate No: ${cert.cert_number}`,               L, metaY)
       .text(`Issued: ${formatDatePdf(cert.created_at)}`,         L, metaY + 14)
       .text(`Status: ${(cert.status || "ISSUED").toUpperCase()}`, L, metaY + 28)
       .text(
         `Data Hash (SHA-256): ${cert.certification_hash}`,
         L, metaY + 42,
         { width: pageWidth - L * 2 - 130 }
       )
       .text(
         `Digitally signed by ${cert.university_name} · Certified by CertifyLB`,
         L, metaY + 58,
         { width: pageWidth - L * 2 - 130 }
       );

    if (cert.qr_code) {
      const qrBuffer = Buffer.from(
        cert.qr_code.replace(/^data:image\/png;base64,/, ""), "base64"
      );
      doc.image(qrBuffer, pageWidth - L - 110, metaY - 10, { width: 110, height: 110 });
      doc.font("Helvetica").fontSize(7).fillColor("#888888")
         .text("Scan to verify", pageWidth - L - 110, metaY + 112, {
           width: 110, align: "center",
         });
    }

    const footerY = doc.page.height - 40;
    doc.rect(0, footerY, pageWidth, 10).fill("#1a3c6e");
    doc.font("Helvetica").fontSize(8).fillColor("#888888").text(
      `Verify at: ${process.env.FRONTEND_URL}/verify/${cert.cert_number}`,
      L, footerY - 14,
      { align: "center", width: pageWidth - L * 2 }
    );

    doc.end();
  });
};

/*
==================================
SIGN PDF
==================================
*/
const signPdf = async (certData, university) => {
  if (!university.x509_cert || !university.pdf_signing_key) {
    throw new Error(
      `University "${university.name}" does not have a PDF signing certificate.`
    );
  }

  const unsignedPdfBuffer = await buildPdfBuffer(certData);

  const pdfWithPlaceholder = plainAddPlaceholder({
    pdfBuffer:       unsignedPdfBuffer,
    reason:          "Official Academic Certificate",
    contactInfo:     process.env.FRONTEND_URL || "certify.lb",
    name:            university.name,
    location:        "Lebanon",
    signatureLength: 8192,
  });

  const p12Buffer = buildP12(
    university.x509_cert,
    university.pdf_signing_key,
    university.name
  );

  const signer    = new P12Signer(p12Buffer, { passphrase: "certifylb" });
  const signedPdf = await signpdf.sign(pdfWithPlaceholder, signer);

  return signedPdf;
};

/*
==================================
VERIFY PDF SIGNATURE
==================================

PKCS#7 detached (adbe.pkcs7.detached) verification — correct flow:

  1. Extract ByteRange → get the exact bytes that were signed
  2. Extract /Contents hex → the PKCS#7 blob
  3. Parse PKCS#7 ASN.1 → get certificates + signerInfo
  4. Verify certificate chain (uni cert signed by CertifyLB Root CA)
  5. From signerInfo, extract:
       a. signedAttributes [0]  — contains messageDigest
       b. encryptedDigest       — the actual RSA signature bytes
  6. Check: SHA256(pdf_byte_ranges) === messageDigest in signedAttributes
  7. Re-encode signedAttributes with SET tag (0x31 instead of 0xA0)
  8. Verify: RSA_verify(SHA256(DER(signedAttributes)), encryptedDigest, publicKey)

Steps 6 + 8 are the correct PKCS#7 verification.
Step 6 proves the PDF bytes are untouched.
Step 8 proves the signedAttributes were signed by the private key.
*/
const verifyPdfSignature = (pdfBuffer) => {
  try {
    loadRootCA();

    const pdfStr = pdfBuffer.toString("binary");

    // ── 1. Extract ByteRange ──
    const byteRangeMatch = pdfStr.match(
      /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/
    );

    if (!byteRangeMatch) {
      return _fail("no_signature", "No digital signature found in this PDF.");
    }

    const p1Start  = parseInt(byteRangeMatch[1]);
    const p1Length = parseInt(byteRangeMatch[2]);
    const p2Start  = parseInt(byteRangeMatch[3]);
    const p2Length = parseInt(byteRangeMatch[4]);

    // ── 2. Extract /Contents hex blob ──
    const contentsMatch = pdfStr.match(/\/Contents\s*<([0-9a-fA-F\s]+)>/i);
    if (!contentsMatch) {
      return _fail("no_contents", "Signature contents not found in PDF.");
    }

    // Strip whitespace and trailing zero-padding
    const rawHex   = contentsMatch[1].replace(/\s/g, "");
    const cleanHex = _stripTrailingZeros(rawHex);

    // ── 3. Assemble the signed byte ranges ──
    const signedBytes = Buffer.concat([
      pdfBuffer.slice(p1Start,  p1Start  + p1Length),
      pdfBuffer.slice(p2Start,  p2Start  + p2Length),
    ]);

    // ── 4. Parse PKCS#7 blob ──
    let p7Asn1;
    try {
      const p7Der = forge.util.hexToBytes(cleanHex);
      p7Asn1 = forge.asn1.fromDer(p7Der);
    } catch (e) {
      return _fail("pkcs7_parse_error", "Could not parse PKCS#7 blob: " + e.message);
    }

    // ── 5. Navigate ASN.1 to SignedData ──
    // ContentInfo → [0] → SignedData
    let signedDataAsn1;
    try {
      signedDataAsn1 = p7Asn1.value[1].value[0];
    } catch (e) {
      return _fail("asn1_nav_error", "Cannot navigate to SignedData in PKCS#7.");
    }

    // ── 6. Extract embedded certificates ──
    let certs = [];
    try {
      const p7 = forge.pkcs7.messageFromAsn1(p7Asn1);
      certs = p7.certificates || [];
    } catch (e) {
      // fallback: parse certs manually from ASN.1
      console.warn("forge.pkcs7.messageFromAsn1 fallback:", e.message);
    }

    if (certs.length === 0) {
      return _fail("no_cert_in_pdf", "No certificate embedded in this PDF.");
    }

    const signerCert     = certs.find(
      (c) => c.subject.getField("CN")?.value !== "CertifyLB Root CA"
    );
    const embeddedCACert = certs.find(
      (c) => c.subject.getField("CN")?.value === "CertifyLB Root CA"
    );

    if (!signerCert) {
      return _fail("no_signer_cert", "University signer certificate not found in PDF.");
    }

    // ── 7. Verify CA match ──
    const ourRootCAPem  = forge.pki.certificateToPem(_rootCACert);
    const embCAPem      = embeddedCACert ? forge.pki.certificateToPem(embeddedCACert) : null;
    const caMatch       = embCAPem === ourRootCAPem;

    // ── 8. Verify certificate chain ──
    let certChainValid = false;
    try {
      certChainValid = _rootCACert.verify(signerCert);
    } catch {
      certChainValid = false;
    }

    // ── 9. Navigate to signerInfo in ASN.1 ──
    // SignedData fields (in order):
    //   version, digestAlgorithms, encapContentInfo,
    //   [0] certificates (optional), [1] CRLs (optional),
    //   signerInfos SET
    // We find the last UNIVERSAL SET — that is signerInfos
    let signerInfoAsn1 = null;
    for (let i = signedDataAsn1.value.length - 1; i >= 0; i--) {
      const f = signedDataAsn1.value[i];
      if (
        f.tagClass === forge.asn1.Class.UNIVERSAL &&
        f.type    === forge.asn1.Type.SET &&
        f.value.length > 0
      ) {
        signerInfoAsn1 = f.value[0]; // first (and only) SignerInfo
        break;
      }
    }

    if (!signerInfoAsn1) {
      return _failWith(caMatch, certChainValid, "no_signer_info",
        "Could not locate signerInfo in PKCS#7 structure.");
    }

    // ── 10. Extract signedAttrs [0] and encryptedDigest from signerInfo ──
    // SignerInfo SEQUENCE:
    //   INTEGER version
    //   sid (IssuerAndSerialNumber SEQUENCE or [0] SubjectKeyIdentifier)
    //   AlgorithmIdentifier digestAlgorithm
    //   [0] signedAttrs       ← CONTEXT, tag 0, constructed
    //   AlgorithmIdentifier signatureAlgorithm
    //   OCTET STRING encryptedDigest   ← the RSA signature
    let signedAttrsAsn1  = null;
    let encryptedDigest  = null; // binary string

    for (const field of signerInfoAsn1.value) {
      // signedAttrs: CONTEXT_SPECIFIC, tag 0, constructed
      if (
        field.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC &&
        field.type     === 0 &&
        field.constructed
      ) {
        signedAttrsAsn1 = field;
      }
      // encryptedDigest: UNIVERSAL OCTET STRING
      if (
        field.tagClass === forge.asn1.Class.UNIVERSAL &&
        field.type     === forge.asn1.Type.OCTETSTRING
      ) {
        encryptedDigest = field.value; // binary string
      }
    }

    if (!signedAttrsAsn1 || !encryptedDigest) {
      return _failWith(caMatch, certChainValid, "no_signed_attrs",
        "Could not extract signedAttributes or signature from signerInfo.");
    }

    // ── 11. Verify messageDigest attribute ──
    // PKCS#7 requires: SHA256(pdf_byte_ranges) === messageDigest attribute
    const pdfMd = forge.md.sha256.create();
    pdfMd.update(forge.util.createBuffer(signedBytes).getBytes());
    const computedPdfDigest = pdfMd.digest().getBytes();

    // Find messageDigest OID (1.2.840.113549.1.9.4) in signedAttrs
    let storedMessageDigest = null;
    for (const attr of signedAttrsAsn1.value) {
      if (
        attr.tagClass === forge.asn1.Class.UNIVERSAL &&
        attr.type     === forge.asn1.Type.SEQUENCE &&
        attr.value.length >= 2
      ) {
        try {
          const attrOid = forge.asn1.derToOid(attr.value[0].value);
          if (attrOid === "1.2.840.113549.1.9.4") {
            // messageDigest value is: SET { OCTET STRING }
            storedMessageDigest = attr.value[1].value[0].value;
          }
        } catch { /* skip */ }
      }
    }

    const contentHashMatch =
      storedMessageDigest !== null &&
      storedMessageDigest === computedPdfDigest;

    console.log("contentHashMatch (pdf bytes vs messageDigest attr):", contentHashMatch);

    // ── 12. Verify RSA signature over DER(signedAttrs) ──
    // The signature covers DER-encoding of signedAttrs re-tagged as SET (0x31)
    // PKCS#7 spec: signedAttrs is IMPLICIT [0] during transmission but
    // must be re-tagged as EXPLICIT SET before hashing for signature verification
    let signatureValid = false;
    try {
      // Re-encode signedAttrs as UNIVERSAL SET (tag 0x31)
      const signedAttrsCopy = forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.SET,
        true,              // constructed
        signedAttrsAsn1.value
      );
      const signedAttrsDer = forge.asn1.toDer(signedAttrsCopy).getBytes();

      // Hash the DER-encoded signedAttrs
      const attrsMd = forge.md.sha256.create();
      attrsMd.update(signedAttrsDer);
      const attrsDigest = attrsMd.digest().getBytes();

      // RSA verify: publicKey.verify(digest, signature)
      signatureValid = signerCert.publicKey.verify(attrsDigest, encryptedDigest);
      console.log("RSA signature verify result:", signatureValid);

    } catch (sigErr) {
      console.error("RSA verify error:", sigErr.message);
      signatureValid = false;
    }

    // ── 13. Final result ──
    const now           = new Date();
    const isCertExpired = now > signerCert.validity.notAfter;
    const signerName    = signerCert.subject.getField("CN")?.value || "Unknown";

    // Both checks must pass:
    //   contentHashMatch → PDF bytes are untouched since signing
    //   signatureValid   → signedAttrs were signed by the real private key
    const valid = contentHashMatch && signatureValid && certChainValid && caMatch;

    return {
      valid,
      signature_valid:  contentHashMatch && signatureValid,
      cert_chain_valid: certChainValid,
      ca_match:         caMatch,
      cert_expired:     isCertExpired,
      signer_name:      signerName,
      cert_valid_from:  signerCert.validity.notBefore,
      cert_valid_to:    signerCert.validity.notAfter,
      message: valid
        ? `Valid signature by ${signerName}, certified by CertifyLB`
        : !contentHashMatch
        ? "PDF content does not match the embedded message digest"
        : !signatureValid
        ? "RSA signature over signed attributes is invalid"
        : !certChainValid
        ? "University certificate chain is broken"
        : !caMatch
        ? "Certificate was not issued by CertifyLB Root CA"
        : "Signature verification failed",
    };

  } catch (err) {
    console.error("verifyPdfSignature unexpected error:", err.message, err.stack);
    return _fail("verification_error", "Could not verify PDF: " + err.message);
  }
};

/*
==================================
HELPERS FOR RETURN VALUES
==================================
*/
const _fail = (reason, message) => ({
  valid:            false,
  signature_valid:  false,
  cert_chain_valid: false,
  ca_match:         false,
  cert_expired:     false,
  reason,
  message,
});

const _failWith = (caMatch, certChainValid, reason, message) => ({
  valid:            false,
  signature_valid:  false,
  cert_chain_valid: certChainValid,
  ca_match:         caMatch,
  cert_expired:     false,
  reason,
  message,
});

// Strip trailing zero-padding that @signpdf adds to fill the reserved space.
// The real PKCS#7 data starts at the first byte (0x30 = ASN.1 SEQUENCE).
// Trailing 00 bytes after the actual data are pure padding.
const _stripTrailingZeros = (hex) => {
  let end = hex.length;
  while (end > 2 && hex[end - 2] === "0" && hex[end - 1] === "0") {
    end -= 2;
  }
  return end % 2 === 0 ? hex.slice(0, end) : hex.slice(0, end - 1);
};

module.exports = {
  generateUniversityCert,
  signPdf,
  verifyPdfSignature,
  getRootCACertPem,
  buildPdfBuffer,
};