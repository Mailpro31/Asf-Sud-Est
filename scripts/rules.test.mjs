/**
 * Tests des règles Firestore (scénarios 3 et 4 de la checklist) exécutés contre
 * l'émulateur Firestore, en chargeant le vrai fichier firestore.rules.
 *
 * Lancement : firebase emulators:exec --only firestore --project demo-asf-rules \
 *               "node scripts/rules.test.mjs"
 */
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import {
  doc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-asf-rules';
const VALIDATED_UID = 'partner-validated';
const PENDING_UID = 'partner-pending';
const ANT = 'ant1';
const DEL = 'france';

let passed = 0;
let failed = 0;
async function check(name, promise) {
  try {
    await promise;
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}\n     ${e.message || e}`);
    failed++;
  }
}

const validFile = (overrides = {}) => ({
  orgId: VALIDATED_UID,
  name: 'attestation.pdf',
  size: 12345,
  type: 'application/pdf',
  storagePath: `dossiers/${VALIDATED_UID}/attestation.pdf`,
  uploadDate: Date.now(),
  delegation_id: DEL,
  antenne_id: ANT,
  submissionStatus: 'Pending',
  folderId: null,
  uploadedBy: 'user',
  ...overrides,
});

const validFolder = (overrides = {}) => ({
  orgId: VALIDATED_UID,
  name: 'Documents réglementaires',
  createdAt: Date.now(),
  createdBy: 'user',
  delegation_id: DEL,
  antenne_id: ANT,
  ...overrides,
});

const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: {
    rules: readFileSync('firestore.rules', 'utf8'),
    host: '127.0.0.1',
    port: 8080,
  },
});

// --- Seed : profils + un dossier/fichier existants (règles désactivées) ---
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'organizations', VALIDATED_UID), {
    name: 'Aéroclub Sud-Est', email: 'club@example.org', contactName: 'Jean Air',
    role: 'organization', submissionStatus: 'Validated',
    delegation_id: DEL, antenne_id: ANT, createdAt: Date.now(),
  });
  await setDoc(doc(db, 'organizations', PENDING_UID), {
    name: 'Nouveau Club', email: 'new@example.org', contactName: 'Marie Vol',
    role: 'organization', submissionStatus: 'Pending',
    delegation_id: DEL, antenne_id: ANT, createdAt: Date.now(),
  });
  // dossier + fichier existants appartenant au partenaire validé
  await setDoc(doc(db, 'folders', 'folder1'), validFolder());
  await setDoc(doc(db, 'files', 'file1'), validFile());
});

const validated = testEnv.authenticatedContext(VALIDATED_UID).firestore();
const pending = testEnv.authenticatedContext(PENDING_UID).firestore();

console.log('\n=== Scénario 3 : partenaire VALIDÉ ===');
await check(
  'peut déposer un fichier',
  assertSucceeds(setDoc(doc(validated, 'files', 'newfile'), validFile())),
);
await check(
  'peut créer un dossier',
  assertSucceeds(setDoc(doc(validated, 'folders', 'newfolder'), validFolder())),
);
await check(
  'peut renommer son dossier (name + updatedAt)',
  assertSucceeds(updateDoc(doc(validated, 'folders', 'folder1'), { name: 'Renommé', updatedAt: Date.now() })),
);
await check(
  'peut renommer son fichier (name + updatedAt)',
  assertSucceeds(updateDoc(doc(validated, 'files', 'file1'), { name: 'renomme.pdf', updatedAt: Date.now() })),
);
await check(
  'peut déplacer son fichier dans un dossier (folderId)',
  assertSucceeds(updateDoc(doc(validated, 'files', 'file1'), { folderId: 'folder1' })),
);
await check(
  'NE peut PAS déposer un fichier au nom d\'un autre orgId',
  assertFails(setDoc(doc(validated, 'files', 'spoof'), validFile({ orgId: 'someone-else' }))),
);

console.log('\n=== Scénario 4 : compte EN ATTENTE (Pending) ===');
await check(
  'NE peut PAS déposer de fichier',
  assertFails(setDoc(doc(pending, 'files', 'pendingfile'), validFile({ orgId: PENDING_UID, storagePath: `dossiers/${PENDING_UID}/x.pdf` }))),
);
await check(
  'NE peut PAS lire le profil d\'un autre partenaire',
  assertFails(import('firebase/firestore').then(({ getDoc }) => getDoc(doc(pending, 'organizations', VALIDATED_UID)))),
);

await testEnv.cleanup();
console.log(`\n=== Résultat : ${passed} réussis, ${failed} échoués ===`);
process.exit(failed === 0 ? 0 : 1);
