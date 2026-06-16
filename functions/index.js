/**
 * Cloud Functions — attribution sécurisée du rôle administrateur.
 *
 * Ces fonctions définissent un Custom Claim `admin: true` côté serveur,
 * exploité par firestore.rules et storage.rules (request.auth.token.admin).
 * Objectif : ne plus décider du rôle admin côté client.
 *
 * Déploiement : firebase deploy --only functions
 */
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();

// Emails autorisés à recevoir le rôle administrateur.
// Adaptez cette liste (ou branchez-la sur une collection Firestore).
const ADMIN_EMAILS = ['mailprosasha2@gmail.com'];

/**
 * À la création d'un compte, attribue le claim admin si l'email est autorisé.
 */
exports.setAdminClaimOnCreate = functions.auth.user().onCreate(async (user) => {
  const email = (user.email || '').toLowerCase();
  if (ADMIN_EMAILS.includes(email)) {
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    console.log(`Custom claim admin=true attribué à ${email}`);
  }
});

/**
 * Fonction appelable réservée aux admins pour promouvoir/rétrograder un compte.
 * Appel côté client : httpsCallable(functions, 'setUserRole')({ uid, admin: true }).
 */
exports.setUserRole = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Seul un administrateur peut modifier les rôles.'
    );
  }
  const { uid, admin: isAdmin } = data || {};
  if (typeof uid !== 'string' || typeof isAdmin !== 'boolean') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Paramètres attendus : { uid: string, admin: boolean }.'
    );
  }
  await admin.auth().setCustomUserClaims(uid, { admin: isAdmin });
  return { success: true, uid, admin: isAdmin };
});
