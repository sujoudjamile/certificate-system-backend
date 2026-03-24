require("dotenv").config();// Load environment variables
const express = require("express"); //Create APIs, Handle routes, Handle requests & responses,Build backend logic easily //
const cors = require("cors");//Your frontend (React) runs on port 3000,Your backend runs on port 5000 ,Browsers normally block that communication.cors() allows frontend and backend to talk safely.
const db = require("./config/db");

const userRoutes = require("./routes/userRoutes");// Import routes
const universityRoutes = require("./routes/universityRoutes");
const staffRoutes = require("./routes/staffRoutes");

const app = express();//This creates your Express application.Think of it like:👉 "Start my backend server engine"

app.use(cors());// Enable CORS so frontend can communicate with backend
app.use(express.json());// Allow server to read JSON data from requests
app.use("/api/users", userRoutes);// Use user routes
app.use("/api/universities", universityRoutes);
app.use("/api/staff", staffRoutes);

app.get("/", (req, res) => {// Test route to check if server is running
  res.send("Certificate System API Running...");
});

app.listen(5000, () => {// Start server on port 5000
  console.log("Server running on port 5000");
});