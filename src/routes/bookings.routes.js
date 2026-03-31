const express = require('express');
const router = express.Router();
const bookings = require('../controllers/bookings.controller');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, bookings.createBooking);
router.get('/', authenticate, bookings.getBookings);
router.get('/:id', authenticate, bookings.getBookingById);
router.put('/:id/cancel', authenticate, bookings.cancelBooking);

module.exports = router;
