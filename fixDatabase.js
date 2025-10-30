// Script pour retirer la contrainte UNIQUE sur le téléphone
// Exécuter : node fixDatabase.js

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./bibliotheque.db');

db.serialize(() => {
  console.log('🔧 Correction de la base de données...');

  // Sauvegarder les données existantes
  db.all('SELECT * FROM membres', (err, membres) => {
    if (err) {
      console.error('❌ Erreur lecture:', err);
      return;
    }

    // Supprimer l'ancienne table
    db.run('DROP TABLE IF EXISTS membres_old', () => {
      
      // Renommer la table actuelle
      db.run('ALTER TABLE membres RENAME TO membres_old', () => {
        
        // Créer la nouvelle table SANS contrainte UNIQUE
        db.run(`
          CREATE TABLE membres (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            prenom TEXT NOT NULL,
            telephone TEXT NOT NULL,
            lien TEXT DEFAULT 'Membre',
            date_inscription DATETIME DEFAULT CURRENT_TIMESTAMP,
            statut TEXT DEFAULT 'actif'
          )
        `, () => {
          
          // Réinsérer toutes les données
          const stmt = db.prepare(`
            INSERT INTO membres (id, nom, prenom, telephone, lien, date_inscription, statut)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);

          membres.forEach(membre => {
            stmt.run(
              membre.id,
              membre.nom,
              membre.prenom,
              membre.telephone,
              membre.lien || 'Membre',
              membre.date_inscription,
              membre.statut
            );
          });

          stmt.finalize(() => {
            // Supprimer l'ancienne table
            db.run('DROP TABLE membres_old', () => {
              console.log('✅ Base de données corrigée avec succès !');
              console.log(`✅ ${membres.length} membres conservés`);
              console.log('✅ Vous pouvez maintenant avoir plusieurs personnes avec le même numéro');
              db.close();
            });
          });
        });
      });
    });
  });
});