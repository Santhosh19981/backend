const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: process.env.DB_PORT || 4000,
  database: process.env.DB_NAME || 'carmate_db',
  user: process.env.DB_USER || '3F8F5nJ9TbykpAp.root',
  password: process.env.DB_PASSWORD || 'lCw7fQIEEK4TpKDF',
  ssl: {
    rejectUnauthorized: false // Required for TiDB Cloud
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+10:00',
});

pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL Connected:', process.env.DB_HOST);
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL Connection Error:', err.code || err.message || err);
    if (err.code === 'ER_BAD_DB_ERROR') {
      console.warn('💡 Tip: Your database "carmate_db" does not exist. Run "node setup-db.js" to create it.');
    }
  });

module.exports = pool;
