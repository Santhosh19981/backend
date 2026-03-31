const pool = require('../config/database');
const stripe = require('../config/stripe');
const { sendNotificationToUser } = require('../services/fcm.service');

// Weekly booking logic: ceil(days/7), minimum 1 week
const calculateWeeks = (startDate, endDate) => {
  const diffMs = new Date(endDate) - new Date(startDate);
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.ceil(diffDays / 7));
};

const checkOverlap = async (carId, startDate, endDate) => {
  const [rows] = await pool.query(
    `SELECT id FROM availability_blocks 
     WHERE car_id = ? AND NOT (block_end <= ? OR block_start >= ?)`,
    [carId, startDate, endDate]
  );
  return rows.length > 0;
};

// POST /api/bookings
exports.createBooking = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { car_id, start_date, end_date, coupon_code } = req.body;

    if (!car_id || !start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'car_id, start_date, end_date are required' });
    }

    // Check car exists & approved
    const [cars] = await pool.query('SELECT * FROM cars WHERE id = ? AND status = "approved"', [car_id]);
    if (!cars.length) return res.status(404).json({ success: false, message: 'Car not available' });

    const car = cars[0];
    const weeksCount = calculateWeeks(start_date, end_date);

    // Round end_date to full weeks
    const roundedEndDate = new Date(start_date);
    roundedEndDate.setDate(roundedEndDate.getDate() + weeksCount * 7);
    const finalEndDate = roundedEndDate.toISOString().split('T')[0];

    // Check overlap
    const hasOverlap = await checkOverlap(car_id, start_date, finalEndDate);
    if (hasOverlap) {
      return res.status(409).json({ success: false, message: 'Car is not available for selected dates' });
    }

    // Calculate amounts
    const [[{ percentage: commission }]] = await pool.query(
      'SELECT percentage FROM commissions ORDER BY effective_from DESC LIMIT 1'
    );
    const commissionRate = commission / 100;
    let totalAmount = car.weekly_price * weeksCount;
    let discountAmount = 0;
    let couponId = null;

    // Apply coupon
    if (coupon_code) {
      const [coupons] = await pool.query(
        'SELECT * FROM coupons WHERE code = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > NOW()) AND (uses_limit IS NULL OR uses_count < uses_limit)',
        [coupon_code]
      );
      if (coupons.length) {
        const c = coupons[0];
        if (totalAmount >= c.min_amount) {
          discountAmount = c.discount_type === 'percentage'
            ? Math.min(totalAmount * (c.value / 100), c.max_discount || Infinity)
            : c.value;
          discountAmount = Math.min(discountAmount, totalAmount);
          couponId = c.id;
        }
      }
    }

    const finalAmount = totalAmount - discountAmount;
    const platformFee = finalAmount * commissionRate;
    const ownerAmount = finalAmount - platformFee;

    // Create booking
    const [bookingResult] = await pool.query(
      `INSERT INTO bookings (car_id, customer_id, start_date, end_date, weeks_count, total_amount, platform_fee, owner_amount, coupon_id, discount_amount)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [car_id, customerId, start_date, finalEndDate, weeksCount, finalAmount, platformFee, ownerAmount, couponId, discountAmount]
    );

    const bookingId = bookingResult.insertId;

    // Create booking weeks
    for (let w = 0; w < weeksCount; w++) {
      const wStart = new Date(start_date);
      wStart.setDate(wStart.getDate() + w * 7);
      const wEnd = new Date(wStart);
      wEnd.setDate(wEnd.getDate() + 7);
      const weekAmt = car.weekly_price;
      await pool.query(
        'INSERT INTO booking_weeks (booking_id, week_number, week_start, week_end, amount, platform_fee, owner_amount) VALUES (?,?,?,?,?,?,?)',
        [bookingId, w + 1, wStart.toISOString().split('T')[0], wEnd.toISOString().split('T')[0],
         weekAmt, weekAmt * commissionRate, weekAmt * (1 - commissionRate)]
      );
    }

    // Update coupon usage
    if (couponId) {
      await pool.query('UPDATE coupons SET uses_count = uses_count + 1 WHERE id = ?', [couponId]);
      await pool.query('INSERT INTO coupon_uses (coupon_id, user_id, booking_id) VALUES (?,?,?)', [couponId, customerId, bookingId]);
    }

    // Notify owner
    await sendNotificationToUser(car.owner_id, '🚗 New Booking!',
      `Your ${car.brand} ${car.model} has a new booking request`);
    await pool.query(
      'INSERT INTO notifications (user_id, title, body, type, data_json) VALUES (?,?,?,?,?)',
      [car.owner_id, 'New Booking Request', `Booking for ${car.brand} ${car.model}`, 'booking', JSON.stringify({ booking_id: bookingId })]
    );

    res.status(201).json({
      success: true, booking_id: bookingId,
      total_amount: finalAmount, weeks_count: weeksCount,
      start_date, end_date: finalEndDate,
      message: 'Booking created. Proceed to payment.'
    });
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/bookings
exports.getBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const user = req.user;
    let where = [];
    let params = [];

    if (user.role === 'customer') { where.push('b.customer_id = ?'); params.push(user.id); }
    else if (user.role === 'owner') {
      where.push('c.owner_id = ?'); params.push(user.id);
    }
    if (status) { where.push('b.status = ?'); params.push(status); }

    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await pool.query(
      `SELECT b.*, c.brand, c.model, c.year, c.weekly_price, c.location_city,
       cu.name as customer_name, cu.phone as customer_phone,
       (SELECT image_url FROM car_images WHERE car_id = c.id AND is_primary = 1 LIMIT 1) as car_image
       FROM bookings b
       JOIN cars c ON b.car_id = c.id
       JOIN users cu ON b.customer_id = cu.id
       ${whereStr} ORDER BY b.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM bookings b JOIN cars c ON b.car_id = c.id ${whereStr}`, params
    );

    res.json({ success: true, bookings: rows, total, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/bookings/:id
exports.getBookingById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.*, c.brand, c.model, c.year, c.color, c.transmission, c.fuel_type, c.weekly_price,
       c.location_suburb, c.location_city, c.location_state,
       cu.name as customer_name, cu.email as customer_email, cu.phone as customer_phone,
       own.name as owner_name, own.phone as owner_phone,
       (SELECT image_url FROM car_images WHERE car_id = c.id AND is_primary = 1 LIMIT 1) as car_image
       FROM bookings b
       JOIN cars c ON b.car_id = c.id
       JOIN users cu ON b.customer_id = cu.id
       JOIN users own ON c.owner_id = own.id
       WHERE b.id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Booking not found' });

    const [weeks] = await pool.query('SELECT * FROM booking_weeks WHERE booking_id = ?', [req.params.id]);
    res.json({ success: true, booking: { ...rows[0], weeks } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/bookings/:id/cancel
exports.cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const [rows] = await pool.query('SELECT * FROM bookings WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Booking not found' });

    const booking = rows[0];
    await pool.query(
      'UPDATE bookings SET status = "cancelled", cancellation_reason = ?, cancelled_at = NOW() WHERE id = ?',
      [reason || 'Cancelled by user', id]
    );
    await pool.query('DELETE FROM availability_blocks WHERE booking_id = ?', [id]);

    res.json({ success: true, message: 'Booking cancelled' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
