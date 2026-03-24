// config/db.js

// Import mysql2 in promise mode
// This allows us to use async/await
const mysql = require("mysql2/promise");

// Create MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "cert_system",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test database connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log("Connected to MySQL database");
    connection.release();
  } catch (error) {
    console.error("Database connection failed:", error.message);
  }
};

testConnection();

// Export the pool directly
module.exports = pool;