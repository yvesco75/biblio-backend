// Configuration pour PostgreSQL (Production uniquement)
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
const NODE_ENV = process.env.NODE_ENV || 'development';

if (!DATABASE_URL) {
  throw new Error('❌ DATABASE_URL non défini dans les variables d’environnement');
}

console.log('📊 Utilisation de PostgreSQL (Production)');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Fonction pour convertir les paramètres SQLite (?) en PostgreSQL ($1, $2, ...)
const convertQuery = (query) => {
  let index = 0;
  return query.replace(/\?/g, () => `$${++index}`);
};

// Interface compatible SQLite pour le reste du code
const db = {
  run: (query, params, callback) => {
    const pgQuery = convertQuery(query);
    pool.query(pgQuery, params || [])
      .then(result => {
        if (callback) {
          const context = { 
            changes: result.rowCount || 0,
            lastID: result.rows[0]?.id || null 
          };
          callback.call(context, null);
        }
      })
      .catch(err => {
        console.error('Erreur PostgreSQL run:', err);
        if (callback) callback(err);
      });
  },

  get: (query, params, callback) => {
    const pgQuery = convertQuery(query);
    pool.query(pgQuery, params || [])
      .then(result => callback(null, result.rows[0] || null))
      .catch(err => {
        console.error('Erreur PostgreSQL get:', err);
        callback(err);
      });
  },

  all: (query, params, callback) => {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    const pgQuery = convertQuery(query);
    pool.query(pgQuery, params || [])
      .then(result => callback(null, result.rows))
      .catch(err => {
        console.error('Erreur PostgreSQL all:', err);
        callback(err);
      });
  }
};

// ==================== INITIALISATION DES TABLES PostgreSQL ====================
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
    console.log('✅ Table membres créée/vérifiée');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS mouvements (
        id SERIAL PRIMARY KEY,
        membre_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        date_heure TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (membre_id) REFERENCES membres(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Table mouvements créée/vérifiée');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table admins créée/vérifiée');

    // Créer les index
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_membres_telephone ON membres(telephone);
      CREATE INDEX IF NOT EXISTS idx_membres_statut ON membres(statut);
      CREATE INDEX IF NOT EXISTS idx_mouvements_membre_id ON mouvements(membre_id);
      CREATE INDEX IF NOT EXISTS idx_mouvements_date ON mouvements(date_heure DESC);
    `);
    console.log('✅ Index créés/vérifiés');

    console.log('✅ Base de données PostgreSQL initialisée avec succès');
  } catch (error) {
    console.error('❌ Erreur création tables PostgreSQL:', error);
    throw error;
  }
};

initTables();

module.exports = db;
