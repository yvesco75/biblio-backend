// Script pour créer le super administrateur
// À exécuter UNE SEULE FOIS : node initSuperAdmin.js

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./bibliotheque.db');

// Créer la table des admins
db.serialize(() => {
  // Table admins
  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Erreur création table:', err);
      return;
    }
    console.log('✅ Table admins créée');
  });

  // Hasher le mot de passe
  const password = 'SuperAdmin2025!'; // MOT DE PASSE À CHANGER !
  const hashedPassword = bcrypt.hashSync(password, 10);

  // Insérer le super admin
  db.run(
    `INSERT OR REPLACE INTO admins (id, username, password, role) 
     VALUES (1, 'superadmin', ?, 'superadmin')`,
    [hashedPassword],
    function(err) {
      if (err) {
        console.error('Erreur création super admin:', err);
      } else {
        console.log('\n🎉 SUPER ADMIN CRÉÉ AVEC SUCCÈS !');
        console.log('================================');
        console.log('Identifiant : superadmin');
        console.log('Mot de passe :', password);
        console.log('================================');
        console.log('⚠️  CHANGEZ CE MOT DE PASSE après la première connexion !');
      }
      
      db.close();
    }
  );
});