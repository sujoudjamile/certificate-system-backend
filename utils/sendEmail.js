// utils/sendEmail.js

const nodemailer = require("nodemailer");

// Create email transporter using Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // email address from .env
    pass: process.env.EMAIL_PASS, // app password from .env
  },
});

// Reusable function to send emails
const sendEmail = async ({ to, subject, html }) => {
  return transporter.sendMail({
    from: `"CertifyLB" <${process.env.EMAIL_USER}>`,
    to,       // receiver email
    subject,  // email subject
    html,     // email body in HTML format
  });
};

module.exports = sendEmail;