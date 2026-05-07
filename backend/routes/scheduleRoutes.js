// routes/scheduleRoutes.js

const express    = require("express");
const router     = express.Router();
const authenticate   = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const {
  getSchedule,
  setSchedule,
  getHolidays,
  addHoliday,
  deleteHoliday,
} = require("../controllers/scheduleController");

// All schedule routes require admin authentication
router.use(authenticate);
router.use(authorizeRoles("admin", "super_admin"));

// Working hours & days
router.get("/",              getSchedule);   // GET  /api/schedule
router.put("/",              setSchedule);   // PUT  /api/schedule

// Holidays / off-days
router.get("/holidays",      getHolidays);          // GET    /api/schedule/holidays
router.post("/holidays",     addHoliday);            // POST   /api/schedule/holidays
router.delete("/holidays/:id", deleteHoliday);       // DELETE /api/schedule/holidays/:id

module.exports = router;