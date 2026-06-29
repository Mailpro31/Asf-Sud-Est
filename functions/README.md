# Cloud Functions — rôle administrateur sécurisé

Ces fonctions attribuent un **Custom Claim** `admin: true` côté serveur, utilisé
par `firestore.rules` et `storage.rules` (`request.auth.token.admin`). Cela
évite de décider du rôle administrateur côté client (faille d'escalade de
privilèges).

## Contenu

- `setAdminClaimOnCreate` : à la création d'un compte, pose `admin: true` si
  l'email figure dans `ADMIN_EMAILS`.
- `setUserRole` : fonction appelable, réservée aux admins, pour promouvoir /
  rétrograder un compte.
- `sweepExpiredDocuments` : tâche **planifiée** (toutes les heures) qui supprime
  automatiquement les fichiers et dossiers arrivés à leur date d'échéance
  (`expiresAt`), ainsi que leurs fichiers dans le Storage. Garantit la
  suppression à la date **sans dépendre d'une connexion** (contrairement au
  balayage côté client). Un dossier expiré entraîne la suppression de son
  contenu (cascade).

## Déploiement

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

## Important

- La tâche planifiée `sweepExpiredDocuments` requiert le **plan Blaze**
  (paiement à l'usage) car elle utilise Cloud Scheduler. Le coût réel est
  négligeable (une exécution par heure, quelques lectures). Sans déploiement de
  cette fonction, la suppression automatique reste assurée *au mieux* côté
  client (uniquement quand une personne autorisée ouvre l'application).
- Adaptez `ADMIN_EMAILS` dans `index.js` (ou branchez-la sur Firestore).
- Pour appliquer le claim à un admin **déjà existant**, soit recréez son compte,
  soit appelez `setUserRole({ uid, admin: true })` depuis un compte admin, soit
  posez le claim manuellement via le SDK Admin.
- Après changement de claim, l'utilisateur doit rafraîchir son token
  (`getIdToken(true)` ou reconnexion) pour que les règles le voient.
