const bcrypt = require('bcryptjs');
const pool = require('./src/config/database');

const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];

const carBrands = ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan', 'Hyundai', 'Kia', 'Volkswagen', 'Subaru', 'Mazda', 'Mercedes-Benz', 'BMW', 'Audi', 'Lexus', 'Porsche'];
const carModels = ['Corolla', 'Civic', 'Mustang', 'Camaro', 'Altima', 'Elantra', 'Optima', 'Jetta', 'Impreza', 'Mazda3', 'C-Class', '3 Series', 'A4', 'IS', '911'];
const carColors = ['Red', 'Blue', 'Black', 'White', 'Silver', 'Grey', 'Green', 'Yellow'];
const fuelTypes = ['petrol', 'diesel', 'hybrid', 'electric'];
const transmissionTypes = ['automatic', 'manual'];
const cities = ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide'];

function randomArray(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function seed() {
  console.log('🌱 Starting database seeding...');
  const password = await bcrypt.hash('password123', 10);
  
  try {
    // 1. Create Users (Customers)
    const customerIds = [];
    for (let i = 0; i < 25; i++) {
        const name = `${randomArray(firstNames)} ${randomArray(lastNames)}`;
        const email = `customer${Math.floor(Math.random()*100000)}@example.com`;
        const [res] = await pool.query(
            'INSERT IGNORE INTO users (name, email, password, role, is_verified) VALUES (?, ?, ?, ?, ?)',
            [name, email, password, 'customer', 1]
        );
        if (res.insertId) customerIds.push(res.insertId);
    }
    console.log(`✅ Created ${customerIds.length} customers.`);

    // 2. Create Users (Owners) + Owner Profiles
    const ownerIds = [];
    for (let i = 0; i < 15; i++) {
        const name = `${randomArray(firstNames)} ${randomArray(lastNames)}`;
        const email = `owner${Math.floor(Math.random()*100000)}@example.com`;
        const [userRes] = await pool.query(
            'INSERT IGNORE INTO users (name, email, password, role, is_verified) VALUES (?, ?, ?, ?, ?)',
            [name, email, password, 'owner', 1]
        );
        
        if (userRes.insertId) {
            ownerIds.push(userRes.insertId);
            await pool.query(
                'INSERT INTO owner_profiles (user_id, license_no, verification_status, total_earnings) VALUES (?, ?, ?, ?)',
                [userRes.insertId, `LIC${Math.floor(Math.random()*9000000)}`, 'verified', (Math.random() * 5000).toFixed(2)]
            );
        }
    }
    console.log(`✅ Created ${ownerIds.length} owners.`);

    // 3. Create Cars
    const carIds = [];
    if (ownerIds.length > 0) {
        for (let i = 0; i < 40; i++) {
            const ownerId = randomArray(ownerIds);
            const status = Math.random() > 0.2 ? 'approved' : 'pending';
            const price = Math.floor(Math.random() * 300) + 100;
            const brand = randomArray(carBrands);
            const model = randomArray(carModels);
            
            const [carRes] = await pool.query(
                `INSERT INTO cars 
                (owner_id, brand, model, year, fuel_type, transmission, seats, color, registration_no, location_city, weekly_price, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    ownerId, brand, model, 2015 + Math.floor(Math.random() * 9),
                    randomArray(fuelTypes), randomArray(transmissionTypes), 
                    5, randomArray(carColors), `REG${Math.floor(Math.random() * 9000)}`,
                    randomArray(cities), price, status
                ]
            );
            if (carRes.insertId) {
                carIds.push(carRes.insertId);
                // add car image
                await pool.query(
                  'INSERT INTO car_images (car_id, image_url, is_primary) VALUES (?, ?, ?)',
                  [carRes.insertId, `https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&q=80&w=800`, 1]
                );
            }
        }
        console.log(`✅ Created ${carIds.length} cars.`);
    }

    // 4. Create Bookings
    if (carIds.length > 0 && customerIds.length > 0) {
        let bookingsCount = 0;
        for (let i = 0; i < 60; i++) {
            const customerId = randomArray(customerIds);
            const carId = randomArray(carIds);
            const startDate = randomDate(new Date('2025-01-01'), new Date('2026-06-01'));
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 7);
            
            const statuses = ['pending', 'confirmed', 'completed', 'cancelled'];
            const status = randomArray(statuses);
            
            // Random price between 200 and 1000
            const totalAmount = Math.floor(Math.random() * 800) + 200;
            const platformFee = totalAmount * 0.15;
            const ownerAmount = totalAmount - platformFee;

            const [bookingRes] = await pool.query(
                `INSERT INTO bookings 
                (car_id, customer_id, start_date, end_date, total_amount, platform_fee, owner_amount, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    carId, customerId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0],
                    totalAmount, platformFee, ownerAmount, status
                ]
            );
            
            if (bookingRes.insertId) bookingsCount++;
        }
        console.log(`✅ Created ${bookingsCount} bookings.`);
    }

    console.log('🎉 Seeding complete! Check your dashboard.');
  } catch (e) {
    console.error('❌ Error during seeding:', e);
  } finally {
    process.exit();
  }
}

seed();
