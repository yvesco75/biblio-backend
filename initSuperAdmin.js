require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function init() {
  try {
    // Créer table admins
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table admins créée');

    // Créer super admin
    const hashedPassword = bcrypt.hashSync('SuperAdmin2025!', 10);
    await pool.query(
      `INSERT INTO admins (username, password, role) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (username) DO NOTHING`,
      ['superadmin', hashedPassword, 'superadmin']
    );

    // Créer admin normal
    const hashedAdmin = bcrypt.hashSync('admin123', 10);
    await pool.query(
      `INSERT INTO admins (username, password, role) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (username) DO NOTHING`,
      ['admin', hashedAdmin, 'admin']
    );

    console.log('✅ Comptes créés :');
    console.log('   superadmin / SuperAdmin2025!');
    console.log('   admin / admin123');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

init();