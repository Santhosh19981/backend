const bcrypt = require('bcryptjs');
const pool = require('./src/config/database');

async function createAdmin() {
  try {
    const password = 'password123';
    const hashed = await bcrypt.hash(password, 10);
    
    // Check if user exists
    const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', ['admin@carmate.com.au']);
    
    if (existing.length > 0) {
      // Update existing admin
      await pool.query('UPDATE users SET password = ?, role = ? WHERE email = ?', [hashed, 'admin', 'admin@carmate.com.au']);
      console.log('✅ Admin user updated with default password');
    } else {
      // Create new admin
      await pool.query(
        'INSERT INTO users (name, email, password, role, is_verified) VALUES (?, ?, ?, ?, ?)',
        ['Admin Super', 'admin@carmate.com.au', hashed, 'admin', 1]
      );
      console.log('✅ Admin user created');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}

createAdmin();
