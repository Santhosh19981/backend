const express = require('express');
const router = express.Router();
const auth = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/verify-otp', auth.verifyOTP);
router.post('/resend-otp', auth.resendOTP);
router.get('/me', authenticate, auth.getMe);
router.put('/fcm-token', authenticate, auth.updateFcmToken);

module.exports = router;
