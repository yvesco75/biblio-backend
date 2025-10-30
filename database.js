// Configuration pour supporter SQLite (local) et PostgreSQL (production)
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

// Déterminer l'environnement
const isProduction = process.env.NODE_ENV === 'production';
const DATABASE_URL = process.env.DATABASE_URL;

let db;

if (isProduction && DATABASE_URL) {
  // PRODUCTION : PostgreSQL
  console.log('📊 Utilisation de PostgreSQL (Production)');
  
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  // Fonction pour convertir ? en $1, $2, $3...
  const convertQuery = (query) => {
    let index = 0;
    return query.replace(/\?/g, () => `$${++index}`);
  };

  // Adapter l'interface pour ressembler à SQLite
  db = {
    run: (query, params, callback) => {
      const pgQuery = convertQuery(query);
      pool.query(pgQuery, params)
        .then(result => {
          if (callback) callback(null);
        })
        .catch(err => {
          if (callback) callback(err);
        });
    },
    
    get: (query, params, callback) => {
      const pgQuery = convertQuery(query);
      pool.query(pgQuery, params)
        .then(result => callback(null, result.rows[0] || null))
        .catch(err => callback(err));
    },
    
    all: (query, params, callback) => {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      const pgQuery = convertQuery(query);
      pool.query(pgQuery, params)
        .then(result => callback(null, result.rows))
        .catch(err => callback(err));
    }
  };

  // Initialiser les tables PostgreSQL
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
          FOREIGN KEY (membre_id) REFERENCES membres(id)
        )
      `);

      console.log('✅ Tables PostgreSQL créées/vérifiées');
    } catch (error) {
      console.error('❌ Erreur création tables:', error);
    }
  };

  initTables();

} else {
  // LOCAL : SQLite
  console.log('📊 Utilisation de SQLite (Local)');
  db = new sqlite3.Database('./bibliotheque.db', (err) => {
    if (err) {
      console.error('❌ Erreur connexion SQLite:', err);
    } else {
      console.log('✅ Connecté à SQLite');
    }
  });
}

module.exports = db;