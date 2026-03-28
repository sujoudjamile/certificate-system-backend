// utils/sendEmail.js

const nodemailer = require("nodemailer");

/*
==================================
EMAIL TRANSPORTER
==================================
Uses Gmail SMTP credentials from .env
*/
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/*
==================================
SEND EMAIL
==================================
Reusable helper for sending HTML emails
*/
const sendEmail = async ({ to, subject, html }) => {
  return transporter.sendMail({
    from: `"CertifyLB" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

module.exports = sendEmail;