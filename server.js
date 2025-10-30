// Import des modules nécessaires
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const { verifyToken, verifySuperAdmin, login, changePassword, db: authDb } = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Configuration multer pour upload de fichiers (compatible Vercel)
// Désactivé temporairement - utiliser memoryStorage pour Vercel
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middlewares
app.use(cors());
app.use(express.json());

// CONNEXION À LA BASE DE DONNÉES
const db = require('./database');

// CRÉATION DES TABLES
function initDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS membres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      telephone TEXT UNIQUE NOT NULL,
      date_inscription DATETIME DEFAULT CURRENT_TIMESTAMP,
      statut TEXT DEFAULT 'actif'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS mouvements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      membre_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      date_heure DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (membre_id) REFERENCES membres(id)
    )
  `);

  console.log('✅ Tables créées');
}

// ==================== ROUTES PUBLIQUES ====================

// RECHERCHER MEMBRES PAR NUMÉRO (suggestions)
app.get('/api/search-membres/:telephone', (req, res) => {
  const { telephone } = req.params;

  // Rechercher à partir de 3 chiffres
  if (telephone.length < 3) {
    return res.json([]);
  }

  db.all(
    'SELECT id, nom, prenom, telephone, lien FROM membres WHERE telephone LIKE ? AND statut = "actif"',
    [`%${telephone}%`],
    (err, membres) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      res.json(membres);
    }
  );
});

// POINTER PAR ID (après sélection dans la liste)
app.post('/api/pointer-by-id', (req, res) => {
  const { membreId } = req.body;

  if (!membreId) {
    return res.status(400).json({ error: 'ID membre requis' });
  }

  db.get(
    'SELECT * FROM membres WHERE id = ? AND statut = "actif"',
    [membreId],
    (err, membre) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      
      if (!membre) {
        return res.status(404).json({ error: 'Membre non trouvé' });
      }

      db.get(
        'SELECT type FROM mouvements WHERE membre_id = ? ORDER BY date_heure DESC LIMIT 1',
        [membre.id],
        (err, dernierMouvement) => {
          const type = (dernierMouvement && dernierMouvement.type === 'entrée') ? 'sortie' : 'entrée';

          db.run(
            'INSERT INTO mouvements (membre_id, type) VALUES (?, ?)',
            [membre.id, type],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'Erreur enregistrement' });
              }

              res.json({
                success: true,
                membre: {
                  nom: membre.nom,
                  prenom: membre.prenom,
                  lien: membre.lien
                },
                type: type,
                message: `${type.toUpperCase()} enregistrée avec succès`
              });
            }
          );
        }
      );
    }
  );
});

// LOGIN ADMIN
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  login(username, password, (result) => {
    if (!result) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    res.json({ 
      success: true, 
      token: result.token,
      role: result.role,
      username: result.username,
      message: 'Connexion réussie' 
    });
  });
});

// POINTER (accessible sans authentification)
app.post('/api/pointer', (req, res) => {
  const { telephone } = req.body;

  db.get(
    'SELECT * FROM membres WHERE telephone = ? AND statut = "actif"',
    [telephone],
    (err, membre) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      
      if (!membre) {
        return res.status(404).json({ error: 'Numéro non trouvé. Contactez l\'admin.' });
      }

      db.get(
        'SELECT type FROM mouvements WHERE membre_id = ? ORDER BY date_heure DESC LIMIT 1',
        [membre.id],
        (err, dernierMouvement) => {
          const type = (dernierMouvement && dernierMouvement.type === 'entrée') ? 'sortie' : 'entrée';

          db.run(
            'INSERT INTO mouvements (membre_id, type) VALUES (?, ?)',
            [membre.id, type],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'Erreur enregistrement' });
              }

              res.json({
                success: true,
                membre: {
                  nom: membre.nom,
                  prenom: membre.prenom
                },
                type: type,
                message: `${type.toUpperCase()} enregistrée avec succès`
              });
            }
          );
        }
      );
    }
  );
});

// ==================== ROUTES PROTÉGÉES (ADMIN) ====================

// CHANGER MON MOT DE PASSE
app.post('/api/change-password', verifyToken, (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }

  changePassword(req.user.id, oldPassword, newPassword, (success, message) => {
    if (!success) {
      return res.status(400).json({ error: message });
    }
    res.json({ success: true, message });
  });
});

// ==================== ROUTES SUPER ADMIN ====================

// LISTE DES ADMINS (super admin uniquement)
app.get('/api/admins', verifyToken, verifySuperAdmin, (req, res) => {
  authDb.all('SELECT id, username, role, date_creation FROM admins ORDER BY id', (err, admins) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    res.json(admins);
  });
});

// AJOUTER UN ADMIN (super admin uniquement)
app.post('/api/admins', verifyToken, verifySuperAdmin, (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  authDb.run(
    'INSERT INTO admins (username, password, role) VALUES (?, ?, ?)',
    [username, hashedPassword, 'admin'],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Ce nom d\'utilisateur existe déjà' });
        }
        return res.status(500).json({ error: 'Erreur serveur' });
      }

      res.json({
        success: true,
        message: 'Admin ajouté avec succès',
        id: this.lastID
      });
    }
  );
});

// SUPPRIMER UN ADMIN (super admin uniquement)
app.delete('/api/admins/:id', verifyToken, verifySuperAdmin, (req, res) => {
  const { id } = req.params;

  // Empêcher la suppression du super admin
  if (parseInt(id) === 1) {
    return res.status(403).json({ error: 'Impossible de supprimer le super admin' });
  }

  authDb.run('DELETE FROM admins WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    res.json({ success: true, message: 'Admin supprimé' });
  });
});

// ==================== ROUTES MEMBRES ====================

// AJOUTER UN MEMBRE
app.post('/api/membres', verifyToken, (req, res) => {
  const { nom, prenom, telephone, lien } = req.body;

  if (!nom || !prenom || !telephone) {
    return res.status(400).json({ error: 'Nom, prénom et téléphone sont requis' });
  }

  db.run(
    'INSERT INTO membres (nom, prenom, telephone, lien) VALUES (?, ?, ?, ?)',
    [nom, prenom, telephone, lien || 'Membre'],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Erreur serveur' });
      }

      res.json({
        success: true,
        message: 'Membre ajouté avec succès',
        id: this.lastID
      });
    }
  );
});

// IMPORT EXCEL/CSV
app.post('/api/import', verifyToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier fourni' });
  }

  try {
    // Lire le fichier Excel/CSV
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    let importes = 0;
    let erreurs = 0;
    const errors = [];

    // Insérer chaque ligne
    const promises = data.map((row, index) => {
      return new Promise((resolve) => {
        const nom = row.nom || row.Nom || row.NOM;
        const prenom = row.prenom || row.Prenom || row.PRENOM;
        const telephone = row.telephone || row.Telephone || row.TELEPHONE;

        if (!nom || !prenom || !telephone) {
          erreurs++;
          errors.push(`Ligne ${index + 2}: Données manquantes`);
          resolve();
          return;
        }

        db.run(
          'INSERT INTO membres (nom, prenom, telephone) VALUES (?, ?, ?)',
          [nom, prenom, telephone],
          function(err) {
            if (err) {
              erreurs++;
              errors.push(`Ligne ${index + 2}: ${telephone} - ${err.message}`);
            } else {
              importes++;
            }
            resolve();
          }
        );
      });
    });

    Promise.all(promises).then(() => {
      // Supprimer le fichier temporaire
      const fs = require('fs');
      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        message: `Import terminé: ${importes} ajoutés, ${erreurs} erreurs`,
        importes,
        erreurs,
        errors: errors.length > 0 ? errors : undefined
      });
    });

  } catch (error) {
    res.status(500).json({ error: 'Erreur lecture fichier: ' + error.message });
  }
});

// EXPORT EXCEL
app.get('/api/export/membres', verifyToken, (req, res) => {
  db.all('SELECT * FROM membres WHERE statut = "actif"', (err, membres) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    // Créer un fichier Excel
    const ws = XLSX.utils.json_to_sheet(membres);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Membres');

    // Générer le buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=membres.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  });
});

// EXPORT MOUVEMENTS
app.get('/api/export/mouvements', verifyToken, (req, res) => {
  db.all(
    `SELECT m.id, mb.nom, mb.prenom, mb.telephone, m.type, m.date_heure
     FROM mouvements m 
     JOIN membres mb ON m.membre_id = mb.id 
     ORDER BY m.date_heure DESC`,
    (err, mouvements) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur serveur' });
      }

      const ws = XLSX.utils.json_to_sheet(mouvements);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Mouvements');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Disposition', 'attachment; filename=mouvements.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    }
  );
});

// LISTE DES MEMBRES
app.get('/api/membres', verifyToken, (req, res) => {
  db.all('SELECT * FROM membres ORDER BY nom', (err, membres) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    res.json(membres);
  });
});

// HISTORIQUE DES MOUVEMENTS
app.get('/api/mouvements', verifyToken, (req, res) => {
  const { limit = 50 } = req.query;

  db.all(
    `SELECT m.*, mb.nom, mb.prenom, mb.telephone 
     FROM mouvements m 
     JOIN membres mb ON m.membre_id = mb.id 
     ORDER BY m.date_heure DESC 
     LIMIT ?`,
    [limit],
    (err, mouvements) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      res.json(mouvements);
    }
  );
});

// QUI EST PRÉSENT
app.get('/api/presents', verifyToken, (req, res) => {
  db.all(
    `SELECT mb.id, mb.nom, mb.prenom, mb.telephone, 
            m.date_heure as heure_entree
     FROM membres mb
     JOIN mouvements m ON mb.id = m.membre_id
     WHERE m.type = 'entrée' 
     AND m.id = (
       SELECT MAX(id) FROM mouvements WHERE membre_id = mb.id
     )
     ORDER BY m.date_heure DESC`,
    (err, presents) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      res.json(presents);
    }
  );
});

// SUPPRIMER UN MEMBRE
app.delete('/api/membres/:id', verifyToken, (req, res) => {
  const { id } = req.params;

  db.run('UPDATE membres SET statut = "inactif" WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    res.json({ success: true, message: 'Membre désactivé' });
  });
});

// ==================== DÉMARRAGE DU SERVEUR ====================
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📊 Base de données : bibliotheque.db`);
  console.log(`🔐 Admin par défaut : admin / admin123`);
});

process.on('SIGINT', () => {
  db.close(() => {
    console.log('🔴 Serveur arrêté');
    process.exit(0);
  });
});