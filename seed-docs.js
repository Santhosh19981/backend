const pool = require('./src/config/database');
async function run() {
  const [cars] = await pool.query("SELECT id FROM cars WHERE status='pending'");
  for (const c of cars) {
    await pool.query("INSERT INTO car_documents (car_id, doc_type, doc_url) VALUES (?, 'registration', 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400')", [c.id]);
  }
  process.exit();
}
run();
