// utils/certRenewal.js

const db = require("../config/db");
const { generateUniversityCert } = require("./pdfSigner");

/*
==================================
HOW EXPIRY WORKS
==================================

Each university X.509 cert is valid for 2 years.
We renew automatically when fewer than 30 days remain.

Old signed PDFs: NEVER affected.
  The signing time is embedded inside the PDF's PKCS#7 blob.
  Verification checks: "was the cert valid AT signing time?" → yes.
  The cert expiring later never invalidates old signatures.

New certificates issued after renewal: use the new cert automatically.
  No action needed from university admins.
*/

const RENEW_THRESHOLD_DAYS = 30; // renew if expiring within 30 days

/*
==================================
PARSE EXPIRY FROM X.509 PEM
==================================
*/
const getExpiryFromPem = (x509Pem) => {
  try {
    const forge = require("node-forge");
    const cert  = forge.pki.certificateFromPem(x509Pem);
    return cert.validity.notAfter; // JavaScript Date object
  } catch {
    return null;
  }
};

/*
==================================
CHECK AND RENEW ONE UNIVERSITY
==================================
*/
const checkAndRenewUniversity = async (university) => {
  if (!university.x509_cert) {
    console.log(`⚠️  [CertRenewal] ${university.name} has no X.509 cert — generating one now`);
    try {
      const { x509CertPem, encryptedPrivateKey } = generateUniversityCert(university.name);
      await db.query(
        "UPDATE universities SET x509_cert = ?, pdf_signing_key = ? WHERE id = ?",
        [x509CertPem, encryptedPrivateKey, university.id]
      );
      console.log(`✅ [CertRenewal] Generated new cert for ${university.name}`);
      return { action: "generated", university: university.name };
    } catch (err) {
      console.error(`❌ [CertRenewal] Failed to generate for ${university.name}:`, err.message);
      return { action: "failed", university: university.name, error: err.message };
    }
  }

  const expiry = getExpiryFromPem(university.x509_cert);
  if (!expiry) {
    console.error(`❌ [CertRenewal] Could not parse expiry for ${university.name}`);
    return { action: "parse_error", university: university.name };
  }

  const now        = new Date();
  const daysLeft   = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));

  console.log(`📋 [CertRenewal] ${university.name}: cert expires in ${daysLeft} days (${expiry.toDateString()})`);

  if (daysLeft > RENEW_THRESHOLD_DAYS) {
    // No action needed
    return { action: "ok", university: university.name, days_left: daysLeft };
  }

  // Needs renewal
  console.log(`🔄 [CertRenewal] Renewing cert for ${university.name} (${daysLeft} days left)...`);

  try {
    const { x509CertPem, encryptedPrivateKey } = generateUniversityCert(university.name);

    await db.query(
      "UPDATE universities SET x509_cert = ?, pdf_signing_key = ? WHERE id = ?",
      [x509CertPem, encryptedPrivateKey, university.id]
    );

    const newExpiry    = getExpiryFromPem(x509CertPem);
    const newDaysLeft  = Math.floor((newExpiry - now) / (1000 * 60 * 60 * 24));

    console.log(`✅ [CertRenewal] Renewed cert for ${university.name} — now valid for ${newDaysLeft} days`);

    return {
      action:      "renewed",
      university:  university.name,
      old_expiry:  expiry.toISOString(),
      new_expiry:  newExpiry.toISOString(),
      days_left:   newDaysLeft,
    };
  } catch (err) {
    console.error(`❌ [CertRenewal] Renewal failed for ${university.name}:`, err.message);
    return { action: "failed", university: university.name, error: err.message };
  }
};

/*
==================================
CHECK ALL UNIVERSITIES
==================================
*/
const checkAllCerts = async () => {
  console.log("\n🔍 [CertRenewal] Starting certificate expiry check...");

  let universities;
  try {
    const [rows] = await db.query(
      "SELECT id, name, x509_cert FROM universities ORDER BY id ASC"
    );
    universities = rows;
  } catch (err) {
    console.error("❌ [CertRenewal] DB query failed:", err.message);
    return;
  }

  if (universities.length === 0) {
    console.log("📋 [CertRenewal] No universities found.");
    return;
  }

  const results = [];
  for (const uni of universities) {
    const result = await checkAndRenewUniversity(uni);
    results.push(result);
  }

  const renewed  = results.filter(r => r.action === "renewed").length;
  const generated = results.filter(r => r.action === "generated").length;
  const failed   = results.filter(r => r.action === "failed").length;
  const ok       = results.filter(r => r.action === "ok").length;

  console.log(`\n✅ [CertRenewal] Check complete:`);
  console.log(`   ${ok} OK · ${renewed} renewed · ${generated} generated · ${failed} failed`);
  console.log("");

  return results;
};

/*
==================================
START AUTO-RENEWAL SCHEDULER
==================================
Runs once on server startup, then every 24 hours.
*/
const startCertRenewalScheduler = () => {
  const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Run immediately on startup (after a short delay to let DB connect)
  setTimeout(async () => {
    await checkAllCerts();
  }, 5000); // 5 second delay after server starts

  // Then every 24 hours
  setInterval(async () => {
    await checkAllCerts();
  }, INTERVAL_MS);

  console.log("🔄 [CertRenewal] Auto-renewal scheduler started (checks every 24 hours)");
};

module.exports = {
  startCertRenewalScheduler,
  checkAllCerts,            // export so you can call manually
  checkAndRenewUniversity,  // export for testing individual unis
};