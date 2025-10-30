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

  // Adapter l'interface pour ressembler à SQLite
  db = {
    run: (query, params, callback) => {
      pool.query(query.replace(/\?/g, (_, i) => `$${params.indexOf(_) + 1}`), params)
        .then(result => callback && callback(null, result.rows[0]))
        .catch(err => callback && callback(err));
    },
    get: (query, params, callback) => {
      pool.query(query.replace(/\?/g, (_, i) => `$${params.indexOf(_) + 1}`), params)
        .then(result => callback(null, result.rows[0]))
        .catch(err => callback(err));
    },
    all: (query, params, callback) => {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      pool.query(query.replace(/\?/g, (_, i) => `$${params.indexOf(_) + 1}`), params)
        .then(result => callback(null, result.rows))
        .catch(err => callback(err));
    }
  };

} else {
  // LOCAL : SQLite
  console.log('📊 Utilisation de SQLite (Local)');
  db = new sqlite3.Database('./bibliotheque.db');
}

module.exports = db;// Script pour ajouter le champ "lien" à la table membres
// Exécuter : node updateDatabase.js    