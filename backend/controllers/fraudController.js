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

// GET all fraud flags for this university
const getFraudFlags = async (req, res) => {
  try {
    const { university_id, role } = req.user;

    let query = `
      SELECT 
        ff.id, ff.reason, ff.risk_score, ff.status, ff.flagged_at,
        ff.review_note,
        c.id AS cert_id, c.cert_number, c.degree, c.major,
        c.GPA, c.graduation_date, c.status AS cert_status,
        sn.full_name AS student_name, sn.national_id,
        u.name AS university_name,
        reporter.name AS flagged_by_name
      FROM fraud_flag ff
      JOIN certificates  c        ON ff.certificate_id = c.id
      JOIN students_new  sn       ON c.student_id       = sn.id
      JOIN universities  u        ON c.university_id    = u.id
      LEFT JOIN users    reporter ON ff.user_id          = reporter.id
    `;

    const params = [];
    if (role !== "super_admin") {
      query += " WHERE c.university_id = ?";
      params.push(university_id);
    }

    query += " ORDER BY ff.flagged_at DESC";

    const [flags] = await db.query(query, params);
    res.json({ status: "success", flags });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// PATCH resolve a fraud flag — either revoke cert or dismiss flag
const resolveFraudFlag = async (req, res) => {
  try {
    const { id }    = req.params;
    const { action, review_note } = req.body;
    // action must be "revoke" or "dismiss"

    if (!["revoke", "dismiss"].includes(action)) {
      return res.status(400).json({ message: "action must be 'revoke' or 'dismiss'" });
    }

    // Fetch the flag
    const [flags] = await db.query(
      "SELECT * FROM fraud_flag WHERE id = ?", [id]
    );
    if (flags.length === 0)
      return res.status(404).json({ message: "Flag not found" });

    const flag = flags[0];

    if (flag.status !== "pending")
      return res.status(400).json({ message: "This flag has already been resolved" });

    if (action === "revoke") {
      // Revoke the certificate
      const [certRows] = await db.query(
        "SELECT id, status FROM certificates WHERE id = ?",
        [flag.certificate_id]
      );
      if (certRows.length === 0)
        return res.status(404).json({ message: "Certificate not found" });

      if (certRows[0].status === "revoked")
        return res.status(400).json({ message: "Certificate is already revoked" });

      await db.query(
        "UPDATE certificates SET status = 'revoked' WHERE id = ?",
        [flag.certificate_id]
      );
    }

    // Update flag status
    await db.query(
      `UPDATE fraud_flag 
       SET status = ?, review_note = ?, reviewed_by = ?
       WHERE id = ?`,
      [
        action === "revoke" ? "resolved" : "dismissed",
        review_note || null,
        req.user.id,
        id,
      ]
    );

    res.json({
      status:  "success",
      message: action === "revoke"
        ? "Certificate revoked and flag resolved."
        : "Flag dismissed. Certificate remains active.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { flagFraud, getFraudFlags, resolveFraudFlag };