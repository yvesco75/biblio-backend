require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const { verifyToken, verifySuperAdmin, login, changePassword, pool } = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;

const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json());

// ==================== AUTO-CRÉATION COMPTES ADMIN ====================
(async () => {
  try {
    const checkSuper = await pool.query('SELECT * FROM admins WHERE username = $1', ['superadmin']);
    
    if (checkSuper.rows.length === 0) {
      const hashedSuper = bcrypt.hashSync('SuperAdmin2025!', 10);
      const hashedAdmin = bcrypt.hashSync('admin123', 10);
      
      await pool.query('INSERT INTO admins (username, password, role) VALUES ($1, $2, $3)', ['superadmin', hashedSuper, 'superadmin']);
      await pool.query('INSERT INTO admins (username, password, role) VALUES ($1, $2, $3)', ['admin', hashedAdmin, 'admin']);
      
      console.log('✅ Comptes admin créés : superadmin / SuperAdmin2025! | admin / admin123');
    } else {
      console.log('ℹ️  Comptes admin déjà existants');
    }
  } catch (err) {
    console.error('❌ Init admins:', err.message);
  }
})();

// ==================== ROUTES PUBLIQUES ====================

app.get('/api/search-membres/:telephone', (req, res) => {
  const { telephone } = req.params;
  if (telephone.length < 3) return res.json([]);

  pool.query(
    'SELECT id, nom, prenom, telephone, lien FROM membres WHERE telephone LIKE $1 AND statut = $2',
    [`%${telephone}%`, 'actif'],
    (err, result) => {
      if (err) {
        console.error('Erreur recherche membres:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      res.json(result.rows);
    }
  );
});

app.post('/api/pointer-by-id', (req, res) => {
  const { membreId, motif } = req.body;
  if (!membreId) return res.status(400).json({ error: 'ID membre requis' });

  pool.query(
    'SELECT * FROM membres WHERE id = $1 AND statut = $2',
    [membreId, 'actif'],
    (err, result) => {
      if (err || result.rows.length === 0) {
        return res.status(404).json({ error: 'Membre non trouvé' });
      }
      
      const membre = result.rows[0];

      pool.query(
        'SELECT type FROM mouvements WHERE membre_id = $1 ORDER BY date_heure DESC LIMIT 1',
        [membre.id],
        (err, mvtResult) => {
          if (err) return res.status(500).json({ error: 'Erreur serveur' });

          const type = (mvtResult.rows.length > 0 && mvtResult.rows[0].type === 'entrée') ? 'sortie' : 'entrée';
          const motifValue = (type === 'entrée' && motif) ? motif : null;

          pool.query(
            'INSERT INTO mouvements (membre_id, type, motif) VALUES ($1, $2, $3)',
            [membre.id, type, motifValue],
            (err) => {
              if (err) return res.status(500).json({ error: 'Erreur enregistrement' });
              res.json({
                success: true,
                membre: {
                  nom: membre.nom,
                  prenom: membre.prenom,
                  lien: membre.lien || 'Membre'
                },
                type: type,
                needMotif: type === 'entrée',
                message: `${type.toUpperCase()} enregistrée avec succès`
              });
            }
          );
        }
      );
    }
  );
});

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

// ==================== ROUTES PROTÉGÉES ====================

app.post('/api/change-password', verifyToken, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }

  changePassword(req.user.id, oldPassword, newPassword, (success, message) => {
    if (!success) return res.status(400).json({ error: message });
    res.json({ success: true, message });
  });
});

// ==================== ROUTES SUPER ADMIN ====================

app.get('/api/admins', verifyToken, verifySuperAdmin, (req, res) => {
  pool.query('SELECT id, username, role, date_creation FROM admins ORDER BY id', (err, result) => {
    if (err) {
      console.error('Erreur liste admins:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    res.json(result.rows);
  });
});

app.post('/api/admins', verifyToken, verifySuperAdmin, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  pool.query(
    'INSERT INTO admins (username, password, role) VALUES ($1, $2, $3) RETURNING id',
    [username, hashedPassword, 'admin'],
    (err, result) => {
      if (err) {
        console.error('Erreur ajout admin:', err);
        if (err.code === '23505') {
          return res.status(400).json({ error: 'Ce nom d\'utilisateur existe déjà' });
        }
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      res.json({
        success: true,
        message: 'Admin ajouté avec succès',
        id: result.rows[0].id
      });
    }
  );
});

app.delete('/api/admins/:id', verifyToken, verifySuperAdmin, (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === 1) {
    return res.status(403).json({ error: 'Impossible de supprimer le super admin' });
  }

  pool.query('DELETE FROM admins WHERE id = $1', [id], (err) => {
    if (err) {
      console.error('Erreur suppression admin:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    res.json({ success: true, message: 'Admin supprimé' });
  });
});

// SUPPRIMER TOUS LES MEMBRES
app.post('/api/reset-membres', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE mouvements, membres RESTART IDENTITY CASCADE');
    res.json({ success: true, message: 'Base réinitialisée' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// ==================== ROUTES MEMBRES ====================

app.post('/api/membres', verifyToken, (req, res) => {
  const { nom, prenom, telephone, sexe, lien } = req.body;

  if (!/^\d{8,}$/.test(telephone)) {
    return res.status(400).json({ error: 'Le téléphone doit contenir au moins 8 chiffres' });
  }
  if (!nom || !prenom || !telephone) {
    return res.status(400).json({ error: 'Nom, prénom et téléphone sont requis' });
  }

  // Vérifier doublon nom+prénom
  pool.query(
    'SELECT * FROM membres WHERE LOWER(TRIM(nom)) = LOWER(TRIM($1)) AND LOWER(TRIM(prenom)) = LOWER(TRIM($2)) AND statut = $3',
    [nom, prenom, 'actif'],
    (err, checkResult) => {
      if (err) {
        console.error('Erreur vérification doublon:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }

      if (checkResult.rows.length > 0) {
        return res.status(400).json({ error: 'Cette personne (même nom et prénom) est déjà enregistrée' });
      }

      // Insérer avec sexe
      pool.query(
        'INSERT INTO membres (nom, prenom, telephone, sexe, lien) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [nom.trim(), prenom.trim(), telephone.trim(), sexe || 'Non spécifié', lien?.trim() || 'Étudiant'],
        (err, result) => {
          if (err) {
            console.error('Erreur ajout membre:', err);
            return res.status(500).json({ error: 'Erreur serveur' });
          }
          res.json({
            success: true,
            message: 'Membre ajouté avec succès',
            id: result.rows[0].id
          });
        }
      );
    }
  );
});

app.post('/api/import', verifyToken, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

  try {
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

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const nom = row.nom || row.Nom || row.NOM;
      const prenom = row.prenom || row.Prenom || row.PRENOM || row.Prénom;
      const telephone = row.telephone || row.Telephone || row.TELEPHONE || row.Téléphone;
      const lien = row.lien || row.Lien || row.LIEN || 'Membre';
      const sexe = row.sexe || row.Sexe || row.SEXE || 'Non spécifié';

      if (!nom || !prenom || !telephone) {
        erreurs++;
        errors.push(`Ligne ${i + 2}: Données manquantes`);
        continue;
      }

      try {
        // ✅ CORRECTION ICI : Ajout du champ sexe dans l'INSERT
        await pool.query(
          'INSERT INTO membres (nom, prenom, telephone, sexe, lien) VALUES ($1, $2, $3, $4, $5)',
          [nom.trim(), prenom.trim(), telephone.trim(), sexe.trim(), lien.trim()]
        );
        importes++;
      } catch (err) {
        erreurs++;
        if (err.code === '23505') {
          errors.push(`Ligne ${i + 2}: Doublon détecté`);
        } else {
          errors.push(`Ligne ${i + 2}: ${err.message}`);
        }
      }
    }

    res.json({
      success: true,
      message: `Import terminé: ${importes} ajoutés, ${erreurs} erreurs`,
      importes,
      erreurs,
      errors: errors.slice(0, 10)
    });
  } catch (error) {
    console.error('Erreur import:', error);
    res.status(500).json({ error: 'Erreur lecture fichier: ' + error.message });
  }
});

app.get('/api/export/membres', verifyToken, (req, res) => {
  pool.query('SELECT * FROM membres WHERE statut = $1', ['actif'], (err, result) => {
    if (err) {
      console.error('Erreur export membres:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    try {
      const ws = XLSX.utils.json_to_sheet(result.rows);
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

app.get('/api/export/mouvements', verifyToken, (req, res) => {
  pool.query(
    `SELECT m.id, mb.nom, mb.prenom, mb.telephone, m.type, m.date_heure
     FROM mouvements m 
     JOIN membres mb ON m.membre_id = mb.id 
     ORDER BY m.date_heure DESC`,
    [],
    (err, result) => {
      if (err) {
        console.error('Erreur export mouvements:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }

      try {
        const ws = XLSX.utils.json_to_sheet(result.rows);
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

app.get('/api/membres', verifyToken, (req, res) => {
  pool.query('SELECT * FROM membres ORDER BY nom', [], (err, result) => {
    if (err) {
      console.error('Erreur liste membres:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    res.json(result.rows);
  });
});

app.get('/api/mouvements', verifyToken, (req, res) => {
  const { limit = 50 } = req.query;

  pool.query(
    `SELECT m.*, mb.nom, mb.prenom, mb.telephone 
     FROM mouvements m 
     JOIN membres mb ON m.membre_id = mb.id 
     ORDER BY m.date_heure DESC 
     LIMIT $1`,
    [parseInt(limit)],
    (err, result) => {
      if (err) {
        console.error('Erreur historique:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      res.json(result.rows);
    }
  );
});

app.get('/api/presents', verifyToken, (req, res) => {
  pool.query(
    `SELECT mb.id, mb.nom, mb.prenom, mb.telephone, 
            m.date_heure as heure_entree
     FROM membres mb
     JOIN mouvements m ON mb.id = m.membre_id
     WHERE m.type = $1 
     AND m.id = (
       SELECT MAX(id) FROM mouvements WHERE membre_id = mb.id
     )
     ORDER BY m.date_heure DESC`,
    ['entrée'],
    (err, result) => {
      if (err) {
        console.error('Erreur présents:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      res.json(result.rows);
    }
  );
});

app.delete('/api/membres/:id', verifyToken, (req, res) => {
  const { id } = req.params;

  pool.query('UPDATE membres SET statut = $1 WHERE id = $2', ['inactif', id], (err, result) => {
    if (err) {
      console.error('Erreur désactivation membre:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Membre non trouvé' });
    }

    res.json({ success: true, message: 'Membre désactivé' });
  });
});


// Statistiques par sexe
app.get('/api/stats/sexe', verifyToken, (req, res) => {
  pool.query(
    `SELECT sexe, COUNT(*) as total 
     FROM membres 
     WHERE statut = $1 
     GROUP BY sexe 
     ORDER BY total DESC`,
    ['actif'],
    (err, result) => {
      if (err) {
        console.error('Erreur stats sexe:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      res.json(result.rows);
    }
  );
});

// Statistiques par motif de visite
app.get('/api/stats/motifs', verifyToken, (req, res) => {
  pool.query(
    `SELECT 
       TRIM(UNNEST(string_to_array(motif, ','))) as motif,
       COUNT(*) as total 
     FROM mouvements 
     WHERE motif IS NOT NULL 
     AND type = $1
     GROUP BY TRIM(UNNEST(string_to_array(motif, ',')))
     ORDER BY total DESC`,
    ['entrée'],
    (err, result) => {
      if (err) {
        console.error('Erreur stats motifs:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      res.json(result.rows);
    }
  );
});

// Statistiques par catégorie (lien)
app.get('/api/stats/categories', verifyToken, (req, res) => {
  pool.query(
    `SELECT 
       COALESCE(NULLIF(TRIM(lien), ''), 'Non spécifié') as lien,
       COUNT(*) as total 
     FROM membres 
     WHERE statut = $1 
     GROUP BY COALESCE(NULLIF(TRIM(lien), ''), 'Non spécifié')
     ORDER BY total DESC`,
    ['actif'],
    (err, result) => {
      if (err) {
        console.error('Erreur stats catégories:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      res.json(result.rows);
    }
  );
});

// Évolution des visites (7 derniers jours)
app.get('/api/stats/evolution', verifyToken, (req, res) => {
  pool.query(
    `SELECT 
       DATE(date_heure) as date,
       COUNT(*) as total
     FROM mouvements
     WHERE type = $1
     AND date_heure >= CURRENT_DATE - INTERVAL '7 days'
     GROUP BY DATE(date_heure)
     ORDER BY date ASC`,
    ['entrée'],
    (err, result) => {
      if (err) {
        console.error('Erreur stats évolution:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      res.json(result.rows);
    }
  );
});

// Top 10 visiteurs
app.get('/api/stats/top-visiteurs', verifyToken, (req, res) => {
  pool.query(
    `SELECT 
       m.nom, 
       m.prenom,
       m.sexe,
       m.lien,
       COUNT(*) as nombre_visites
     FROM mouvements mv
     JOIN membres m ON mv.membre_id = m.id
     WHERE mv.type = $1
     AND m.statut = $2
     GROUP BY m.id, m.nom, m.prenom, m.sexe, m.lien
     ORDER BY nombre_visites DESC
     LIMIT 10`,
    ['entrée', 'actif'],
    (err, result) => {
      if (err) {
        console.error('Erreur top visiteurs:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      res.json(result.rows);
    }
  );
});

// Statistiques globales enrichies
app.get('/api/stats/global', verifyToken, (req, res) => {
  Promise.all([
    // Total membres actifs
    pool.query('SELECT COUNT(*) as total FROM membres WHERE statut = $1', ['actif']),
    
    // Présents maintenant
    pool.query(`
      SELECT COUNT(DISTINCT membre_id) as total 
      FROM mouvements m1 
      WHERE type = $1 
      AND id = (SELECT MAX(id) FROM mouvements WHERE membre_id = m1.membre_id)
    `, ['entrée']),
    
    // Total visites aujourd'hui
    pool.query(`
      SELECT COUNT(*) as total 
      FROM mouvements 
      WHERE DATE(date_heure) = CURRENT_DATE 
      AND type = $1
    `, ['entrée']),
    
    // Répartition hommes/femmes
    pool.query(`
      SELECT sexe, COUNT(*) as total 
      FROM membres 
      WHERE statut = $1 
      GROUP BY sexe
    `, ['actif'])
  ])
  .then(([membresRes, presentsRes, visitesRes, sexeRes]) => {
    res.json({
      totalMembres: parseInt(membresRes.rows[0].total) || 0,
      presentsAujourdhui: parseInt(presentsRes.rows[0].total) || 0,
      visitesAujourdhui: parseInt(visitesRes.rows[0].total) || 0,
      repartitionSexe: sexeRes.rows
    });
  })
  .catch(err => {
    console.error('Erreur stats global:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  });
});


// MODIFIER la route POST /api/pointer-by-id pour inclure le motif
app.post('/api/pointer-by-id', (req, res) => {
  const { membreId, motif } = req.body;
  if (!membreId) return res.status(400).json({ error: 'ID membre requis' });

  pool.query(
    'SELECT * FROM membres WHERE id = $1 AND statut = $2',
    [membreId, 'actif'],
    (err, result) => {
      if (err || result.rows.length === 0) {
        return res.status(404).json({ error: 'Membre non trouvé' });
      }
      
      const membre = result.rows[0];

      pool.query(
        'SELECT type FROM mouvements WHERE membre_id = $1 ORDER BY date_heure DESC LIMIT 1',
        [membre.id],
        (err, mvtResult) => {
          if (err) return res.status(500).json({ error: 'Erreur serveur' });

          const type = (mvtResult.rows.length > 0 && mvtResult.rows[0].type === 'entrée') ? 'sortie' : 'entrée';

          // MOTIF UNIQUEMENT POUR LES ENTRÉES
          const motifValue = (type === 'entrée' && motif) ? motif : null;

          pool.query(
            'INSERT INTO mouvements (membre_id, type, motif) VALUES ($1, $2, $3)',
            [membre.id, type, motifValue],
            (err) => {
              if (err) return res.status(500).json({ error: 'Erreur enregistrement' });
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


// MODIFIER la route POST /api/membres pour inclure le sexe
app.post('/api/membres', verifyToken, (req, res) => {
  const { nom, prenom, telephone, lien, sexe } = req.body; // Ajout du sexe

  if (!/^\d{8,}$/.test(telephone)) {
    return res.status(400).json({ error: 'Le téléphone doit contenir au moins 8 chiffres' });
  }
  if (!nom || !prenom || !telephone || !sexe) {
    return res.status(400).json({ error: 'Nom, prénom, téléphone et sexe sont requis' });
  }

  pool.query(
    'SELECT * FROM membres WHERE LOWER(nom) = LOWER($1) AND LOWER(prenom) = LOWER($2) AND statut = $3',
    [nom.trim(), prenom.trim(), 'actif'],
    (err, checkResult) => {
      if (err) {
        console.error('Erreur vérification doublon:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }

      if (checkResult.rows.length > 0) {
        return res.status(400).json({ error: 'Cette personne est déjà enregistrée' });
      }

      pool.query(
        'INSERT INTO membres (nom, prenom, telephone, sexe, lien) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [nom.trim(), prenom.trim(), telephone.trim(), sexe.trim(), lien?.trim() || 'Étudiant'],
        (err, result) => {
          if (err) {
            console.error('Erreur ajout membre:', err);
            return res.status(500).json({ error: 'Erreur serveur' });
          }
          res.json({
            success: true,
            message: 'Membre ajouté avec succès',
            id: result.rows[0].id
          });
        }
      );
    }
  );
});


// MODIFIER la route POST /api/import pour inclure le sexe
app.post('/api/import', verifyToken, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

  try {
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

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const nom = row.nom || row.Nom || row.NOM;
      const prenom = row.prenom || row.Prenom || row.PRENOM || row.Prénom;
      const telephone = row.telephone || row.Telephone || row.TELEPHONE || row.Téléphone;
      const lien = row.lien || row.Lien || row.LIEN || 'Membre';
      const sexe = row.sexe || row.Sexe || row.SEXE || 'Non spécifié'; // Ajout du sexe

      if (!nom || !prenom || !telephone) {
        erreurs++;
        errors.push(`Ligne ${i + 2}: Données manquantes`);
        continue;
      }

      try {
        await pool.query(
          'INSERT INTO membres (nom, prenom, telephone, sexe, lien) VALUES ($1, $2, $3, $4, $5)',
          [nom.trim(), prenom.trim(), telephone.trim(), sexe.trim(), lien.trim()]
        );
        importes++;
      } catch (err) {
        erreurs++;
        if (err.code === '23505') {
          errors.push(`Ligne ${i + 2}: ${telephone} existe déjà`);
        } else {
          errors.push(`Ligne ${i + 2}: ${err.message}`);
        }
      }
    }

    res.json({
      success: true,
      message: `Import terminé: ${importes} ajoutés, ${erreurs} erreurs`,
      importes,
      erreurs,
      errors: errors.slice(0, 10)
    });
  } catch (error) {
    console.error('Erreur import:', error);
    res.status(500).json({ error: 'Erreur lecture fichier: ' + error.message });
  }
});





app.get('/api/stats', verifyToken, (req, res) => {
  pool.query('SELECT COUNT(*) as total FROM membres WHERE statut = $1', ['actif'], (err, membresResult) => {
    if (err) {
      console.error('Erreur stats membres:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    pool.query(
      `SELECT COUNT(DISTINCT membre_id) as total 
       FROM mouvements m1 
       WHERE type = $1 
       AND id = (SELECT MAX(id) FROM mouvements WHERE membre_id = m1.membre_id)`,
      ['entrée'],
      (err, presentsResult) => {
        if (err) {
          console.error('Erreur stats présents:', err);
          return res.status(500).json({ error: 'Erreur serveur' });
        }

        res.json({
          totalMembres: parseInt(membresResult.rows[0].total) || 0,
          presentsAujourdhui: parseInt(presentsResult.rows[0].total) || 0
        });
      }
    );
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API fonctionnelle' });
});

// ==================== DÉMARRAGE ====================
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});

process.on('SIGINT', () => {
  console.log('🔴 Arrêt du serveur...');
  pool.end();
  process.exit(0);
});



// ROUTE TEMPORAIRE - À SUPPRIMER APRÈS USAGE
app.delete('/api/clear-all-members', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE mouvements, membres RESTART IDENTITY CASCADE');
    res.json({ success: true, message: 'Tous les membres supprimés' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
})