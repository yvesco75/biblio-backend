require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function clear() {
  await pool.query('TRUNCATE TABLE mouvements, membres RESTART IDENTITY CASCADE');
  console.log('✅ Membres supprimés');
  await pool.end();
  process.exit(0);
}

clear();