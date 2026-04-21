const pool = require('../config/database');

// GET /api/admin/dashboard
exports.getDashboard = async (req, res) => {
  try {
    const [[stats]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'customer') AS total_customers,
        (SELECT COUNT(*) FROM users WHERE role = 'owner') AS total_owners,
        (SELECT COUNT(*) FROM cars WHERE status = 'approved') AS approved_cars,
        (SELECT COUNT(*) FROM cars WHERE status = 'pending') AS pending_cars,
        (SELECT COUNT(*) FROM bookings WHERE status NOT IN ('cancelled')) AS total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status = 'confirmed') AS active_bookings,
        (SELECT COALESCE(SUM(platform_fee),0) FROM payments WHERE status = 'succeeded') AS total_revenue,
        (SELECT COALESCE(SUM(owner_earnings),0) FROM payments WHERE status = 'succeeded') AS owner_payouts
    `);

    const [monthlyRevenue] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, 
             SUM(platform_fee) as revenue, COUNT(*) as bookings
      FROM payments WHERE status = 'succeeded' AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY month ORDER BY month
    `);

    const [topCars] = await pool.query(`
      SELECT c.brand, c.model, c.weekly_price, COUNT(b.id) as bookings,
             COALESCE(SUM(b.total_amount),0) as revenue
      FROM cars c LEFT JOIN bookings b ON c.id = b.car_id AND b.status != 'cancelled'
      WHERE c.status = 'approved' GROUP BY c.id ORDER BY revenue DESC LIMIT 5
    `);

    const [recentBookings] = await pool.query(`
      SELECT b.id, b.status, b.total_amount, b.start_date, b.end_date, b.created_at,
             c.brand, c.model, u.name as customer_name
      FROM bookings b JOIN cars c ON b.car_id = c.id JOIN users u ON b.customer_id = u.id
      ORDER BY b.created_at DESC LIMIT 15
    `);

    res.json({ success: true, stats, monthlyRevenue, topCars, recentBookings });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/admin/cars/pending
exports.getPendingCars = async (req, res) => {
  try {
    const [cars] = await pool.query(`
      SELECT c.*, u.name as owner_name, u.email as owner_email, u.phone as owner_phone,
             op.verification_status as owner_verified, op.license_no, op.id_proof_url,
             (SELECT image_url FROM car_images WHERE car_id = c.id AND is_primary = 1 LIMIT 1) as primary_image,
             (SELECT JSON_ARRAYAGG(image_url) FROM car_images WHERE car_id = c.id) as all_images,
             (SELECT JSON_ARRAYAGG(JSON_OBJECT('type', doc_type, 'url', doc_url)) FROM car_documents WHERE car_id = c.id) as documents
      FROM cars c
      JOIN users u ON c.owner_id = u.id
      LEFT JOIN owner_profiles op ON u.id = op.user_id
      WHERE c.status = 'pending' ORDER BY c.created_at ASC
    `);
    res.json({ success: true, cars });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/admin/users
exports.getUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    let where = ['u.role != "admin"'];
    let params = [];
    if (role) { where.push('u.role = ?'); params.push(role); }
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [users] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.phone, u.is_verified, u.created_at,
              op.verification_status, op.total_earnings
       FROM users u LEFT JOIN owner_profiles op ON u.id = op.user_id
       WHERE ${where.join(' AND ')} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM users u WHERE ${where.join(' AND ')}`, params
    );
    res.json({ success: true, users, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/admin/bookings
exports.getAllBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let where = [];
    let params = [];
    if (status) { where.push('b.status = ?'); params.push(status); }
    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [bookings] = await pool.query(
      `SELECT b.*, c.brand, c.model, c.year, c.weekly_price,
              (SELECT image_url FROM car_images WHERE car_id = c.id AND is_primary = 1 LIMIT 1) as primary_image,
              cu.name as customer_name, cu.email as customer_email,
              own.name as owner_name
       FROM bookings b JOIN cars c ON b.car_id = c.id
       JOIN users cu ON b.customer_id = cu.id JOIN users own ON c.owner_id = own.id
       ${whereStr} ORDER BY b.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ success: true, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/admin/commission
exports.updateCommission = async (req, res) => {
  try {
    const { percentage } = req.body;
    if (percentage < 0 || percentage > 50) {
      return res.status(400).json({ success: false, message: 'Commission must be between 0% and 50%' });
    }
    await pool.query('INSERT INTO commissions (percentage, created_by) VALUES (?,?)', [percentage, req.user.id]);
    res.json({ success: true, message: 'Commission updated', percentage });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/admin/commission
exports.getCommission = async (req, res) => {
  try {
    const [[commission]] = await pool.query('SELECT * FROM commissions ORDER BY effective_from DESC LIMIT 1');
    const [history] = await pool.query('SELECT * FROM commissions ORDER BY effective_from DESC LIMIT 10');
    res.json({ success: true, current: commission, history });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/admin/reports
exports.getReports = async (req, res) => {
  try {
    const [monthlyRevenue] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, 
             SUM(amount) as gross_volume,
             SUM(platform_fee) as platform_revenue,
             COUNT(*) as transaction_count
      FROM payments WHERE status = 'succeeded' AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY month ORDER BY month
    `);

    const [userGrowth] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month,
             SUM(CASE WHEN role = 'customer' THEN 1 ELSE 0 END) as customers,
             SUM(CASE WHEN role = 'owner' THEN 1 ELSE 0 END) as owners
      FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY month ORDER BY month
    `);

    const [brandPerformance] = await pool.query(`
      SELECT c.brand, 
             COUNT(b.id) as total_bookings,
             COALESCE(SUM(b.total_amount), 0) as total_revenue
      FROM cars c
      LEFT JOIN bookings b ON c.id = b.car_id AND b.status != 'cancelled'
      GROUP BY c.brand
      ORDER BY total_revenue DESC LIMIT 5
    `);

    const [[metrics]] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM bookings) as total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status = 'cancelled') as cancelled_bookings,
        (SELECT AVG(total_amount) FROM bookings WHERE status = 'completed') as avg_booking_value
    `);

    res.json({ success: true, monthlyRevenue, userGrowth, brandPerformance, metrics });
  } catch (err) {
    console.error('Reports error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
