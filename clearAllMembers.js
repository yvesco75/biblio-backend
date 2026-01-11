require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function clear() {
  try {
    await pool.query('TRUNCATE TABLE mouvements, membres RESTART IDENTITY CASCADE');
    console.log('✅ Tous les membres et mouvements supprimés');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur:', err);
    process.exit(1);
  }
}

clear();