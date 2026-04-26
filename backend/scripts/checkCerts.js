// scripts/checkCerts.js
// Run manually: node scripts/checkCerts.js

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { checkAllCerts } = require("../utils/certRenewal");

checkAllCerts()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
  