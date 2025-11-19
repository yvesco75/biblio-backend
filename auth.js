const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('./database');

const SECRET_KEY = process.env.JWT_SECRET || 'biblio_secret_2025_change_me';

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

function verifySuperAdmin(req, res, next) {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Accès refusé. Super admin requis.' });
  }
  next();
}

function login(username, password, callback) {
  if (!username || !password) {
    return callback(null);
  }

  pool.query(
    'SELECT * FROM admins WHERE username = $1',
    [username],
    (err, result) => {
      if (err) {
        console.error('Erreur recherche admin:', err);
        return callback(null);
      }

      if (result.rows.length === 0) {
        console.log('Admin non trouvé:', username);
        return callback(null);
      }

      const admin = result.rows[0];

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

function changePassword(userId, oldPassword, newPassword, callback) {
  if (!userId || !oldPassword || !newPassword) {
    return callback(false, 'Paramètres manquants');
  }

  pool.query(
    'SELECT password FROM admins WHERE id = $1',
    [userId],
    (err, result) => {
      if (err) {
        console.error('Erreur recherche admin:', err);
        return callback(false, 'Erreur serveur');
      }

      if (result.rows.length === 0) {
        return callback(false, 'Admin introuvable');
      }

      const admin = result.rows[0];

      bcrypt.compare(oldPassword, admin.password, (err, isMatch) => {
        if (err) {
          console.error('Erreur comparaison mot de passe:', err);
          return callback(false, 'Erreur serveur');
        }

        if (!isMatch) {
          return callback(false, 'Ancien mot de passe incorrect');
        }

        const hashedPassword = bcrypt.hashSync(newPassword, 10);

        pool.query(
          'UPDATE admins SET password = $1 WHERE id = $2',
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
  pool
};