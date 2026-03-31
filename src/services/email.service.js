const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

exports.sendEmail = async ({ to, subject, html, text }) => {
  try {
    await transporter.sendMail({
      from: `"CarMate Australia" <${process.env.SMTP_USER}>`,
      to, subject, html, text,
    });
    console.log(`📧 Email sent to ${to}`);
  } catch (err) {
    console.error('Email send error:', err.message);
  }
};
