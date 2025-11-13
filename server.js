// Import des modules nécessaires
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const { verifyToken, verifySuperAdmin, login, changePassword } = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Configuration multer pour Vercel (memoryStorage)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// Middlewares
app.use(cors());
app.use(express.json());

// CONNEXION À LA BASE DE DONNÉES
const db = require('./database');

// ⚠️ IMPORTANT : Les tables sont déjà créées dans database.js
// Plus besoin de initDatabase() ici

// ==================== ROUTES PUBLIQUES ====================

// RECHERCHER MEMBRES PAR NUMÉRO (suggestions)
app.get('/api/search-membres/:telephone', (req, res) => {
  const { telephone } = req.params;

  if (telephone.length < 3) {
    return res.json([]);
  }

  db.all(
    'SELECT id, nom, prenom, telephone, lien FROM membres WHERE telephone LIKE ? AND statut = ?',
    [`%${telephone}%`, 'actif'],
    (err, membres) => {
      if (err) {
        console.error('Erreur recherche membres:', err);
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
    'SELECT * FROM membres WHERE id = ? AND statut = ?',
    [membreId, 'actif'],
    (err, membre) => {
      if (err) {
        console.error('Erreur récupération membre:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      
      if (!membre) {
        return res.status(404).json({ error: 'Membre non trouvé' });
      }

      db.get(
        'SELECT type FROM mouvements WHERE membre_id = ? ORDER BY date_heure DESC LIMIT 1',
        [membre.id],
        (err, dernierMouvement) => {
          if (err) {
            console.error('Erreur dernier mouvement:', err);
            return res.status(500).json({ error: 'Erreur serveur' });
          }

          const type = (dernierMouvement && dernierMouvement.type === 'entrée') ? 'sortie' : 'entrée';

          db.run(
            'INSERT INTO mouvements (membre_id, type) VALUES (?, ?)',
            [membre.id, type],
            function(err) {
              if (err) {
                console.error('Erreur enregistrement mouvement:', err);
                return res.status(500).json({ error: 'Erreur enregistrement' });
              }

              res.json({
                success: true,
                membre: {
                  nom: membre.nom,
                  prenom: membre.prenom,
                  lien: membre.lien || 'Membre'
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

  if (!username || !password) {
    return res.status(400).json({ error: 'Identifiants requis' });
  }

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
  const authDb = require('./auth').db;
  
  authDb.all('SELECT id, username, role, date_creation FROM admins ORDER BY id', (err, admins) => {
    if (err) {
      console.error('Erreur liste admins:', err);
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
  const authDb = require('./auth').db;

  authDb.run(
    'INSERT INTO admins (username, password, role) VALUES (?, ?, ?)',
    [username, hashedPassword, 'admin'],
    function(err) {
      if (err) {
        console.error('Erreur ajout admin:', err);
        if (err.message.includes('UNIQUE') || err.code === '23505') {
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
  const authDb = require('./auth').db;

  // Empêcher la suppression du super admin
  if (parseInt(id) === 1) {
    return res.status(403).json({ error: 'Impossible de supprimer le super admin' });
  }

  authDb.run('DELETE FROM admins WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Erreur suppression admin:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    res.json({ success: true, message: 'Admin supprimé' });
  });
});

// ==================== ROUTES MEMBRES ====================

// AJOUTER UN MEMBRE
app.post('/api/membres', verifyToken, (req, res) => {
  const { nom, prenom, telephone, lien } = req.body;

  // Validation téléphone
  if (!/^\d{10,}$/.test(telephone)) {
    return res.status(400).json({ 
      error: 'Le téléphone doit contenir au moins 10 chiffres' 
    });
  }

  if (!nom || !prenom || !telephone) {
    return res.status(400).json({ error: 'Nom, prénom et téléphone sont requis' });
  }

  db.run(
    'INSERT INTO membres (nom, prenom, telephone, lien) VALUES (?, ?, ?, ?)',
    [nom.trim(), prenom.trim(), telephone.trim(), lien.trim() || 'Membre'],
    function(err) {
      if (err) {
        console.error('Erreur ajout membre:', err);
        if (err.message.includes('UNIQUE') || err.code === '23505') {
          return res.status(400).json({ error: 'Ce numéro de téléphone existe déjà' });
        }
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

// IMPORT EXCEL/CSV - CORRIGÉ POUR VERCEL
app.post('/api/import', verifyToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier fourni' });
  }

  try {
    // ✅ Lire depuis le buffer (memoryStorage)
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      return res.status(400).json({ error: 'Le fichier est vide' });
    }

    let importes = 0;
    let erreurs = 0;
    const errors = [];

    // Insérer chaque ligne
    const promises = data.map((row, index) => {
      return new Promise((resolve) => {
        const nom = row.nom || row.Nom || row.NOM;
        const prenom = row.prenom || row.Prenom || row.PRENOM || row.Prénom;
        const telephone = row.telephone || row.Telephone || row.TELEPHONE || row.Téléphone;
        const lien = row.lien || row.Lien || row.LIEN || 'Membre';

        if (!nom || !prenom || !telephone) {
          erreurs++;
          errors.push(`Ligne ${index + 2}: Données manquantes (nom: ${nom}, prenom: ${prenom}, tel: ${telephone})`);
          resolve();
          return;
        }

        db.run(
          'INSERT INTO membres (nom, prenom, telephone, lien) VALUES (?, ?, ?, ?)',
          [nom.trim(), prenom.trim(), telephone.trim(), lien.trim()],
          function(err) {
            if (err) {
              erreurs++;
              if (err.message.includes('UNIQUE') || err.code === '23505') {
                errors.push(`Ligne ${index + 2}: ${telephone} existe déjà`);
              } else {
                errors.push(`Ligne ${index + 2}: ${err.message}`);
              }
            } else {
              importes++;
            }
            resolve();
          }
        );
      });
    });

    Promise.all(promises).then(() => {
      res.json({
        success: true,
        message: `Import terminé: ${importes} ajoutés, ${erreurs} erreurs`,
        importes,
        erreurs,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined // Limiter à 10 erreurs
      });
    });

  } catch (error) {
    console.error('Erreur import:', error);
    res.status(500).json({ error: 'Erreur lecture fichier: ' + error.message });
  }
});

// EXPORT EXCEL
app.get('/api/export/membres', verifyToken, (req, res) => {
  db.all('SELECT * FROM membres WHERE statut = ?', ['actif'], (err, membres) => {
    if (err) {
      console.error('Erreur export membres:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    try {
      const ws = XLSX.utils.json_to_sheet(membres);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Membres');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Disposition', 'attachment; filename=membres.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    } catch (error) {
      console.error('Erreur génération Excel:', error);
      res.status(500).json({ error: 'Erreur génération fichier' });
    }
  });
});

// EXPORT MOUVEMENTS
app.get('/api/export/mouvements', verifyToken, (req, res) => {
  db.all(
    `SELECT m.id, mb.nom, mb.prenom, mb.telephone, m.type, m.date_heure
     FROM mouvements m 
     JOIN membres mb ON m.membre_id = mb.id 
     ORDER BY m.date_heure DESC`,
    [],
    (err, mouvements) => {
      if (err) {
        console.error('Erreur export mouvements:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }

      try {
        const ws = XLSX.utils.json_to_sheet(mouvements);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Mouvements');
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename=mouvements.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
      } catch (error) {
        console.error('Erreur génération Excel:', error);
        res.status(500).json({ error: 'Erreur génération fichier' });
      }
    }
  );
});

// LISTE DES MEMBRES
app.get('/api/membres', verifyToken, (req, res) => {
  db.all('SELECT * FROM membres ORDER BY nom', [], (err, membres) => {
    if (err) {
      console.error('Erreur liste membres:', err);
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
    [parseInt(limit)],
    (err, mouvements) => {
      if (err) {
        console.error('Erreur historique:', err);
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
     WHERE m.type = ? 
     AND m.id = (
       SELECT MAX(id) FROM mouvements WHERE membre_id = mb.id
     )
     ORDER BY m.date_heure DESC`,
    ['entrée'],
    (err, presents) => {
      if (err) {
        console.error('Erreur présents:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      res.json(presents);
    }
  );
});

// SUPPRIMER UN MEMBRE
app.delete('/api/membres/:id', verifyToken, (req, res) => {
  const { id } = req.params;

  db.run('UPDATE membres SET statut = ? WHERE id = ?', ['inactif', id], function(err) {
    if (err) {
      console.error('Erreur désactivation membre:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Membre non trouvé' });
    }

    res.json({ success: true, message: 'Membre désactivé' });
  });
});

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API fonctionnelle' });
});

// ==================== DÉMARRAGE DU SERVEUR ====================
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📊 Environnement : ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 JWT Secret configuré : ${process.env.JWT_SECRET ? 'Oui' : 'Non (utilise valeur par défaut)'}`);
});

process.on('SIGINT', () => {
  console.log('🔴 Arrêt du serveur...');
  process.exit(0);
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('❌ Erreur non capturée:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejetée:', reason);
});

// ==================== ROUTE STATISTIQUES (Compatible avec votre db abstraction) ====================
app.get('/api/stats', verifyToken, (req, res) => {
  // Compter les membres actifs
  db.get(
    'SELECT COUNT(*) as total FROM membres WHERE statut = ?',
    ['actif'],
    (err, membresResult) => {
      if (err) {
        console.error('❌ Erreur stats membres:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }

      // Compter les personnes présentes
      db.get(
        `SELECT COUNT(DISTINCT membre_id) as total 
         FROM mouvements m1 
         WHERE type = ? 
         AND id = (SELECT MAX(id) FROM mouvements WHERE membre_id = m1.membre_id)`,
        ['entrée'],
        (err, presentsResult) => {
          if (err) {
            console.error('❌ Erreur stats présents:', err);
            return res.status(500).json({ error: 'Erreur serveur' });
          }

          res.json({
            totalMembres: membresResult.total || 0,
            presentsAujourdhui: presentsResult.total || 0
          });
        }
      );
    }
  );
});

// ==================== ROUTE STATISTIQUES ====================
app.get('/api/stats', verifyToken, (req, res) => {
  // Compter les membres actifs
  db.get(
    'SELECT COUNT(*) as total FROM membres WHERE statut = ?',
    ['actif'],
    (err, membresResult) => {
      if (err) {
        console.error('❌ Erreur stats membres:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }

      // Compter les personnes présentes
      db.get(
        `SELECT COUNT(DISTINCT membre_id) as total 
         FROM mouvements m1 
         WHERE type = ? 
         AND id = (SELECT MAX(id) FROM mouvements WHERE membre_id = m1.membre_id)`,
        ['entrée'],
        (err, presentsResult) => {
          if (err) {
            console.error('❌ Erreur stats présents:', err);
            return res.status(500).json({ error: 'Erreur serveur' });
          }

          res.json({
            totalMembres: membresResult.total || 0,
            presentsAujourdhui: presentsResult.total || 0
          });
        }
      );
    }
  );
});