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

module.exports = {
  createVaultKey,
  getVaultPublicKey,
};