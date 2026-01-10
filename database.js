// database.js - VERSION COMPLÈTE MISE À JOUR
// Remplacer TOUT le contenu du fichier backend/database.js par ce code

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const initTables = async () => {
  try {
    // ==================== TABLE MEMBRES ====================
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
    console.log('✅ Table membres créée');

    // Ajouter colonne sexe si elle n'existe pas
    const checkSexe = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='membres' AND column_name='sexe'
    `);
    
    if (checkSexe.rows.length === 0) {
      await pool.query(`ALTER TABLE membres ADD COLUMN sexe TEXT DEFAULT 'Non spécifié'`);
      console.log('✅ Colonne sexe ajoutée à membres');
    }

    // ==================== TABLE MOUVEMENTS ====================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mouvements (
        id SERIAL PRIMARY KEY,
        membre_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        date_heure TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (membre_id) REFERENCES membres(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Table mouvements créée');

    // Ajouter colonne motif si elle n'existe pas
    const checkMotif = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='mouvements' AND column_name='motif'
    `);
    
    if (checkMotif.rows.length === 0) {
      await pool.query(`ALTER TABLE mouvements ADD COLUMN motif TEXT`);
      console.log('✅ Colonne motif ajoutée à mouvements');
    }

    // ==================== TABLE ADMINS ====================
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

    // ==================== INDEX ====================
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_membres_telephone ON membres(telephone);
      CREATE INDEX IF NOT EXISTS idx_membres_statut ON membres(statut);
      CREATE INDEX IF NOT EXISTS idx_membres_sexe ON membres(sexe);
      CREATE INDEX IF NOT EXISTS idx_mouvements_membre_id ON mouvements(membre_id);
      CREATE INDEX IF NOT EXISTS idx_mouvements_type ON mouvements(type);
      CREATE INDEX IF NOT EXISTS idx_mouvements_date ON mouvements(date_heure);
    `);
    console.log('✅ Index créés');

    console.log('🎉 Base de données initialisée avec succès');
  } catch (error) {
    console.error('❌ Erreur init tables:', error);
  }
};

initTables();

module.exports = pool;