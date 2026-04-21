/**
 * Elite Data Vitalization Script (v16.1 - Zero Fail)
 * ------------------------------------------------
 * This script seeds the CarMate database with a high-fidelity luxury fleet,
 * professional imagery, and a refined rental ledger.
 * Uses FK bypass for a guaranteed dev infusion.
 */

const pool = require('../src/config/database');

async function vitalize() {
  try {
    console.log('🚀 Initiating Elite Data Vitalization (Masterpiece Sync)...');

    const ownerId = 3; // Siddharth Sharma
    const customerId = 2; // Santhosh Explorer

    // START BYPASS
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');

    console.log('🧹 Sanctuary Cleared. Preparing Elite Infusion...');

    // 1. CLEAR PREVIOUS SEED DATA FOR THIS OWNER
    const carIdsQuery = '(SELECT id FROM cars WHERE owner_id = ?)';
    
    await pool.query(`DELETE FROM booking_weeks WHERE booking_id IN (SELECT id FROM bookings WHERE car_id IN ${carIdsQuery})`, [ownerId]);
    await pool.query(`DELETE FROM coupon_uses WHERE booking_id IN (SELECT id FROM bookings WHERE car_id IN ${carIdsQuery})`, [ownerId]);
    await pool.query(`DELETE FROM availability_blocks WHERE car_id IN ${carIdsQuery}`, [ownerId]);
    await pool.query(`DELETE FROM car_images WHERE car_id IN ${carIdsQuery}`, [ownerId]);
    await pool.query(`DELETE FROM car_documents WHERE car_id IN ${carIdsQuery}`, [ownerId]);
    await pool.query(`DELETE FROM reviews WHERE car_id IN ${carIdsQuery}`, [ownerId]);
    await pool.query(`DELETE FROM bookings WHERE car_id IN ${carIdsQuery}`, [ownerId]);
    await pool.query('DELETE FROM cars WHERE owner_id = ?', [ownerId]);

    console.log('💎 Sanctuary Cleared. Infusing Elite Fleet...');

    const cars = [
      {
        brand: 'Rolls-Royce', model: 'Ghost', year: 2024, fuel_type: 'petrol', transmission: 'automatic',
        seats: 4, color: 'Diamond Black', registration_no: 'RR-GHOST-001',
        description: 'The pinnacle of luxury and effortlessness. Experience the Ghost sanctuary.',
        weekly_price: 450000, 
        location_city: 'Mumbai', location_state: 'MH',
        images: [
          'https://images.unsplash.com/photo-1631214524020-5e1839a81da3?auto=format&fit=crop&q=80&w=1200',
          'https://images.unsplash.com/photo-1563720223185-11003d516905?auto=format&fit=crop&q=80&w=1200'
        ]
      },
      {
        brand: 'Lamborghini', model: 'Urus Performante', year: 2023, fuel_type: 'petrol', transmission: 'automatic',
        seats: 5, color: 'Giallo Auge', registration_no: 'L-URUS-999',
        description: 'The soul of a super sports car and the functionality of an SUV.',
        weekly_price: 320000,
        location_city: 'Delhi', location_state: 'DL',
        images: [
          'https://images.unsplash.com/photo-1571173262070-5b65f7c35f29?auto=format&fit=crop&q=80&w=1200',
          'https://images.unsplash.com/photo-1621135802920-133df287f89c?auto=format&fit=crop&q=80&w=1200'
        ]
      },
      {
        brand: 'Porsche', model: '911 GT3 RS', year: 2024, fuel_type: 'petrol', transmission: 'automatic',
        seats: 2, color: 'Lizard Green', registration_no: 'P-911-RS',
        description: 'The 911 GT3 RS is designed for the maximum driving experience on the track.',
        weekly_price: 280000,
        location_city: 'Bangalore', location_state: 'KA',
        images: [
          'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=1200',
          'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&q=80&w=1200'
        ]
      }
    ];

    for (const car of cars) {
      const [res] = await pool.query(
        `INSERT INTO cars (owner_id, brand, model, year, fuel_type, transmission, seats, color, registration_no, description, weekly_price, location_city, location_state, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [ownerId, car.brand, car.model, car.year, car.fuel_type, car.transmission, car.seats, car.color, car.registration_no, car.description, car.weekly_price, car.location_city, car.location_state, 'approved']
      );

      const carId = res.insertId;
      for (let i = 0; i < car.images.length; i++) {
        await pool.query(
          'INSERT INTO car_images (car_id, image_url, is_primary, sort_order) VALUES (?,?,?,?)',
          [carId, car.images[i], i === 0 ? 1 : 0, i]
        );
      }
      console.log(`✅ Infused: ${car.brand} ${car.model}`);

      // 2. Add sample historical bookings
      const historicalDates = [45, 30, 15]; // Days ago
      for (const offset of historicalDates) {
        const start = new Date(); start.setDate(start.getDate() - offset);
        const end = new Date(start); end.setDate(end.getDate() + 7);
        const amt = car.weekly_price;

        await pool.query(
          `INSERT INTO bookings (car_id, customer_id, start_date, end_date, weeks_count, total_amount, platform_fee, owner_amount, status)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [carId, customerId, start.toISOString().split('T')[0], end.toISOString().split('T')[0], 1, amt, amt * 0.15, amt * 0.85, 'completed']
        );
      }
    }

    // 3. Add one ACTIVE booking for the Dashboard logic
    const activeCarId = (await pool.query('SELECT id FROM cars WHERE owner_id = ? LIMIT 1', [ownerId]))[0][0].id;
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await pool.query(
      `INSERT INTO bookings (car_id, customer_id, start_date, end_date, weeks_count, total_amount, platform_fee, owner_amount, status)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [activeCarId, customerId, today, nextWeek, 1, 350000, 350000 * 0.15, 350000 * 0.85, 'active']
    );

    // 4. Reset & Recalculate Owner Profile total_earnings
    console.log('📊 Synchronizing Financial Ledger...');
    const [[{ total_earnings }]] = await pool.query('SELECT SUM(owner_amount) as total_earnings FROM bookings JOIN cars ON bookings.car_id = cars.id WHERE cars.owner_id = ? AND bookings.status IN ("completed", "active")', [ownerId]);
    
    await pool.query('UPDATE owner_profiles SET total_earnings = ? WHERE user_id = ?', [total_earnings || 0, ownerId]);

    // RESTORE CHECKS
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log(`💎 Vitalization Complete. Elite Wealth Status: ₹${(total_earnings || 0).toLocaleString()}`);
    process.exit(0);

  } catch (err) {
    console.error('❌ Vitalization Failed:', err);
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    process.exit(1);
  }
}

vitalize();
