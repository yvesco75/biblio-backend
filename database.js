const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const initTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS membres (
        id SERIAL PRIMARY KEY,
        nom TEXT NOT NULL,
        prenom TEXT NOT NULL,
        telephone TEXT NOT NULL,
        lien TEXT DEFAULT 'Membre',
        date_inscription TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        statut TEXT DEFAULT 'actif'
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS mouvements (
        id SERIAL PRIMARY KEY,
        membre_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        date_heure TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (membre_id) REFERENCES membres(id) ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_membres_telephone ON membres(telephone);
      CREATE INDEX IF NOT EXISTS idx_membres_statut ON membres(statut);
      CREATE INDEX IF NOT EXISTS idx_mouvements_membre_id ON mouvements(membre_id);
    `);

    console.log('✅ Tables PostgreSQL initialisées');
  } catch (error) {
    console.error('❌ Erreur init tables:', error);
  }
};

initTables();

module.exports = pool;