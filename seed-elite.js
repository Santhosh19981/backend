const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: process.env.DB_PORT || 4000,
  database: process.env.DB_NAME || 'carmate_db',
  user: process.env.DB_USER || '3F8F5nJ9TbykpAp.root',
  password: process.env.DB_PASSWORD || 'lCw7fQIEEK4TpKDF',
  ssl: { rejectUnauthorized: false },
  multipleStatements: true
});

async function seed() {
    const conn = await pool.getConnection();
    try {
        console.log('💎 Initializing Elite Seeding Strategy...');
        const password = await bcrypt.hash('password123', 10);

        const owners = [
            { name: 'Siddharth Sharma', email: 'siddharth@luxuryride.com', phone: '+91 98765 43210' },
            { name: 'Victoria Heights', email: 'victoria@luxuryride.com', phone: '+61 412 345 678' },
            { name: 'James Sterling', email: 'james@luxuryride.com', phone: '+1 212 555 0199' }
        ];

        for (const owner of owners) {
            // 1. Create User
            const [uRes] = await conn.query(
                'INSERT INTO users (name, email, password, role, phone, is_verified) VALUES (?, ?, ?, ?, ?, ?)',
                [owner.name, owner.email, password, 'owner', owner.phone, 1]
            );
            const userId = uRes.insertId;

            // 2. Create Owner Profile
            await conn.query('INSERT INTO owner_profiles (user_id, verification_status) VALUES (?, ?)', [userId, 'verified']);

            // 3. Add High-End Cars
            const cars = getCars(owner.name);
            for (const car of cars) {
                const [cRes] = await conn.query(
                    `INSERT INTO cars (owner_id, brand, model, year, fuel_type, transmission, seats, color, registration_no, description, features, location_suburb, weekly_price, status) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [userId, car.brand, car.model, car.year, car.fuel, car.trans, car.seats, car.color, car.reg, car.desc, JSON.stringify(car.features), car.suburb, car.price, 'approved']
                );
                const carId = cRes.insertId;

                // 4. Add Luxury Imagery
                await conn.query('INSERT INTO car_images (car_id, image_url, is_primary) VALUES (?, ?, ?)', [carId, car.image, 1]);
            }
            console.log(`✅ Seeded Portfolio for: ${owner.name}`);
        }

        console.log('\n✨ Elite Seeding Complete. Use "password123" for all accounts.');
    } catch (err) {
        console.error('❌ Seeding Failed:', err);
    } finally {
        conn.release();
        process.exit();
    }
}

function getCars(name) {
    if (name === 'Siddharth Sharma') return [
        { brand: 'Rolls-Royce', model: 'Ghost', year: 2024, fuel: 'petrol', trans: 'automatic', seats: 4, color: 'Diamond Black', reg: 'RR-GHOST-24', desc: 'The pinnacle of luxury motoring.', features: ['Chauffeur Mode', 'Sky Ceiling', 'Massage Seats'], suburb: 'Mayfair', price: 150000, image: 'https://images.unsplash.com/photo-1631214524020-5e184106d935?q=80&w=1000&auto=format&fit=crop' },
        { brand: 'Porsche', model: '911 GT3', year: 2023, fuel: 'petrol', trans: 'automatic', seats: 2, color: 'Shark Blue', reg: 'GT3-911-33', desc: 'Pure track heritage for the road.', features: ['Carbon Parts', 'Sport Exhaust', 'PDK'], suburb: 'Nurburg', price: 45000, image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1000&auto=format&fit=crop' }
    ];
    if (name === 'Victoria Heights') return [
        { brand: 'Ferrari', model: 'Roma', year: 2024, fuel: 'petrol', trans: 'automatic', seats: 2, color: 'Rosso Corsa', reg: 'FER-ROMA-24', desc: 'La Nuova Dolce Vita.', features: ['V8 Turbo', 'Italian Leather', 'MagRiding'], suburb: 'Rome', price: 85000, image: 'https://images.unsplash.com/photo-1592198084033-aade902d1aae?q=80&w=1000&auto=format&fit=crop' },
        { brand: 'Mercedes-Benz', model: 'G-Class', year: 2024, fuel: 'diesel', trans: 'automatic', seats: 5, color: 'Obsidian Black', reg: 'G-WAGON-24', desc: 'Stronger than time.', features: ['4x4', 'Burmester Sound', 'Ambient Lighting'], suburb: 'Berlin', price: 35000, image: 'https://images.unsplash.com/photo-1520031441872-265e4ff70366?q=80&w=1000&auto=format&fit=crop' }
    ];
    return [
        { brand: 'Lamborghini', model: 'Urus', year: 2024, fuel: 'petrol', trans: 'automatic', seats: 5, color: 'Giallo Auge', reg: 'Lambo-URUS', desc: 'The worlds first Super SUV.', features: ['Twin Turbo V8', 'Adaptive Air', 'Ceramic Brakes'], suburb: 'Milan', price: 95000, image: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?q=80&w=1000&auto=format&fit=crop' }
    ];
}

seed();
