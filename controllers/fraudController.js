const db = require("../config/db");

// 🚨 Flag certificate as fraud
const flagFraud = async (req, res) => {
  try {
    const { certificate_id, reason, risk_score } = req.body;

    const userId = req.user.id;

    if (!certificate_id || !reason) {
      return res.status(400).json({
        message: "Certificate and reason are required"
      });
    }

    // Check certificate exists
    const [cert] = await db.query(
      "SELECT * FROM certificates WHERE id = ?",
      [certificate_id]
    );

    if (cert.length === 0) {
      return res.status(404).json({
        message: "Certificate not found"
      });
    }

    // Prevent duplicate flag
    const [existing] = await db.query(
      "SELECT * FROM fraud_flag WHERE certificate_id = ? AND status = 'pending'",
      [certificate_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        message: "This certificate is already flagged"
      });
    }

    // Insert fraud flag
    await db.query(
      `INSERT INTO fraud_flag 
      (certificate_id, user_id, reason, risk_score)
      VALUES (?, ?, ?, ?)`,
      [
        certificate_id,
        userId,
        reason,
        risk_score || 50
      ]
    );

    res.json({
      message: "🚨 Certificate flagged successfully"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: error.message
    });
  }
};

module.exports = {
  flagFraud
};