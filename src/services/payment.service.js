const stripe = require('../config/stripe');
const pool = require('../config/database');
const { sendNotificationToUser } = require('./fcm.service');

// POST /api/payments/create-intent
exports.createPaymentIntent = async (req, res) => {
  try {
    const { booking_id } = req.body;
    const [rows] = await pool.query('SELECT * FROM bookings WHERE id = ? AND customer_id = ?', [booking_id, req.user.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Booking not found' });

    const booking = rows[0];
    if (booking.payment_status === 'paid') {
      return res.status(400).json({ success: false, message: 'Booking already paid' });
    }

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(booking.total_amount * 100), // cents
      currency: 'aud',
      metadata: { booking_id: booking.id.toString(), customer_id: req.user.id.toString() },
      automatic_payment_methods: { enabled: true },
    });

    await pool.query('UPDATE bookings SET stripe_payment_intent = ? WHERE id = ?', [intent.id, booking_id]);

    res.json({ success: true, client_secret: intent.client_secret, publishable_key: process.env.STRIPE_PUBLISHABLE_KEY });
  } catch (err) {
    console.error('Payment intent error:', err);
    res.status(500).json({ success: false, message: 'Payment failed to initialize' });
  }
};

// POST /api/payments/webhook
exports.stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    const bookingId = intent.metadata.booking_id;

    const [rows] = await pool.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!rows.length) return res.status(200).json({ received: true });

    const booking = rows[0];
    const amountPaid = intent.amount / 100;
    const [[{ percentage }]] = await pool.query('SELECT percentage FROM commissions ORDER BY effective_from DESC LIMIT 1');
    const commissionRate = percentage / 100;
    const platformFee = amountPaid * commissionRate;
    const ownerEarnings = amountPaid - platformFee;

    await pool.query(
      'UPDATE bookings SET status = "confirmed", payment_status = "paid" WHERE id = ?', [bookingId]
    );

    await pool.query(
      'INSERT INTO payments (booking_id, amount, platform_fee, owner_earnings, stripe_pi_id, status) VALUES (?,?,?,?,?,?)',
      [bookingId, amountPaid, platformFee, ownerEarnings, intent.id, 'succeeded']
    );

    // Create availability blocks
    await pool.query(
      'INSERT INTO availability_blocks (car_id, booking_id, block_start, block_end) VALUES (?,?,?,?)',
      [booking.car_id, bookingId, booking.start_date, booking.end_date]
    );

    // Update owner earnings
    await pool.query(
      'UPDATE owner_profiles SET total_earnings = total_earnings + ? WHERE user_id = (SELECT owner_id FROM cars WHERE id = ?)',
      [ownerEarnings, booking.car_id]
    );

    // Notify customer
    await sendNotificationToUser(booking.customer_id, '✅ Booking Confirmed!', 'Your payment was successful. Enjoy your trip!');
    await pool.query(
      'INSERT INTO notifications (user_id, title, body, type, data_json) VALUES (?,?,?,?,?)',
      [booking.customer_id, 'Booking Confirmed!', 'Your car booking is confirmed.', 'payment', JSON.stringify({ booking_id: bookingId })]
    );
  }

  res.status(200).json({ received: true });
};

// GET /api/payments/:bookingId
exports.getPaymentByBooking = async (req, res) => {
  try {
    const [payments] = await pool.query('SELECT * FROM payments WHERE booking_id = ?', [req.params.bookingId]);
    res.json({ success: true, payments });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
