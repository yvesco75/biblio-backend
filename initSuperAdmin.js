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

    // Vérifier si les comptes existent déjà
    const checkSuper = await pool.query('SELECT * FROM admins WHERE username = $1', ['superadmin']);
    const checkAdmin = await pool.query('SELECT * FROM admins WHERE username = $1', ['admin']);

    if (checkSuper.rows.length === 0) {
      const hashedPassword = bcrypt.hashSync('SuperAdmin2025!', 10);
      await pool.query(
        'INSERT INTO admins (username, password, role) VALUES ($1, $2, $3)',
        ['superadmin', hashedPassword, 'superadmin']
      );
      console.log('✅ Superadmin créé : superadmin / SuperAdmin2025!');
    } else {
      console.log('ℹ️  Superadmin existe déjà');
    }

    if (checkAdmin.rows.length === 0) {
      const hashedAdmin = bcrypt.hashSync('admin123', 10);
      await pool.query(
        'INSERT INTO admins (username, password, role) VALUES ($1, $2, $3)',
        ['admin', hashedAdmin, 'admin']
      );
      console.log('✅ Admin créé : admin / admin123');
    } else {
      console.log('ℹ️  Admin existe déjà');
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

init();