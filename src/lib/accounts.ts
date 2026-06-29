import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { localDb } from './localDb';

/**
 * Suppression définitive d'un compte (authentification + données).
 *
 * S'appuie sur la Cloud Function `deleteUserAccount`, seule capable de supprimer
 * le compte Firebase Auth (le client ne le peut pas) et d'effacer les données
 * côté serveur de façon fiable. Autorisée pour un administrateur (n'importe quel
 * compte) ou pour le titulaire lui-même (auto-suppression).
 *
 * En mode sandbox (stockage local), la suppression est effectuée localement.
 */
export interface DeleteAccountResult {
  success: boolean;
  uid: string;
  files?: number;
  folders?: number;
}

export async function deleteUserAccount(uid: string): Promise<DeleteAccountResult> {
  if (localDb.isSandboxActive()) {
    localDb.getFiles().filter((f) => f.orgId === uid).forEach((f) => localDb.deleteFile(f.id));
    localDb.getFolders().filter((f) => f.orgId === uid).forEach((f) => localDb.deleteFolder(f.id));
    localDb.deleteOrganization(uid);
    return { success: true, uid };
  }
  const call = httpsCallable<{ uid: string }, DeleteAccountResult>(functions, 'deleteUserAccount');
  const res = await call({ uid });
  return res.data;
}
