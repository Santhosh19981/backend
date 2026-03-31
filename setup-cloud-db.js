require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setup() {
  const connection = await mysql.createConnection({
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '3F8F5nJ9TbykpAp.root',
    password: 'lCw7fQIEEK4TpKDF',
    ssl: {
      rejectUnauthorized: false // Required for TiDB Cloud connectivity
    },
    multipleStatements: true
  });

  try {
    const dbName = 'carmate_db';
    console.log(`🚀 Creating cloud database: ${dbName}...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await connection.query(`USE \`${dbName}\`;`);

    const schemaPath = path.join(__dirname, 'src', 'config', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('📜 Applying schema to cloud database...');
    await connection.query(schema);

    console.log('✅ Cloud Database setup complete!');
  } catch (err) {
    console.error('❌ Cloud Setup failed:', err.message);
  } finally {
    await connection.end();
  }
}

setup();
