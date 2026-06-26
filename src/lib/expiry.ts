import { doc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { deleteFileArtifacts } from './fileTransfer';
import { localDb } from './localDb';
import { DossierFile, Folder } from '../types';

/**
 * Suppression automatique (« autodestruction ») des fichiers et dossiers à une
 * date programmée par le gestionnaire d'antenne.
 *
 * Pourquoi côté client ? Le portail n'a pas de tâche planifiée serveur (pas de
 * Cloud Functions). À chaque chargement d'un tableau de bord, on balaie donc
 * les éléments arrivés à échéance et on supprime ceux que l'utilisateur courant
 * a le droit de supprimer (les règles Firestore tranchent en dernier ressort).
 * En complément, l'UI masque/bloque déjà tout élément expiré : même si la
 * suppression physique tarde (aucun admin connecté), le fichier sensible n'est
 * plus accessible.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Vrai si l'échéance est dépassée (suppression due). */
export function isExpired(ts: number | null | undefined, now: number = Date.now()): boolean {
  return typeof ts === 'number' && ts > 0 && ts <= now;
}

/** Nombre de jours entiers restants avant l'échéance (négatif si dépassée). */
export function daysUntil(ts: number, now: number = Date.now()): number {
  return Math.ceil((ts - now) / DAY_MS);
}

/** Date d'échéance en toutes lettres (ex. « 12 juillet 2026 »). */
export function formatExpiryDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export type ExpiryTone = 'expired' | 'soon' | 'scheduled';

/** Informations d'affichage pour un badge de suppression programmée. */
export function expiryInfo(ts: number | null | undefined, now: number = Date.now()):
  | { tone: ExpiryTone; label: string; date: string; days: number }
  | null {
  if (typeof ts !== 'number' || ts <= 0) return null;
  const days = daysUntil(ts, now);
  const date = formatExpiryDate(ts);
  if (days <= 0) return { tone: 'expired', label: 'Suppression imminente', date, days };
  if (days <= 7) return { tone: 'soon', label: `Suppression dans ${days} j`, date, days };
  return { tone: 'scheduled', label: `Suppression auto le ${date}`, date, days };
}

/** Date minimale sélectionnable (demain) pour un sélecteur `<input type="date">`. */
export function minExpiryDateInput(now: number = Date.now()): string {
  return new Date(now + DAY_MS).toISOString().slice(0, 10);
}

/** Convertit une valeur `<input type="date">` (YYYY-MM-DD) en timestamp à
 *  23 h 59 de la journée choisie (le fichier vit jusqu'à la fin du jour J). */
export function expiryInputToTs(value: string): number | null {
  if (!value) return null;
  const d = new Date(`${value}T23:59:59`);
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

/** Valeur `<input type="date">` (YYYY-MM-DD) à partir d'un timestamp. */
export function tsToExpiryInput(ts: number | null | undefined): string {
  if (typeof ts !== 'number' || ts <= 0) return '';
  return new Date(ts).toISOString().slice(0, 10);
}

interface SweepOptions {
  files: DossierFile[];
  folders: Folder[];
  sandbox: boolean;
  /** Filtre les fichiers réellement supprimables par l'utilisateur courant. */
  canDeleteFile?: (f: DossierFile) => boolean;
  /** Filtre les dossiers réellement supprimables par l'utilisateur courant. */
  canDeleteFolder?: (f: Folder) => boolean;
  /** Appelé pour chaque élément supprimé (journalisation, toasts…). */
  onDeleted?: (kind: 'file' | 'folder', item: DossierFile | Folder) => void;
}

/**
 * Supprime les fichiers et dossiers arrivés à échéance que l'utilisateur peut
 * supprimer. Un dossier expiré entraîne la suppression des fichiers qu'il
 * contient. Best-effort : les échecs (droits, réseau, doc déjà supprimé par un
 * autre poste) sont ignorés silencieusement. Renvoie le nombre d'éléments
 * effectivement supprimés.
 */
export async function sweepExpired(opts: SweepOptions): Promise<{ files: number; folders: number }> {
  const { files, folders, sandbox, canDeleteFile, canDeleteFolder, onDeleted } = opts;
  const now = Date.now();
  let nFiles = 0;
  let nFolders = 0;

  const expiredFolders = folders.filter(
    (f) => isExpired(f.expiresAt, now) && (canDeleteFolder ? canDeleteFolder(f) : true),
  );
  const expiredFolderIds = new Set(expiredFolders.map((f) => f.id));

  const filesToDelete = files.filter(
    (f) =>
      (isExpired(f.expiresAt, now) || (f.folderId != null && expiredFolderIds.has(f.folderId))) &&
      (canDeleteFile ? canDeleteFile(f) : true),
  );

  if (sandbox) {
    for (const f of filesToDelete) {
      localDb.deleteFile(f.id);
      onDeleted?.('file', f);
      nFiles++;
    }
    for (const fol of expiredFolders) {
      // localDb.deleteFolder supprime aussi les fichiers rattachés.
      localDb.deleteFolder(fol.id);
      onDeleted?.('folder', fol);
      nFolders++;
    }
    return { files: nFiles, folders: nFolders };
  }

  // Fichiers d'abord (artefacts de stockage + document), puis dossiers.
  for (const f of filesToDelete) {
    try {
      await deleteFileArtifacts(f);
      await deleteDoc(doc(db, 'files', f.id));
      onDeleted?.('file', f);
      nFiles++;
    } catch (e) {
      console.warn('Suppression auto du fichier impossible:', f.id, e);
    }
  }
  for (const fol of expiredFolders) {
    try {
      await deleteDoc(doc(db, 'folders', fol.id));
      onDeleted?.('folder', fol);
      nFolders++;
    } catch (e) {
      console.warn('Suppression auto du dossier impossible:', fol.id, e);
    }
  }

  return { files: nFiles, folders: nFolders };
}
