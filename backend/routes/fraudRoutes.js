const express = require("express");
const router = express.Router();
const { flagFraud, getFraudFlags, resolveFraudFlag } = require("../controllers/fraudController");
const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/rolemiddleware");

router.post("/flag",   auth, flagFraud);
router.get("/flags",   auth, authorizeRoles("admin", "super_admin"), getFraudFlags);
router.patch("/flags/:id/resolve", auth, authorizeRoles("admin", "super_admin"), resolveFraudFlag);

module.exports = router;