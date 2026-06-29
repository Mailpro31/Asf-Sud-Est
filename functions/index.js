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

/**
 * Supprime les artefacts de stockage d'un fichier (objet Storage natif OU
 * fragments Firestore) puis le document `files/{id}` lui-même. Réplique côté
 * serveur la logique de `src/lib/fileTransfer.ts#deleteFileArtifacts`.
 */
async function deleteExpiredFile(bucket, docSnap) {
  const data = docSnap.data() || {};
  const sp = data.storagePath;
  if (sp === 'firestore_fallback_chunked') {
    // Contenu base64 réparti dans la sous-collection `chunks`.
    const chunks = await docSnap.ref.collection('chunks').get();
    await Promise.all(chunks.docs.map((d) => d.ref.delete()));
  } else if (sp && sp !== 'firestore_fallback' && sp !== 'sandbox') {
    // Objet Storage natif (les modes 'firestore_fallback'/'sandbox' n'ont pas
    // d'objet Storage : le contenu est dans le document).
    try {
      await bucket.file(sp).delete();
    } catch (e) {
      if (e.code !== 404) console.error('Suppression Storage échouée:', sp, e);
    }
  }
  await docSnap.ref.delete();
}

/**
 * Suppression automatique (« autodestruction ») planifiée des fichiers et
 * dossiers arrivés à l'échéance (`expiresAt`) programmée par le gestionnaire
 * d'antenne. Contrairement au balayage côté client (qui ne s'exécute que si une
 * personne autorisée ouvre l'application), cette tâche serveur garantit la
 * suppression à la date, indépendamment de toute connexion.
 *
 * Un dossier expiré entraîne la suppression de tout son contenu (cascade).
 *
 * ⚠️ Nécessite le plan Firebase Blaze (Cloud Scheduler) et un déploiement
 * manuel : `firebase deploy --only functions`.
 */
exports.sweepExpiredDocuments = functions.pubsub
  .schedule('every 60 minutes')
  .timeZone('Europe/Paris')
  .onRun(async () => {
    const db = admin.firestore();
    const bucket = admin.storage().bucket();
    const now = Date.now();
    let nFiles = 0;
    let nFolders = 0;

    // 1) Fichiers arrivés à échéance (échéance individuelle).
    //    `expiresAt <= now` ignore d'office les documents sans échéance ou à
    //    `expiresAt: null` (types non comparables à un nombre dans Firestore).
    const expiredFiles = await db.collection('files').where('expiresAt', '<=', now).get();
    for (const docSnap of expiredFiles.docs) {
      try {
        await deleteExpiredFile(bucket, docSnap);
        nFiles++;
      } catch (e) {
        console.error('Suppression auto du fichier impossible:', docSnap.id, e);
      }
    }

    // 2) Dossiers arrivés à échéance : on supprime tout leur contenu, puis le
    //    dossier lui-même (cascade). Les fichiers déjà retirés à l'étape 1
    //    n'apparaissent plus dans la requête ci-dessous.
    const expiredFolders = await db.collection('folders').where('expiresAt', '<=', now).get();
    for (const folSnap of expiredFolders.docs) {
      try {
        const contained = await db.collection('files').where('folderId', '==', folSnap.id).get();
        for (const f of contained.docs) {
          try {
            await deleteExpiredFile(bucket, f);
            nFiles++;
          } catch (e) {
            console.error('Suppression auto du fichier (dossier expiré) impossible:', f.id, e);
          }
        }
        await folSnap.ref.delete();
        nFolders++;
      } catch (e) {
        console.error('Suppression auto du dossier impossible:', folSnap.id, e);
      }
    }

    console.log(`Balayage des échéances : ${nFiles} fichier(s) et ${nFolders} dossier(s) supprimé(s).`);
    return null;
  });
