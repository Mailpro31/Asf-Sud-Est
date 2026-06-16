# ASF Dossiers — Sud-Est

Portail documentaire sécurisé pour les autorisations de vol de l'**ASF Sud-Est**.

Application web **React 19 + Vite + Tailwind CSS 4** avec backend **Firebase**
(Authentication, Firestore, Storage).

## Démarrage rapide

**Prérequis :** Node.js 22 (voir `.nvmrc`)

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer l'environnement
cp .env.example .env.local      # puis renseigner VITE_ADMIN_EMAIL

# 3. Lancer en développement
npm run dev                     # http://localhost:3000
```

## Scripts disponibles

| Script                 | Description                                        |
| ---------------------- | ------------------------------------------------- |
| `npm run dev`          | Serveur de développement (port 3000)              |
| `npm run lint`         | Vérification TypeScript (`tsc --noEmit`)          |
| `npm run build`        | Build de production → `dist/`                     |
| `npm run preview`      | Prévisualise le build localement                  |
| `npm run deploy`       | Build + déploie sur Firebase Hosting              |
| `npm run deploy:rules` | Déploie les règles Firestore/Storage              |

## Déploiement

Le guide complet (Firebase Hosting, CI GitHub Actions, Vercel/Netlify, règles
de sécurité, domaine personnalisé) est dans **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

En bref :

```bash
firebase login
firebase use asf013
npm run deploy
```

Un push sur `main` déclenche aussi un **déploiement automatique** via GitHub
Actions (voir `.github/workflows/`).

## Structure

```
src/
  components/   Composants UI (Dashboard, AdminPanel, modales, formulaires…)
  context/      Contextes React (Auth, Theme)
  hooks/        Hooks personnalisés (useFeedback)
  lib/          Initialisation Firebase, base locale
  types.ts      Types partagés
firestore.rules / storage.rules   Règles de sécurité Firebase
firebase.json / .firebaserc       Configuration Firebase Hosting
```
