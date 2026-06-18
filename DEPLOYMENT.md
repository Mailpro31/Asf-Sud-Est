# Guide de déploiement — ASF Dossiers (Sud-Est)

Application **React 19 + Vite + Tailwind 4** (SPA statique) avec backend
**Firebase** (Authentication, Firestore, Storage). Une fois construite, l'app
est un ensemble de fichiers statiques dans `dist/` que l'on publie sur un
hébergeur. L'hébergeur recommandé est **Firebase Hosting** (cohérent avec le
backend Firebase déjà utilisé).

---

## 1. Prérequis

- **Node.js 22** (voir `.nvmrc`)
- **npm** (fourni avec Node)
- Un projet **Firebase** (ici `asf013`) avec Authentication, Firestore et
  Storage activés
- Pour le déploiement : le **Firebase CLI** (`npm i -g firebase-tools`)

---

## 2. Lancer en local

```bash
npm install
npm run dev        # http://localhost:3000
```

## 3. Variables d'environnement

Copier `.env.example` vers `.env.local` et renseigner les valeurs :

```bash
cp .env.example .env.local
```

| Variable            | Rôle                                                        | Requis     |
| ------------------- | ----------------------------------------------------------- | ---------- |
| `VITE_ADMIN_EMAIL`  | Email de l'utilisateur administrateur (injecté au build)    | Oui        |
| `GEMINI_API_KEY`    | Clé API Gemini (uniquement si l'IA est utilisée côté app)   | Optionnel  |
| `APP_URL`           | URL publique de l'app (liens auto-référents)                | Optionnel  |

> `.env.local` est **ignoré par git** (voir `.gitignore`) : aucun secret n'est
> committé. Pour le déploiement CI, ces valeurs sont fournies via des *secrets*
> GitHub (voir §6).

> **Note Firebase :** `firebase-applet-config.json` contient la configuration
> web Firebase (apiKey, projectId, …). Ces valeurs sont **publiques par
> conception** côté client — la sécurité repose sur les règles
> `firestore.rules` / `storage.rules`, pas sur le secret de ces clés.

## 4. Construire l'application

```bash
npm run lint       # vérification TypeScript
npm run build      # génère dist/
npm run preview    # prévisualise le build localement
```

---

## 5. Déploiement sur Firebase Hosting (manuel)

```bash
# 1. Se connecter (une seule fois)
firebase login

# 2. Sélectionner le projet (déjà défini dans .firebaserc -> asf013)
firebase use asf013

# 3. Construire + déployer le site
npm run deploy            # = build + firebase deploy --only hosting

# (optionnel) déployer aussi les règles Firestore/Storage
npm run deploy:rules

# (optionnel) tout déployer d'un coup
npm run deploy:full
```

L'app sera disponible sur :
`https://asf013.web.app` et `https://asf013.firebaseapp.com`.

---

## 6. Déploiement automatique (GitHub Actions) — recommandé

Deux workflows sont fournis dans `.github/workflows/` :

- **`firebase-hosting-deploy.yml`** : à chaque push sur `main`, construit et
  déploie en production (canal `live`).
- **`firebase-hosting-pr-preview.yml`** : pour chaque pull request, publie une
  URL de prévisualisation temporaire (canal `preview`, expire après 7 jours).

### Secrets GitHub à configurer

Dans le dépôt GitHub : **Settings → Secrets and variables → Actions → New repository secret**

| Secret                      | Contenu                                                                 |
| --------------------------- | ----------------------------------------------------------------------- |
| `FIREBASE_SERVICE_ACCOUNT`  | Le JSON complet d'un compte de service Firebase ayant le rôle Hosting   |
| `VITE_ADMIN_EMAIL`          | L'email administrateur (injecté au build)                               |

### Générer le compte de service

Le plus simple, via le Firebase CLI :

```bash
firebase init hosting:github
```

Cette commande crée le secret `FIREBASE_SERVICE_ACCOUNT` automatiquement.

Sinon, manuellement :

1. Console Google Cloud → **IAM & Admin → Service Accounts** (projet `asf013`)
2. Créer un compte de service avec le rôle **Firebase Hosting Admin**
   (+ **Cloud Datastore / Firebase Rules** si vous déployez aussi les règles)
3. Générer une **clé JSON**, copier son contenu intégral dans le secret
   `FIREBASE_SERVICE_ACCOUNT`

---

## 7. Hébergeurs alternatifs (Vercel / Netlify)

L'app est une SPA statique : n'importe quel hébergeur statique convient.

**Réglages communs :**

- **Build command :** `npm run build`
- **Output directory :** `dist`
- **Variable d'environnement :** `VITE_ADMIN_EMAIL`
- **Rewrite SPA :** rediriger toutes les routes vers `/index.html`

**Vercel** — créer un fichier `vercel.json` :

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

**Netlify** — créer un fichier `netlify.toml` :

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

> Si vous utilisez Vercel/Netlify, le backend reste **Firebase** : pensez à
> autoriser le domaine de l'hébergeur dans
> **Firebase Console → Authentication → Settings → Authorized domains**.

---

## 8. Règles de sécurité (Firestore & Storage)

Les règles vivent dans `firestore.rules` et `storage.rules` et sont déployées
indépendamment de l'hébergement front :

```bash
firebase deploy --only firestore:rules,storage
```

À déployer **avant** la première mise en production pour sécuriser les données.

---

## 9. Domaine personnalisé

Dans **Firebase Console → Hosting → Add custom domain**, suivre les
instructions DNS. Pensez ensuite à ajouter ce domaine dans
**Authentication → Authorized domains**.

---

## 10. Checklist de mise en production

- [ ] `npm run lint` et `npm run build` passent sans erreur
- [ ] `VITE_ADMIN_EMAIL` configuré (local + secret CI)
- [ ] Règles `firestore.rules` / `storage.rules` déployées
- [ ] Domaine de l'hébergeur autorisé dans Firebase Authentication
- [ ] Secret `FIREBASE_SERVICE_ACCOUNT` ajouté pour le déploiement automatique
- [ ] Test de connexion / upload sur l'URL de production

---

## 12. E-mails d'invitation des gestionnaires d'antennes

L'attribution d'une antenne à un e-mail (panneau super admin) **envoie
automatiquement un e-mail** d'invitation. L'envoi se fait via **EmailJS**
(envoi direct depuis le navigateur, **sans backend ni extension Firebase**).

### Méthode recommandée : EmailJS

**Installation (une fois, ~5 min) :**

1. Créer un compte gratuit sur **https://www.emailjs.com** (200 e-mails/mois).
2. **Email Services** → **Add New Service** → choisir **Gmail** → connecter votre
   compte (`mailprosasha2@gmail.com`). Noter le **Service ID** (`service_xxxxx`).
3. **Email Templates** → **Create New Template**. Dans le template :
   - **To Email** : `{{to_email}}`
   - **From Name** : `{{from_name}}`
   - **Subject** : `{{subject}}`
   - **Content** : passer l'éditeur en mode HTML (`<>`) et mettre `{{{message_html}}}`
     (triple accolades = HTML non échappé). En repli texte : `{{message}}`.
   - Sauvegarder et noter le **Template ID** (`template_xxxxx`).
4. **Account** → **General** → copier la **Public Key**.
5. Renseigner ces 3 valeurs dans les variables d'environnement (Vercel →
   *Project Settings → Environment Variables*, puis redéployer) :
   - `VITE_EMAILJS_SERVICE_ID`
   - `VITE_EMAILJS_TEMPLATE_ID`
   - `VITE_EMAILJS_PUBLIC_KEY`
6. (Sécurité, conseillé) Dans EmailJS → **Account → Security**, restreindre aux
   domaines autorisés (votre URL Vercel).

> La **Public Key** EmailJS est faite pour être exposée côté client : c'est sans
> danger. La restriction par domaine empêche son usage ailleurs.

### Repli sans EmailJS

Si les variables `VITE_EMAILJS_*` ne sont pas définies, l'application retombe sur
l'écriture dans la collection Firestore **`mail`** (extension Firebase
**« Trigger Email from Firestore »**) — uniquement si cette extension est
installée. Dans tous les cas, le bouton **« Copier l'invitation »** permet
d'envoyer le message manuellement. L'accès s'active à la première connexion de la
personne avec l'e-mail invité.

---

## 11. Dépannage — `auth/unauthorized-domain`

**Symptôme :** à la connexion (surtout via **« Connexion Google Workspace »**),
Firebase renvoie `Firebase: Error (auth/unauthorized-domain)`.

**Cause :** ce n'est **pas** un bug de l'application. Firebase n'autorise les
flux d'authentification que depuis une liste de **domaines autorisés**. Par
défaut, seuls `localhost` et les domaines `*.firebaseapp.com` / `*.web.app` du
projet le sont. Les domaines **Vercel / Netlify ne le sont pas**, et les URL
d'**aperçu** (preview) Vercel changent à chaque déploiement (hash aléatoire).

**Correction :**

1. Firebase Console → projet **`asf-sud-est-prod-524c1`**
2. **Authentication → Settings → Authorized domains → Add domain**
3. Ajouter :
   - le **domaine de production stable** de l'hébergeur
     (ex. `asf-sud-est.vercel.app` ou votre domaine personnalisé) ;
   - éventuellement `localhost` (déjà présent par défaut) pour les tests locaux.

> Les URL d'aperçu Vercel (`...-git-<branche>-<hash>-....vercel.app`) ne sont pas
> stables : testez l'authentification sur le **domaine de prod** plutôt que sur
> une preview, ou ajoutez ponctuellement l'URL de preview en cours.

> Rappel : la connexion **email / mot de passe** ne déclenche pas cette erreur ;
> seuls les flux OAuth (popup/redirect, ex. Google) vérifient le domaine.
