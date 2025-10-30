const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./database'); // Utilise le même système que server.js

const SECRET_KEY = process.env.JWT_SECRET || 'biblio_secret_2025_change_me';

// Middleware pour vérifier le token
function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(403).json({ error: 'Token manquant' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalide' });
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
  db.get(
    'SELECT * FROM admins WHERE username = ?',
    [username],
    (err, admin) => {
      if (err || !admin) {
        return callback(null);
      }

      bcrypt.compare(password, admin.password, (err, isMatch) => {
        if (err || !isMatch) {
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

        callback({ token, role: admin.role, username: admin.username });
      });
    }
  );
}

// Changer le mot de passe
function changePassword(userId, oldPassword, newPassword, callback) {
  db.get(
    'SELECT password FROM admins WHERE id = ?',
    [userId],
    (err, admin) => {
      if (err || !admin) {
        return callback(false, 'Admin introuvable');
      }

      bcrypt.compare(oldPassword, admin.password, (err, isMatch) => {
        if (err || !isMatch) {
          return callback(false, 'Ancien mot de passe incorrect');
        }

        const hashedPassword = bcrypt.hashSync(newPassword, 10);

        db.run(
          'UPDATE admins SET password = ? WHERE id = ?',
          [hashedPassword, userId],
          (err) => {
            if (err) {
              return callback(false, 'Erreur mise à jour');
            }
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
  db 
};