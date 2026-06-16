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

## Déploiement

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

## Important

- Adaptez `ADMIN_EMAILS` dans `index.js` (ou branchez-la sur Firestore).
- Pour appliquer le claim à un admin **déjà existant**, soit recréez son compte,
  soit appelez `setUserRole({ uid, admin: true })` depuis un compte admin, soit
  posez le claim manuellement via le SDK Admin.
- Après changement de claim, l'utilisateur doit rafraîchir son token
  (`getIdToken(true)` ou reconnexion) pour que les règles le voient.
