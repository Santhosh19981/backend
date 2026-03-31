const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { sendEmail } = require('../services/email.service');
const { v4: uuidv4 } = require('uuid');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }
    const validRoles = ['customer', 'owner'];
    const userRole = validRoles.includes(role) ? role : 'customer';

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10min

    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role, phone, otp, otp_expires) VALUES (?,?,?,?,?,?,?)',
      [name, email, hashed, userRole, phone || null, otp, otpExpires]
    );

    if (userRole === 'owner') {
      await pool.query('INSERT INTO owner_profiles (user_id) VALUES (?)', [result.insertId]);
    }

    // Send OTP email
    await sendEmail({
      to: email,
      subject: 'Verify your CarMate account',
      html: `<h2>Welcome to CarMate 🚗</h2><p>Your verification OTP is: <strong>${otp}</strong></p><p>Valid for 10 minutes.</p>`
    });

    const token = jwt.sign({ id: result.insertId, role: userRole }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email.',
      token,
      user: { id: result.insertId, name, email, role: userRole }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/auth/verify-otp
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND otp = ? AND otp_expires > NOW()', [email, otp]);
    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }
    await pool.query('UPDATE users SET is_verified = 1, otp = NULL, otp_expires = NULL WHERE id = ?', [rows[0].id]);
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url,
        is_verified: user.is_verified
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT u.id, u.name, u.email, u.role, u.phone, u.avatar_url, u.is_verified, u.created_at, op.verification_status, op.total_earnings FROM users u LEFT JOIN owner_profiles op ON u.id = op.user_id WHERE u.id = ?',
      [req.user.id]
    );
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/auth/resend-otp
exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query('UPDATE users SET otp = ?, otp_expires = ? WHERE email = ?', [otp, otpExpires, email]);
    await sendEmail({ to: email, subject: 'CarMate - New OTP', html: `<p>Your new OTP: <strong>${otp}</strong></p>` });
    res.json({ success: true, message: 'OTP resent' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/auth/update-fcm
exports.updateFcmToken = async (req, res) => {
  try {
    const { fcm_token } = req.body;
    await pool.query('UPDATE users SET fcm_token = ? WHERE id = ?', [fcm_token, req.user.id]);
    res.json({ success: true, message: 'FCM token updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
