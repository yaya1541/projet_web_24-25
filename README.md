# KartFever

**KartFever** est un jeu de course de karts multijoueur en 3D, développé avec **Three.js** pour les graphismes et **CANNON.js** pour la physique réaliste. Inspiré des meilleurs jeux de course, il offre une expérience compétitive avec une interface moderne, une authentification sécurisée et des interactions en temps réel. Le projet utilise une architecture client-serveur robuste, avec un pipeline CI/CD pour assurer la qualité du code.

---

## Table des matières

1. [Présentation](#présentation)
2. [Fonctionnalités](#fonctionnalités)
3. [Architecture](#architecture)
4. [Installation](#installation)
5. [Utilisation](#utilisation)
6. [Captures d'écran et vidéos](#captures-décran-et-vidéos)
7. [Contribution](#contribution)
8. [Licence](#licence)
9. [Crédits](#crédits)

---

## Présentation

KartFever est un jeu de course multijoueur où les joueurs s'affrontent en temps réel sur des circuits dynamiques. Le front-end, basé sur Three.js et CANNON.js, gère les graphismes et la physique locale, tandis que le back-end, construit avec Deno et Oak, assure la gestion des utilisateurs, des parties et des communications en temps réel via WebSocket. Le projet est déployé sur des serveurs séparés pour le front-end et le back-end, avec une sécurité renforcée (HTTPS, JWT, mots de passe hachés) et un pipeline CI/CD.

---

## Fonctionnalités

- **Courses multijoueurs** : Affrontez d'autres joueurs en temps réel avec une physique fluide.
- **Communication en temps réel** [Obsolete] : Synchronisation des positions et des classements via WebSocket.
- **Authentification sécurisée** : Connexion/inscription avec JWT et mots de passe hachés (bcrypt).
- **Base de données** : MySQL avec 6 tables pour gérer utilisateurs, rôles, messages, paramètres, jetons et images.
- **API REST** : Opérations CRUD pour les données du jeu et des utilisateurs.
- **Espace admin** : Accès restreint pour les administrateurs, sécurisé par middleware.
- **Pipeline CI/CD** : Tests automatisés, formatage et linting via GitHub Actions.
- **Interface moderne** : Design responsive avec des polices Google Fonts (Montserrat, Russo One).
- **Actualités GitHub** : Page affichant les derniers commits du dépôt.

---

## Architecture

KartFever utilise une architecture **client-serveur** :

- **Front-end** : Three.js pour le rendu 3D, CANNON.js pour la physique et JavaScript pour la logique. Les pages incluent l'accueil, la connexion, l'inscription, le jeu et les actualités.
- **Back-end** : Deno avec Oak pour les routes API, MySQL pour les données et WebSocket pour la synchronisation en temps réel. La physique côté serveur garantit un état de jeu fiable.
- **Sécurité** : HTTPS avec certificats auto-signés, JWT pour l'authentification, et protection contre les failles OWASP (injections, authentification cassée).
- **Déploiement** : Serveurs séparés pour le front-end et le back-end, avec gestion des CORS.

---

## Installation

1. **Prérequis** :
   - Deno (v2.x ou supérieur)
   - Serveur MySQL
   - Git

2. **Cloner le dépôt** :
   Naviguez vers le répertoire du projet et clonez le dépôt depuis GitHub.

3. **Configurer les variables d'environnement** :
   Créez un fichier `.env` dans `back_server/` avec les informations de connexion MySQL, l'URL du serveur et la clé JWT.

4. **Initialiser la base de données** :
   Exécutez la fonction d'initialisation dans le back-end pour créer les tables et ajouter des données par défaut.

5. **Lancer le back-end** :
   Exécutez le fichier principal du serveur back-end avec Deno.

6. **Lancer le front-end** :
   Servez les fichiers statiques du front-end avec un serveur web simple (par exemple, Deno ou Node.js).

7. **Accéder au jeu** :
   Ouvrez l'URL du front-end dans un navigateur (par exemple, `https://yanisrasp.duckdns.org`).

---

## Utilisation

1. **Inscription/Connexion** : Créez un compte ou connectez-vous via les pages dédiées.
2. **Rejoindre une partie** : Entrez un code de jeu ou créez une nouvelle partie dans le lobby.
3. **Jouer** : Contrôlez votre kart avec les touches fléchées ou WASD, passez les checkpoints pour grimper dans le classement.
4. **Actualités** : Consultez les derniers commits du projet sur la page des actualités.
5. **Admin** : Les administrateurs peuvent accéder à des fonctionnalités réservées via des routes sécurisées.

---

## Captures d'écran et vidéos

- **Écran de connexion** : [Placeholder pour capture]
- **Lobby du jeu** : [Placeholder pour capture]
- **Course en cours** : [Placeholder pour capture]
- **Page des actualités** : [Placeholder pour capture]

*Vidéos* : Des démonstrations du gameplay et des fonctionnalités admin seront ajoutées prochainement.

---

## Contribution

Pour contribuer :
1. Forkez le dépôt.
2. Créez une branche pour votre fonctionnalité (`git checkout -b feature/votre-fonctionnalité`).
3. Effectuez vos modifications et validez-les avec des messages clairs.
4. Exécutez les vérifications de formatage et de linting.
5. Poussez vos changements et ouvrez une pull request vers la branche principale.

Le pipeline CI/CD vérifie automatiquement la qualité du code.

---

## Licence

Licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

Les modèles de karts sont sous licence CC-BY :
- Kart par Ben Harrison [CC-BY](https://creativecommons.org/licenses/by/3.0/) via [Poly Pizza](https://poly.pizza/m/bKDlM4mH7rg)
- Go Kart par Poly by Google [CC-BY](https://creativecommons.org/licenses/by/3.0/) via [Poly Pizza](https://poly.pizza/m/3hkutVs0AAV)

---

## Crédits

- **Développeur** : Yanis Niaussat
- **Actifs** : Ben Harrison, Poly by Google (via Poly Pizza)
- **Technologies** : Deno, Three.js, CANNON.js, MySQL, Oak, GitHub Actions
- **Polices** : Russo One, Montserrat (Google Fonts)
