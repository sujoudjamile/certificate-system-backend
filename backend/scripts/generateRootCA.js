// scripts/generateRootCA.js
// Run ONCE with: node scripts/generateRootCA.js

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const forge = require("node-forge");
const fs    = require("fs");
const path  = require("path");

const CERT_PATH = path.join(__dirname, "../certs/rootCA.cert.pem");
const KEY_PATH  = path.join(__dirname, "../certs/rootCA.key.pem");

const run = () => {
  // Check if already generated
  if (fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)) {
    console.log("✅ Root CA already exists. Delete certs/ files to regenerate.");
    return;
  }

  console.log("🔐 Generating CertifyLB Root CA (RSA-2048)...");
  console.log("   This takes about 5-10 seconds...");

  // Generate RSA-2048 key pair
  const keys = forge.pki.rsa.generateKeyPair(2048);

  // Create self-signed certificate
  const cert = forge.pki.createCertificate();
  cert.publicKey    = keys.publicKey;
  cert.serialNumber = "01";

  cert.validity.notBefore = new Date();
  cert.validity.notAfter  = new Date();
  cert.validity.notAfter.setFullYear(
    cert.validity.notBefore.getFullYear() + 10  // valid 10 years
  );

  const attrs = [
    { name: "commonName",       value: "CertifyLB Root CA"   },
    { name: "organizationName", value: "CertifyLB"           },
    { name: "countryName",      value: "LB"                  },
    { name: "stateOrProvinceName", value: "Beirut"           },
  ];

  cert.setSubject(attrs);
  cert.setIssuer(attrs); // self-signed: issuer = subject

  cert.setExtensions([
    { name: "basicConstraints", cA: true, critical: true },
    { name: "keyUsage",
      keyCertSign: true,
      cRLSign:     true,
      critical:    true },
    { name: "subjectKeyIdentifier" },
  ]);

  // Self-sign with SHA-256
  cert.sign(keys.privateKey, forge.md.sha256.create());

  // Save to files
  fs.mkdirSync(path.join(__dirname, "../certs"), { recursive: true });

  fs.writeFileSync(CERT_PATH, forge.pki.certificateToPem(cert));
  fs.writeFileSync(KEY_PATH,  forge.pki.privateKeyToPem(keys.privateKey));

  // Set restrictive permissions on private key
  fs.chmodSync(KEY_PATH, 0o600);

  console.log("✅ Root CA generated successfully!");
  console.log(`   Certificate: ${CERT_PATH}`);
  console.log(`   Private Key: ${KEY_PATH}`);
  console.log("");
  console.log("⚠️  IMPORTANT:");
  console.log("   - NEVER commit rootCA.key.pem to git");
  console.log("   - Back up both files securely");
  console.log("   - rootCA.cert.pem can be shared publicly");
};

run();
