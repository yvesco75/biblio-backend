// Script pour ajouter le champ "lien" à la table membres
// Exécuter : node updateDatabase.js

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./bibliotheque.db');

db.serialize(() => {
  // Vérifier si la colonne existe déjà
  db.all("PRAGMA table_info(membres)", (err, columns) => {
    const hasLien = columns.some(col => col.name === 'lien');
    
    if (!hasLien) {
      // Ajouter la colonne "lien"
      db.run(`ALTER TABLE membres ADD COLUMN lien TEXT DEFAULT 'Membre'`, (err) => {
        if (err) {
          console.error('❌ Erreur:', err);
        } else {
          console.log('✅ Colonne "lien" ajoutée avec succès !');
        }
        db.close();
      });
    } else {
      console.log('ℹ️  La colonne "lien" existe déjà');
      db.close();
    }
  });
});