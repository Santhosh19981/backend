const pool = require('./src/config/database');

async function seedPayments() {
  try {
    console.log('Fetching bookings...');
    const [bookings] = await pool.query("SELECT id, total_amount, created_at, status FROM bookings");
    
    let count = 0;
    for (const b of bookings) {
      if (b.status !== 'cancelled') {
        const platformFee = b.total_amount * 0.15; // 15% fee
        const ownerAmount = b.total_amount - platformFee;
        
        // Randomize the payment date based on booking creation date to spread it across months
        await pool.query(
          "INSERT INTO payments (booking_id, stripe_pi_id, amount, platform_fee, owner_earnings, status, created_at) VALUES (?, ?, ?, ?, ?, 'succeeded', ?)",
          [b.id, 'pi_fake_' + b.id + '_' + Date.now(), b.total_amount, platformFee, ownerAmount, b.created_at]
        );
        count++;
      }
    }
    
    console.log('Successfully seeded ' + count + ' payments!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding payments:', err);
    process.exit(1);
  }
}

seedPayments();
