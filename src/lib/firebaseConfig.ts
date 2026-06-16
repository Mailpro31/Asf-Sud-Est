import rawConfig from '../../firebase-applet-config.json';

/**
 * Source unique de la configuration Firebase.
 *
 * Priorité aux variables d'environnement `VITE_FIREBASE_*` (définies par ex.
 * dans Vercel ou dans `.env.local`), avec repli sur `firebase-applet-config.json`
 * (le projet de test fourni par défaut). Cela permet de pointer l'application
 * vers un vrai projet Firebase de production sans modifier le code.
 */
export interface FirebaseAppConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

const env = ((import.meta as any).env || {}) as Record<string, string | undefined>;
const fallback = rawConfig as Partial<FirebaseAppConfig> & { firestoreDatabaseId?: string };

/** Renvoie la variable d'environnement si renseignée, sinon la valeur de repli. */
function pick(envKey: string, fallbackVal: string | undefined): string {
  const v = env[envKey];
  return v && v.trim() !== '' ? v : (fallbackVal || '');
}

export const firebaseConfig: FirebaseAppConfig = {
  apiKey: pick('VITE_FIREBASE_API_KEY', fallback.apiKey),
  authDomain: pick('VITE_FIREBASE_AUTH_DOMAIN', fallback.authDomain),
  projectId: pick('VITE_FIREBASE_PROJECT_ID', fallback.projectId),
  storageBucket: pick('VITE_FIREBASE_STORAGE_BUCKET', fallback.storageBucket),
  messagingSenderId: pick('VITE_FIREBASE_MESSAGING_SENDER_ID', fallback.messagingSenderId),
  appId: pick('VITE_FIREBASE_APP_ID', fallback.appId),
  measurementId: pick('VITE_FIREBASE_MEASUREMENT_ID', fallback.measurementId),
};

/**
 * Identifiant de la base Firestore. Pour un projet de production standard,
 * il s'agit de `(default)`. On accepte un override via `VITE_FIRESTORE_DATABASE_ID`
 * ou la valeur héritée du JSON (base nommée AI Studio).
 */
export const firestoreDatabaseId: string =
  pick('VITE_FIRESTORE_DATABASE_ID', fallback.firestoreDatabaseId) || '(default)';

/**
 * Vrai lorsque l'application tourne sur le projet de test géré par Google AI
 * Studio (`asf013`), où Firebase Storage est verrouillé et où l'app retombe
 * sur la sauvegarde locale (sandbox).
 */
export const isManagedSandboxProject: boolean = firebaseConfig.projectId === 'asf013';

/** Vrai lorsque la configuration provient des variables d'environnement (vrai projet). */
export const usingEnvConfig: boolean =
  !!(env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_PROJECT_ID.trim() !== '');
