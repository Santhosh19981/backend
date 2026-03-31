require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setup() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 4000,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
      rejectUnauthorized: false
    },
    multipleStatements: true
  });

  try {
    console.log(`🚀 Creating database: ${process.env.DB_NAME}...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`);
    await connection.query(`USE \`${process.env.DB_NAME}\`;`);

    const schemaPath = path.join(__dirname, 'src', 'config', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('📜 Applying schema...');
    await connection.query(schema);

    console.log('✅ Database setup complete! You can now run "node src/app.js"');
  } catch (err) {
    console.error('❌ Setup failed:', err.message);
  } finally {
    await connection.end();
  }
}

setup();
