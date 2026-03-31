const express = require('express');
const router = express.Router();
const payment = require('../services/payment.service');
const { authenticate } = require('../middleware/auth');

router.post('/create-intent', authenticate, payment.createPaymentIntent);
router.post('/webhook', express.raw({ type: 'application/json' }), payment.stripeWebhook);
router.get('/:bookingId', authenticate, payment.getPaymentByBooking);

module.exports = router;
