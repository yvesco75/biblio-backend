
# 📚 Système de Pointage - Bibliothèque Bénin Excellence

Système complet de gestion et de pointage pour la bibliothèque de Bénin Excellence, développé par le Club IA.

![React](https://img.shields.io/badge/React-19.2.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Latest-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 🎯 Fonctionnalités

### Pour les utilisateurs
- ✅ Pointage rapide par numéro de téléphone
- 🔍 Recherche intelligente avec suggestions en temps réel
- 📱 Interface intuitive et responsive
- 🟢 Enregistrement automatique entrées/sorties

### Pour les administrateurs
- 👥 Gestion complète des membres
- ➕ Ajout individuel de membres
- 📤 Import en masse (Excel/CSV)
- 📥 Export des données (membres et mouvements)
- 📊 Dashboard avec statistiques en temps réel
- 🟢 Vue des personnes présentes
- 📋 Historique complet des mouvements

### Pour les super-administrateurs
- 👑 Gestion des comptes administrateurs
- 🔒 Modification sécurisée des mots de passe
- 🛡️ Contrôle d'accès avancé

## 🏗️ Architecture

```
├── Frontend (React)
│   ├── Interface de pointage
│   ├── Panneau d'administration
│   └── Panneau super-admin
│
└── Backend (Node.js + Express)
    ├── API RESTful
    ├── Authentification JWT
    └── Base de données PostgreSQL
```

## 🚀 Installation

### Prérequis

- Node.js >= 18.0.0
- PostgreSQL (ou compte sur Render/Neon)
- npm ou yarn

### Backend

1. **Cloner le repository**
```bash
git clone <votre-repo>
cd backend
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configuration environnement**

Créer un fichier `.env` à la racine :

```env
# Base de données
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# JWT Secret (à changer en production)
JWT_SECRET=votre_secret_super_securise_2025

# Port (optionnel)
PORT=5000
```

4. **Initialiser la base de données**
```bash
npm run init-db
```

Cette commande crée automatiquement :
- Les tables nécessaires (membres, mouvements, admins)
- Les comptes administrateurs par défaut

5. **Démarrer le serveur**
```bash
# Mode production
npm start

# Mode développement (avec auto-reload)
npm run dev
```

Le serveur démarre sur `http://localhost:5000`

### Frontend

1. **Aller dans le dossier frontend**
```bash
cd frontend
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configuration environnement**

Créer un fichier `.env` :

```env
REACT_APP_API_URL=https://votre-backend.onrender.com/api
```

Pour le développement local :
```env
REACT_APP_API_URL=http://localhost:5000/api
```

4. **Démarrer l'application**
```bash
# Mode développement
npm start

# Build pour production
npm run build
```

L'application démarre sur `http://localhost:3000`

## 🔐 Comptes par défaut

Après l'initialisation, deux comptes sont créés :

### Super Administrateur
- **Identifiant** : `superadmin`
- **Mot de passe** : `SuperAdmin2025!`
- **Permissions** : Accès total + gestion des admins

### Administrateur
- **Identifiant** : `admin`
- **Mot de passe** : `admin123`
- **Permissions** : Gestion membres et pointages

> ⚠️ **Important** : Changez ces mots de passe immédiatement en production !

## 📖 Guide d'utilisation

### Pointage (Interface publique)

1. Entrer les 3 premiers chiffres du numéro de téléphone
2. Sélectionner son nom dans la liste des suggestions
3. Le système enregistre automatiquement l'entrée ou la sortie

### Administration

#### Ajouter un membre
1. Aller dans l'onglet "Ajouter Membre"
2. Remplir le formulaire (nom, prénom, téléphone, catégorie)
3. Cliquer sur "Enregistrer"

#### Import en masse
1. Aller dans "Import Excel/CSV"
2. Préparer un fichier avec les colonnes : `nom`, `prenom`, `telephone`, `lien`
3. Cliquer sur "Choisir un fichier" et sélectionner votre fichier
4. L'import se lance automatiquement

**Format du fichier :**

| nom    | prenom | telephone | lien      |
|--------|--------|-----------|-----------|
| KPOTIN | Jean   | 97123456  | Étudiant  |
| AGBO   | Marie  | 96654321  | Élève     |

**Catégories valides :** Étudiant, Élève, Professionnel

#### Exporter les données
- Cliquer sur "Exporter Excel" dans l'onglet "Liste Membres" ou "Historique"
- Un fichier Excel est téléchargé automatiquement

### Super Administration

#### Créer un administrateur
1. Aller dans "Gestion Admins"
2. Remplir le formulaire (nom d'utilisateur, mot de passe)
3. Cliquer sur "Ajouter Admin"

#### Changer son mot de passe
1. Aller dans "Changer mon mot de passe"
2. Entrer l'ancien mot de passe
3. Entrer deux fois le nouveau mot de passe
4. Valider

## 🛠️ API Endpoints

### Authentification
```
POST   /api/login                    # Connexion
POST   /api/change-password          # Changer mot de passe (protégé)
```

### Membres
```
GET    /api/search-membres/:tel      # Recherche par téléphone (public)
POST   /api/pointer-by-id            # Enregistrer un pointage (public)
GET    /api/membres                  # Liste des membres (protégé)
POST   /api/membres                  # Ajouter un membre (protégé)
DELETE /api/membres/:id              # Désactiver un membre (protégé)
POST   /api/import                   # Import Excel/CSV (protégé)
GET    /api/export/membres           # Export Excel membres (protégé)
```

### Mouvements
```
GET    /api/mouvements               # Historique (protégé)
GET    /api/presents                 # Personnes présentes (protégé)
GET    /api/export/mouvements        # Export Excel mouvements (protégé)
```

### Administration
```
GET    /api/admins                   # Liste admins (super-admin)
POST   /api/admins                   # Créer admin (super-admin)
DELETE /api/admins/:id               # Supprimer admin (super-admin)
```

### Stats & Health
```
GET    /api/stats                    # Statistiques (protégé)
GET    /api/health                   # État du serveur (public)
```

## 📊 Structure de la base de données

### Table `membres`
```sql
id              SERIAL PRIMARY KEY
nom             TEXT NOT NULL
prenom          TEXT NOT NULL
telephone       TEXT NOT NULL
lien            TEXT DEFAULT 'Étudiant'
date_inscription TIMESTAMP DEFAULT CURRENT_TIMESTAMP
statut          TEXT DEFAULT 'actif'
```

### Table `mouvements`
```sql
id              SERIAL PRIMARY KEY
membre_id       INTEGER REFERENCES membres(id)
type            TEXT NOT NULL (entrée/sortie)
date_heure      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### Table `admins`
```sql
id              SERIAL PRIMARY KEY
username        TEXT UNIQUE NOT NULL
password        TEXT NOT NULL (bcrypt)
role            TEXT NOT NULL (admin/superadmin)
date_creation   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

## 🚢 Déploiement

### Backend (Render)

1. Créer un compte sur [Render](https://render.com)
2. Créer un nouveau "Web Service"
3. Connecter votre repository GitHub
4. Configuration :
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Environment Variables** : Ajouter `DATABASE_URL` et `JWT_SECRET`
5. Déployer

### Base de données (Render PostgreSQL)

1. Dans Render, créer une "PostgreSQL Database"
2. Copier l'URL de connexion interne
3. L'ajouter comme variable d'environnement `DATABASE_URL` dans le Web Service

### Frontend (Vercel)

1. Créer un compte sur [Vercel](https://vercel.com)
2. Importer votre repository
3. Configuration :
   - **Framework Preset** : Create React App
   - **Root Directory** : `frontend`
   - **Environment Variables** : Ajouter `REACT_APP_API_URL`
4. Déployer

## 🔧 Technologies utilisées

### Frontend
- **React** 19.2.0 - Framework JavaScript
- **Axios** - Client HTTP
- **XLSX** - Gestion des fichiers Excel
- **File-saver** - Téléchargement de fichiers

### Backend
- **Node.js** - Runtime JavaScript
- **Express** - Framework web
- **PostgreSQL (pg)** - Base de données
- **JWT (jsonwebtoken)** - Authentification
- **Bcrypt** - Hashage des mots de passe
- **Multer** - Upload de fichiers
- **XLSX** - Import/Export Excel
- **CORS** - Gestion des requêtes cross-origin

## 📝 Scripts disponibles

### Backend
```bash
npm start          # Démarrer le serveur
npm run dev        # Mode développement (nodemon)
npm run init-db    # Initialiser la base de données
```

### Frontend
```bash
npm start          # Démarrer en développement
npm run build      # Build pour production
npm test           # Lancer les tests
```

## 🐛 Dépannage

### Erreur de connexion à la base de données
- Vérifier que `DATABASE_URL` est correctement configuré
- Vérifier que PostgreSQL est accessible
- Vérifier les credentials de connexion

### Erreur CORS
- Vérifier que le backend autorise l'origine du frontend
- Vérifier la configuration CORS dans `server.js`

### Import Excel échoue
- Vérifier le format du fichier (colonnes : nom, prenom, telephone, lien)
- Vérifier que le fichier ne dépasse pas 5MB
- Vérifier que les numéros de téléphone ont au moins 8 chiffres

### Token invalide
- Se déconnecter et se reconnecter
- Vérifier que `JWT_SECRET` est identique entre les environnements
- Vérifier que le token n'a pas expiré (durée : 24h)

## 🤝 Contribution

Les contributions sont les bienvenues ! Pour contribuer :

1. Fork le projet
2. Créer une branche (`git checkout -b feature/amelioration`)
3. Commit vos changements (`git commit -m 'Ajout nouvelle fonctionnalité'`)
4. Push vers la branche (`git push origin feature/amelioration`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 👥 Auteurs

**Club IA - Bénin Excellence**

Pour toute question ou support, contactez l'équipe du Club IA.

## 🙏 Remerciements

- Bénin Excellence pour le projet
- L'équipe du Club IA pour le développement
- Tous les contributeurs

---

Développé avec ❤️ par le Club IA - Bénin Excellence
