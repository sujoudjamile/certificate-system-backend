// server.js

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const userRoutes        = require("./routes/userRoutes");
const universityRoutes  = require("./routes/universityRoutes");
const staffRoutes       = require("./routes/staffRoutes");
const studentRoutes     = require("./routes/studentRoutes");
const fraudRoutes       = require("./routes/fraudRoutes");
const certificateRoutes = require("./routes/certificationRoutes");
const auditRoutes       = require("./routes/auditRoutes");

const errorHandler = require("./middleware/errorHandler");

const app = express();

/*
==================================
SECURITY MIDDLEWARE
==================================
*/

// Adds basic HTTP security headers
app.use(helmet());

// Enable CORS
app.use(cors());

// Allow server to read JSON body
app.use(express.json());

/*
==================================
RATE LIMITING
==================================
*/
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    status: "error",
    message: "Too many requests from this IP. Please try again later.",
  },
});

app.use("/api", apiLimiter);

/*
==================================
ROUTES
==================================
*/
app.use("/api/users", userRoutes);
app.use("/api/universities", universityRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/fraud", fraudRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/audit", auditRoutes);

/*
==================================
TEST ROUTE
==================================
*/
app.get("/", (req, res) => {
  res.send("Certificate System API Running...");
});

/*
==================================
GLOBAL ERROR HANDLER
==================================
*/
app.use(errorHandler);

/*
==================================
START SERVER
==================================
*/
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});