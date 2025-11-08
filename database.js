// Configuration pour supporter SQLite (local) et PostgreSQL (production)
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

// Déterminer l'environnement
const isProduction = process.env.NODE_ENV === 'production';
const DATABASE_URL = process.env.DATABASE_URL;

let db;

if (isProduction && DATABASE_URL) {
  // ==================== PRODUCTION : PostgreSQL ====================
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
      pool.query(pgQuery, params || [])
        .then(result => {
          if (callback) {
            // Simuler l'objet 'this' de SQLite avec changes
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
      // Table membres - SANS contrainte UNIQUE sur telephone
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

      // Table mouvements
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

      // Table admins
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

      // Créer les index pour améliorer les performances
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

} else {
  // ==================== LOCAL : SQLite ====================
  console.log('📊 Utilisation de SQLite (Local)');
  
  db = new sqlite3.Database('./bibliotheque.db', (err) => {
    if (err) {
      console.error('❌ Erreur connexion SQLite:', err);
    } else {
      console.log('✅ Connecté à SQLite');
    }
  });

  // Initialiser les tables SQLite
  db.serialize(() => {
    // Table membres - SANS contrainte UNIQUE sur telephone
    db.run(`
      CREATE TABLE IF NOT EXISTS membres (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        prenom TEXT NOT NULL,
        telephone TEXT NOT NULL,
        lien TEXT DEFAULT 'Membre',
        date_inscription DATETIME DEFAULT CURRENT_TIMESTAMP,
        statut TEXT DEFAULT 'actif'
      )
    `, (err) => {
      if (err) {
        console.error('❌ Erreur création table membres:', err);
      } else {
        console.log('✅ Table membres créée/vérifiée');
      }
    });

    // Table mouvements
    db.run(`
      CREATE TABLE IF NOT EXISTS mouvements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        membre_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        date_heure DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (membre_id) REFERENCES membres(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('❌ Erreur création table mouvements:', err);
      } else {
        console.log('✅ Table mouvements créée/vérifiée');
      }
    });

    // Table admins
    db.run(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('❌ Erreur création table admins:', err);
      } else {
        console.log('✅ Table admins créée/vérifiée');
      }
    });

    // Créer les index
    db.run('CREATE INDEX IF NOT EXISTS idx_membres_telephone ON membres(telephone)');
    db.run('CREATE INDEX IF NOT EXISTS idx_membres_statut ON membres(statut)');
    db.run('CREATE INDEX IF NOT EXISTS idx_mouvements_membre_id ON mouvements(membre_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_mouvements_date ON mouvements(date_heure DESC)');
    
    console.log('✅ Base de données SQLite initialisée avec succès');
  });
}

module.exports = db;