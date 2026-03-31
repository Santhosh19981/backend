const pool = require('../config/database');
const { uploadToS3 } = require('../services/s3.service');
const { sendNotificationToUser } = require('../services/fcm.service');

// POST /api/cars — Owner submits car
exports.createCar = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const {
      brand, model, year, fuel_type, transmission, seats, color,
      registration_no, description, features, location_suburb,
      location_city, location_state, weekly_price
    } = req.body;

    if (!brand || !model || !year || !weekly_price) {
      return res.status(400).json({ success: false, message: 'Brand, model, year and weekly_price are required' });
    }

    const [result] = await pool.query(
      `INSERT INTO cars (owner_id, brand, model, year, fuel_type, transmission, seats, color, registration_no, description, features, location_suburb, location_city, location_state, weekly_price)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [ownerId, brand, model, year, fuel_type || 'petrol', transmission || 'automatic', seats || 5,
       color, registration_no, description, JSON.stringify(features || []),
       location_suburb, location_city || 'Sydney', location_state || 'NSW', weekly_price]
    );

    const carId = result.insertId;

    // Upload images to S3
    if (req.files && req.files.images) {
      const imgs = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
      for (let i = 0; i < imgs.length; i++) {
        const url = await uploadToS3(imgs[i], `cars/${carId}/images`);
        await pool.query('INSERT INTO car_images (car_id, image_url, is_primary, sort_order) VALUES (?,?,?,?)',
          [carId, url, i === 0 ? 1 : 0, i]);
      }
    }

    // Upload documents
    if (req.files && req.files.documents) {
      const docs = Array.isArray(req.files.documents) ? req.files.documents : [req.files.documents];
      for (const doc of docs) {
        const url = await uploadToS3(doc, `cars/${carId}/docs`);
        await pool.query('INSERT INTO car_documents (car_id, doc_type, doc_url) VALUES (?,?,?)',
          [carId, doc.fieldname || 'registration', url]);
      }
    }

    // Notify admin
    const [admins] = await pool.query('SELECT id FROM users WHERE role = "admin"');
    for (const admin of admins) {
      await pool.query(
        'INSERT INTO notifications (user_id, title, body, type, data_json) VALUES (?,?,?,?,?)',
        [admin.id, 'New Car Submission', `${brand} ${model} (${year}) submitted for approval`, 'car_status', JSON.stringify({ car_id: carId })]
      );
      await sendNotificationToUser(admin.id, 'New Car Submission', `${brand} ${model} submitted for approval`);
    }

    res.status(201).json({ success: true, message: 'Car submitted for approval', car_id: carId });
  } catch (err) {
    console.error('Create car error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/cars — Public list approved cars
exports.getCars = async (req, res) => {
  try {
    const { location, min_price, max_price, fuel_type, transmission, sort, page = 1, limit = 12 } = req.query;
    let where = ['c.status = "approved"'];
    let params = [];

    if (location) { where.push('(c.location_suburb LIKE ? OR c.location_city LIKE ?)'); params.push(`%${location}%`, `%${location}%`); }
    if (min_price) { where.push('c.weekly_price >= ?'); params.push(min_price); }
    if (max_price) { where.push('c.weekly_price <= ?'); params.push(max_price); }
    if (fuel_type) { where.push('c.fuel_type = ?'); params.push(fuel_type); }
    if (transmission) { where.push('c.transmission = ?'); params.push(transmission); }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    let orderBy = 'c.created_at DESC';
    if (sort === 'price_asc') orderBy = 'c.weekly_price ASC';
    else if (sort === 'price_desc') orderBy = 'c.weekly_price DESC';
    else if (sort === 'rating') orderBy = 'c.rating_avg DESC';

    const [rows] = await pool.query(
      `SELECT c.*, u.name as owner_name, 
       (SELECT image_url FROM car_images WHERE car_id = c.id AND is_primary = 1 LIMIT 1) as primary_image
       FROM cars c JOIN users u ON c.owner_id = u.id
       WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM cars c WHERE ${where.join(' AND ')}`, params);

    res.json({ success: true, cars: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error('Get cars error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/cars/:id
exports.getCarById = async (req, res) => {
  try {
    const { id } = req.params;
    const [cars] = await pool.query(
      `SELECT c.*, u.name as owner_name, u.avatar_url as owner_avatar,
       op.verification_status as owner_verified
       FROM cars c JOIN users u ON c.owner_id = u.id
       LEFT JOIN owner_profiles op ON u.id = op.user_id
       WHERE c.id = ?`, [id]
    );
    if (!cars.length) return res.status(404).json({ success: false, message: 'Car not found' });

    const [images] = await pool.query('SELECT * FROM car_images WHERE car_id = ? ORDER BY sort_order', [id]);
    const [reviews] = await pool.query(
      'SELECT r.*, u.name as customer_name, u.avatar_url FROM reviews r JOIN users u ON r.customer_id = u.id WHERE r.car_id = ? ORDER BY r.created_at DESC LIMIT 10',
      [id]
    );

    res.json({ success: true, car: { ...cars[0], images, reviews } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/cars/:id/availability
exports.getAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { month, year } = req.query;
    const [blocks] = await pool.query(
      'SELECT block_start, block_end, block_type FROM availability_blocks WHERE car_id = ?', [id]
    );
    res.json({ success: true, blocked_ranges: blocks });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/cars/owner/my-cars
exports.getOwnerCars = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, 
       (SELECT image_url FROM car_images WHERE car_id = c.id AND is_primary = 1 LIMIT 1) as primary_image,
       (SELECT COUNT(*) FROM bookings WHERE car_id = c.id AND status NOT IN ('cancelled')) as booking_count
       FROM cars c WHERE c.owner_id = ? ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, cars: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/cars/:id/status — Admin approve/reject
exports.updateCarStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejection_reason } = req.body;
    const validStatus = ['approved', 'rejected', 'unavailable'];
    if (!validStatus.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const [cars] = await pool.query('SELECT * FROM cars WHERE id = ?', [id]);
    if (!cars.length) return res.status(404).json({ success: false, message: 'Car not found' });

    await pool.query(
      'UPDATE cars SET status = ?, rejection_reason = ?, approved_by = ?, approved_at = ? WHERE id = ?',
      [status, rejection_reason || null, req.user.id, status === 'approved' ? new Date() : null, id]
    );

    const car = cars[0];
    const notifTitle = status === 'approved' ? '🎉 Car Approved!' : '❌ Car Rejected';
    const notifBody = status === 'approved'
      ? `Your ${car.brand} ${car.model} has been approved and is now live!`
      : `Your ${car.brand} ${car.model} was rejected. Reason: ${rejection_reason}`;

    await pool.query(
      'INSERT INTO notifications (user_id, title, body, type, data_json) VALUES (?,?,?,?,?)',
      [car.owner_id, notifTitle, notifBody, 'car_status', JSON.stringify({ car_id: id, status })]
    );
    await sendNotificationToUser(car.owner_id, notifTitle, notifBody);

    res.json({ success: true, message: `Car ${status} successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
