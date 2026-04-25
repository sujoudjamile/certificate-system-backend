
// Import Node's built-in crypto library
const crypto = require("crypto");

/*
==================================
GET MASTER KEY
==================================
This function reads the master key from the .env file.

Why do we need this?
Because we want to encrypt the RSA private key before storing it in MySQL.
*/
const getMasterKey = () => {
  // Read the secret from .env
  const secret = process.env.PRIVATE_KEY_MASTER_SECRET;

  // If it does not exist, stop the app with an error
  if (!secret) {
    throw new Error("PRIVATE_KEY_MASTER_SECRET is missing in .env");
  }

  // Convert the hex string into a Buffer
  const key = Buffer.from(secret, "hex");

  // AES-256 requires exactly 32 bytes
  if (key.length !== 32) {
    throw new Error("PRIVATE_KEY_MASTER_SECRET must be 32 bytes (64 hex characters)");
  }

  return key;
};

/*
==================================
ENCRYPT PRIVATE KEY
==================================
This function takes the plain RSA private key
and encrypts it using AES-256-GCM.

Why AES-256-GCM?
Because it is strong and also gives integrity protection.
*/
const encryptPrivateKey = (plainTextPrivateKey) => {
  // Get the AES master key
  const masterKey = getMasterKey();

  // Create a random IV (initialization vector)
  // 12 bytes is standard for GCM mode
  const iv = crypto.randomBytes(12);

  // Create the cipher
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, iv);

  // Encrypt the private key
  let encrypted = cipher.update(plainTextPrivateKey, "utf8", "hex");
  encrypted += cipher.final("hex");

  // Get the authentication tag
  const tag = cipher.getAuthTag();

  // Return all values needed later for decryption
  return {
    encryptedData: encrypted,
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
  };
};

/*
==================================
DECRYPT PRIVATE KEY
==================================
This function is used later when you need
the original private key to sign certificates.
*/
const decryptPrivateKey = ({ encryptedData, iv, tag }) => {
  // Get the AES master key
  const masterKey = getMasterKey();

  // Create the decipher
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    masterKey,
    Buffer.from(iv, "hex")
  );

  // Add the authentication tag
  decipher.setAuthTag(Buffer.from(tag, "hex"));

  // Decrypt the private key
  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
};

// Export both functions
module.exports = {
  encryptPrivateKey,
  decryptPrivateKey,
};