const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  database: 'carmate_db',
  user: '3F8F5nJ9TbykpAp.root',
  password: 'lCw7fQIEEK4TpKDF',
  ssl: {
    rejectUnauthorized: false
  }
});

async function test() {
  try {
    console.log('Testing connection to TiDB Cloud...');
    const [rows] = await pool.query('SELECT 1 as result');
    console.log('✅ Connection successful:', rows);
    
    console.log('Testing user query...');
    const [users] = await pool.query('SELECT count(*) as count FROM users');
    console.log('✅ User count:', users[0].count);
  } catch (err) {
    console.error('❌ Connection failed:');
    console.error(err);
  } finally {
    process.exit();
  }
}

test();
