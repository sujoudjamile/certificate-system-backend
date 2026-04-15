const express = require("express");
const router = express.Router();
const { flagFraud } = require("../controllers/fraudController");
const auth = require("../middleware/authMiddleware");

router.post("/flag", auth, flagFraud);

module.exports = router;