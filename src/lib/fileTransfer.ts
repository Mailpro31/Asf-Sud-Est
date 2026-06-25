import { collection, getDocs, query, orderBy, deleteDoc } from 'firebase/firestore';
import { ref, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';
import { DossierFile } from '../types';

/**
 * Helpers partagés de transfert de fichiers (lecture, téléchargement,
 * nettoyage du stockage). Centralise une logique qui était auparavant dupliquée
 * dans Dashboard, AdminPanel et AntenneAdminDashboard — un correctif appliqué
 * ici profite désormais aux trois écrans.
 *
 * Modes de stockage possibles d'un fichier :
 *  - objet Storage natif  → `storagePath` = chemin Storage, `fallbackDataUrl` = URL https
 *  - 'firestore_fallback'         → contenu base64 dans `fallbackDataUrl`
 *  - 'firestore_fallback_chunked' → contenu base64 réparti dans la sous-collection `chunks`
 *  - 'sandbox'                    → contenu base64 local dans `fallbackDataUrl`
 */

/** Lit un fichier en data URL (base64). Rejette en cas d'erreur de lecture
 *  (sans `onerror`, une lecture échouée laisserait la promesse en suspens). */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error || new Error('Lecture du fichier impossible'));
    r.readAsDataURL(file);
  });
}

/** N'autorise que des schémas d'URL sûrs à être affichés/ouverts. Empêche qu'un
 *  document falsifié (champ `fallbackDataUrl` écrit directement en base avec
 *  `javascript:` / `vbscript:` …) ne devienne un vecteur XSS lors de l'aperçu
 *  (`<iframe src>`, `window.open`) ou du téléchargement. */
export function isSafeFileUrl(u: string | null | undefined): u is string {
  return !!u && /^(https?:|data:|blob:)/i.test(u.trim());
}

/** Résout une URL exploitable (https ou data:) pour un fichier, quel que soit
 *  son mode de stockage. Renvoie `null` si rien d'exploitable et sûr n'est
 *  disponible. */
export async function resolveFileUrl(file: DossierFile): Promise<string | null> {
  if (file.storagePath === 'firestore_fallback_chunked') {
    const snap = await getDocs(query(collection(db, 'files', file.id, 'chunks'), orderBy('index', 'asc')));
    const full = snap.docs.map((d) => (d.data() as any).data).join('');
    return isSafeFileUrl(full) ? full : null;
  }
  if (file.storagePath === 'firestore_fallback' || file.storagePath === 'sandbox') {
    return isSafeFileUrl(file.fallbackDataUrl) ? file.fallbackDataUrl : null;
  }
  // Stockage natif : URL déjà connue, sinon on la récupère depuis Storage.
  if (file.fallbackDataUrl && file.fallbackDataUrl.startsWith('http')) {
    return file.fallbackDataUrl;
  }
  if (file.storagePath) {
    return await getDownloadURL(ref(storage, file.storagePath));
  }
  return isSafeFileUrl(file.fallbackDataUrl) ? file.fallbackDataUrl : null;
}

/** Déclenche le téléchargement d'un fichier dans le navigateur.
 *  Renvoie `false` si aucun contenu n'est disponible. Peut lever (réseau). */
export async function downloadFile(file: DossierFile): Promise<boolean> {
  const url = await resolveFileUrl(file);
  if (!url) return false;
  if (url.startsWith('http')) {
    window.open(url, '_blank');
    return true;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}

/** Supprime les artefacts de stockage d'un fichier (objet Storage natif OU
 *  fragments Firestore). N'efface PAS le document `files/{id}` lui-même —
 *  l'appelant le fait après. Échec silencieux pour le stockage (best-effort). */
export async function deleteFileArtifacts(file: DossierFile): Promise<void> {
  if (file.storagePath === 'firestore_fallback_chunked') {
    try {
      const snap = await getDocs(collection(db, 'files', file.id, 'chunks'));
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    } catch (e) {
      console.error('Suppression des fragments échouée:', e);
    }
  } else if (file.storagePath && file.storagePath !== 'firestore_fallback' && file.storagePath !== 'sandbox') {
    try {
      await deleteObject(ref(storage, file.storagePath));
    } catch (e: any) {
      if (e?.code !== 'storage/object-not-found') console.error('Suppression Storage échouée:', e);
    }
  }
}
