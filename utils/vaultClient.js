// utils/vaultClient.js

const axios = require("axios");

/*
==================================
VAULT CLIENT
==================================
Used to call HashiCorp Vault API
*/
const vault = axios.create({
  baseURL: process.env.VAULT_ADDR,
  headers: {
    "X-Vault-Token": process.env.VAULT_TOKEN,
  },
});

/*
==================================
CREATE UNIVERSITY KEY IN VAULT
==================================
Creates RSA signing key inside Vault Transit
Private key remains inside Vault
*/
const createVaultKey = async (keyName) => {
  await vault.post(`/v1/transit/keys/${keyName}`, {
    type: "rsa-2048",
  });
};

/*
==================================
GET PUBLIC KEY FROM VAULT
==================================
Reads public key from Vault so it can be stored in DB
*/
const getVaultPublicKey = async (keyName) => {
  const response = await vault.get(`/v1/transit/keys/${keyName}`);

  const keys = response.data.data.keys;
  const firstVersion = Object.keys(keys)[0];

  return keys[firstVersion].public_key;
};




/*
==================================
SIGN DATA WITH VAULT
==================================
Uses Vault Transit to sign data with the university's
private RSA key — the key never leaves Vault.
 
- input must be base64-encoded
- Vault returns: "vault:v1:<base64-signature>"
- We store the full vault-prefixed string in the DB
- During verification, we strip the prefix to get raw sig bytes
 
hash_algorithm is sha2-256 to match our SHA-256 payload hash.
prehashed: true tells Vault the input is already a hash.
signature_algorithm: pkcs1v15 (widely supported, compatible with
  Node crypto.verify using RSA_PKCS1_PSS_PADDING alternative below)
 
NOTE: Vault rsa-2048 Transit defaults to pss + sha2-256.
We use pss here to match what Node's crypto.verify expects.
*/
const signWithVault = async (keyName, base64Input) => {
  const response = await vault.post(`/v1/transit/sign/${keyName}`, {
    input: base64Input,
    hash_algorithm: "sha2-256",
    prehashed: true,
    signature_algorithm: "pss",
  });
 
  // Returns "vault:v1:<base64signature>"
  return response.data.data.signature;
};
 
module.exports = {
  createVaultKey,
  getVaultPublicKey,
  signWithVault,
};
 