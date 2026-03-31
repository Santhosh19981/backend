const pool = require('../config/database');

// POST /api/reviews
exports.createReview = async (req, res) => {
  try {
    const { car_id, booking_id, rating, comment } = req.body;
    const customerId = req.user.id;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be 1-5' });
    }

    // Verify booking belongs to customer and is completed
    const [bookings] = await pool.query(
      'SELECT * FROM bookings WHERE id = ? AND customer_id = ? AND status = "completed"',
      [booking_id, customerId]
    );
    if (!bookings.length) {
      return res.status(403).json({ success: false, message: 'Can only review completed bookings' });
    }

    const [existing] = await pool.query('SELECT id FROM reviews WHERE booking_id = ?', [booking_id]);
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'Review already submitted' });
    }

    await pool.query(
      'INSERT INTO reviews (car_id, customer_id, booking_id, rating, comment) VALUES (?,?,?,?,?)',
      [car_id, customerId, booking_id, rating, comment]
    );

    // Update car rating
    const [[{ avg, cnt }]] = await pool.query(
      'SELECT AVG(rating) as avg, COUNT(*) as cnt FROM reviews WHERE car_id = ?', [car_id]
    );
    await pool.query('UPDATE cars SET rating_avg = ?, rating_count = ? WHERE id = ?', [avg, cnt, car_id]);

    res.status(201).json({ success: true, message: 'Review submitted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/reviews/car/:id
exports.getCarReviews = async (req, res) => {
  try {
    const [reviews] = await pool.query(
      `SELECT r.*, u.name as customer_name, u.avatar_url
       FROM reviews r JOIN users u ON r.customer_id = u.id
       WHERE r.car_id = ? ORDER BY r.created_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
