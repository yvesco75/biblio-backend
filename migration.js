// migration.js
// Script pour ajouter les nouveaux champs à la base de données
// Exécuter : node migration.js

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log('🔄 Début de la migration...');

    // 1. Ajouter colonne sexe à la table membres
    await pool.query(`
      ALTER TABLE membres 
      ADD COLUMN IF NOT EXISTS sexe TEXT DEFAULT 'Non spécifié'
    `);
    console.log('✅ Colonne "sexe" ajoutée à membres');

    // 2. Ajouter colonne motif à la table mouvements
    await pool.query(`
      ALTER TABLE mouvements 
      ADD COLUMN IF NOT EXISTS motif TEXT
    `);
    console.log('✅ Colonne "motif" ajoutée à mouvements');

    // 3. Créer un index pour améliorer les performances
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_mouvements_type ON mouvements(type);
      CREATE INDEX IF NOT EXISTS idx_mouvements_date ON mouvements(date_heure);
      CREATE INDEX IF NOT EXISTS idx_membres_sexe ON membres(sexe);
    `);
    console.log('✅ Index créés');

    console.log('🎉 Migration terminée avec succès !');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur migration:', error);
    process.exit(1);
  }
}

migrate();