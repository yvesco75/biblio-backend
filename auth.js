const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET_KEY = process.env.JWT_SECRET || 'biblio_secret_2025_change_me';

// Utiliser la même base de données que server.js
const db = require('./database');

// Middleware pour vérifier le token
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(403).json({ error: 'Token manquant' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Erreur vérification token:', error);
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

// Middleware pour vérifier si c'est un super admin
function verifySuperAdmin(req, res, next) {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Accès refusé. Super admin requis.' });
  }
  next();
}

// Vérifier les identifiants et générer un token
function login(username, password, callback) {
  if (!username || !password) {
    return callback(null);
  }

  db.get(
    'SELECT * FROM admins WHERE username = ?',
    [username],
    (err, admin) => {
      if (err) {
        console.error('Erreur recherche admin:', err);
        return callback(null);
      }

      if (!admin) {
        console.log('Admin non trouvé:', username);
        return callback(null);
      }

      bcrypt.compare(password, admin.password, (err, isMatch) => {
        if (err) {
          console.error('Erreur comparaison mot de passe:', err);
          return callback(null);
        }

        if (!isMatch) {
          console.log('Mot de passe incorrect pour:', username);
          return callback(null);
        }

        const token = jwt.sign(
          { 
            id: admin.id,
            username: admin.username,
            role: admin.role 
          },
          SECRET_KEY,
          { expiresIn: '24h' }
        );

        console.log('✅ Connexion réussie:', username, '- Rôle:', admin.role);

        callback({ 
          token, 
          role: admin.role, 
          username: admin.username 
        });
      });
    }
  );
}

// Changer le mot de passe
function changePassword(userId, oldPassword, newPassword, callback) {
  if (!userId || !oldPassword || !newPassword) {
    return callback(false, 'Paramètres manquants');
  }

  db.get(
    'SELECT password FROM admins WHERE id = ?',
    [userId],
    (err, admin) => {
      if (err) {
        console.error('Erreur recherche admin:', err);
        return callback(false, 'Erreur serveur');
      }

      if (!admin) {
        return callback(false, 'Admin introuvable');
      }

      bcrypt.compare(oldPassword, admin.password, (err, isMatch) => {
        if (err) {
          console.error('Erreur comparaison mot de passe:', err);
          return callback(false, 'Erreur serveur');
        }

        if (!isMatch) {
          return callback(false, 'Ancien mot de passe incorrect');
        }

        const hashedPassword = bcrypt.hashSync(newPassword, 10);

        db.run(
          'UPDATE admins SET password = ? WHERE id = ?',
          [hashedPassword, userId],
          (err) => {
            if (err) {
              console.error('Erreur mise à jour mot de passe:', err);
              return callback(false, 'Erreur mise à jour');
            }
            
            console.log('✅ Mot de passe changé pour user ID:', userId);
            callback(true, 'Mot de passe changé avec succès');
          }
        );
      });
    }
  );
}

module.exports = { 
  verifyToken, 
  verifySuperAdmin, 
  login, 
  changePassword,
  db // Exporter db pour les routes super admin
};