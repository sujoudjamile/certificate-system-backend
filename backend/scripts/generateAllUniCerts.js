// scripts/generateAllUniCerts.js
// Run ONCE for existing universities: node scripts/generateAllUniCerts.js

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const db = require("../config/db");
const { generateUniversityCert } = require("../utils/pdfSigner");

const run = async () => {
  const [universities] = await db.query(
    "SELECT id, name FROM universities WHERE x509_cert IS NULL"
  );

  if (universities.length === 0) {
    console.log("✅ All universities already have X.509 certificates.");
    process.exit(0);
  }

  console.log(`📋 Found ${universities.length} universities without X.509 certs.`);

  for (const uni of universities) {
    try {
      console.log(`\n🔐 Processing: ${uni.name} (id: ${uni.id})`);

      const { x509CertPem, encryptedPrivateKey } = generateUniversityCert(uni.name);

      await db.query(
        "UPDATE universities SET x509_cert = ?, pdf_signing_key = ? WHERE id = ?",
        [x509CertPem, encryptedPrivateKey, uni.id]
      );

      console.log(`✅ Done: ${uni.name}`);
    } catch (err) {
      console.error(`❌ Failed for ${uni.name}:`, err.message);
    }
  }

  console.log("\n✅ All universities processed.");
  process.exit(0);
};

run().catch(console.error);