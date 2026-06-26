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

// Du plus calme (échéance lointaine) au plus alarmant (échéance dépassée) :
// scheduled → upcoming → soon → critical → expired. La couleur « chauffe » à
// mesure que la date approche.
export type ExpiryTone = 'expired' | 'critical' | 'soon' | 'upcoming' | 'scheduled';

/** Informations d'affichage pour un badge de suppression programmée. */
export function expiryInfo(ts: number | null | undefined, now: number = Date.now()):
  | { tone: ExpiryTone; label: string; date: string; days: number }
  | null {
  if (typeof ts !== 'number' || ts <= 0) return null;
  const days = daysUntil(ts, now);
  const date = formatExpiryDate(ts);
  if (days <= 0) return { tone: 'expired', label: 'Suppression imminente', date, days };
  if (days === 1) return { tone: 'critical', label: 'Suppression demain', date, days };
  if (days <= 2) return { tone: 'critical', label: `Suppression dans ${days} jours`, date, days };
  if (days <= 7) return { tone: 'soon', label: `Suppression dans ${days} jours`, date, days };
  if (days <= 30) return { tone: 'upcoming', label: `Suppression le ${date}`, date, days };
  return { tone: 'scheduled', label: `Suppression le ${date}`, date, days };
}

/** Classes Tailwind par palier d'urgence (badge + pastille + icône seule).
 *  Une seule source de vérité pour un rendu identique partout. */
export const EXPIRY_STYLES: Record<ExpiryTone, { badge: string; dot: string; icon: string; pulse: boolean }> = {
  expired: {
    badge: 'bg-rose-600 text-white border-rose-600 dark:bg-rose-600 dark:text-white dark:border-rose-500 shadow-sm shadow-rose-500/30',
    dot: 'bg-white',
    icon: 'text-rose-600 dark:text-rose-400',
    pulse: true,
  },
  critical: {
    badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/40',
    dot: 'bg-rose-500',
    icon: 'text-rose-500 dark:text-rose-400',
    pulse: true,
  },
  soon: {
    badge: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/40',
    dot: 'bg-orange-500',
    icon: 'text-orange-500 dark:text-orange-400',
    pulse: false,
  },
  upcoming: {
    badge: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    dot: 'bg-amber-500',
    icon: 'text-amber-600 dark:text-amber-300',
    pulse: false,
  },
  scheduled: {
    badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
    icon: 'text-slate-500 dark:text-slate-400',
    pulse: false,
  },
};

/** Couleur de l'icône « horloge » seule selon l'urgence (pour les endroits
 *  où l'on ne peut pas afficher le badge complet, ex. la barre latérale). */
export function expiryIconClass(ts: number | null | undefined, now: number = Date.now()): string {
  const info = expiryInfo(ts, now);
  return info ? EXPIRY_STYLES[info.tone].icon : '';
}

/** Formate une date en `YYYY-MM-DD` dans le fuseau LOCAL (et non UTC), pour
 *  rester cohérent avec `<input type="date">` qui raisonne en date locale et
 *  avec `expiryInputToTs` qui interprète la valeur en heure locale. Utiliser
 *  `toISOString()` (UTC) ici décalerait la date d'un jour dans les fuseaux à
 *  décalage négatif (ex. Antilles, Guyane). */
function toLocalDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Date minimale sélectionnable (demain) pour un sélecteur `<input type="date">`. */
export function minExpiryDateInput(now: number = Date.now()): string {
  return toLocalDateInput(new Date(now + DAY_MS));
}

/** Convertit une valeur `<input type="date">` (YYYY-MM-DD) en timestamp à
 *  23 h 59 de la journée choisie (le fichier vit jusqu'à la fin du jour J). */
export function expiryInputToTs(value: string): number | null {
  if (!value) return null;
  const d = new Date(`${value}T23:59:59`);
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

/** Valeur `<input type="date">` (YYYY-MM-DD) à partir d'un timestamp.
 *  Inverse exact de `expiryInputToTs` (même fuseau local). */
export function tsToExpiryInput(ts: number | null | undefined): string {
  if (typeof ts !== 'number' || ts <= 0) return '';
  return toLocalDateInput(new Date(ts));
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
 * contient.
 *
 * Garde-fou anti-orphelin : un dossier n'est supprimé que si la session peut
 * supprimer TOUS les fichiers qu'il contient ET qu'ils l'ont effectivement été.
 * Sinon le dossier est laissé intact (un balayage avec plus de droits —
 * gestionnaire d'antenne ou super admin, sans filtre — s'en chargera), ce qui
 * évite de laisser une pièce avec un `folderId` pointant vers un dossier
 * supprimé (invisible mais jamais re-balayée).
 *
 * Best-effort : les échecs (droits, réseau, doc déjà supprimé par un autre
 * poste) sont ignorés silencieusement. Renvoie le nombre d'éléments supprimés.
 */
export async function sweepExpired(opts: SweepOptions): Promise<{ files: number; folders: number }> {
  const { files, folders, sandbox, canDeleteFile, canDeleteFolder, onDeleted } = opts;
  const now = Date.now();
  let nFiles = 0;
  let nFolders = 0;

  const canFile = (f: DossierFile) => (canDeleteFile ? canDeleteFile(f) : true);
  const canFol = (f: Folder) => (canDeleteFolder ? canDeleteFolder(f) : true);

  // Dossiers expirés « videables » : supprimables par la session ET dont
  // chaque fichier contenu est lui aussi supprimable par la session.
  const clearableFolders = folders.filter(
    (fol) =>
      isExpired(fol.expiresAt, now) &&
      canFol(fol) &&
      files.filter((f) => f.folderId === fol.id).every(canFile),
  );
  const clearableFolderIds = new Set(clearableFolders.map((f) => f.id));

  const filesToDelete = files.filter(
    (f) =>
      (isExpired(f.expiresAt, now) || (f.folderId != null && clearableFolderIds.has(f.folderId))) &&
      canFile(f),
  );

  if (sandbox) {
    for (const f of filesToDelete) {
      localDb.deleteFile(f.id);
      onDeleted?.('file', f);
      nFiles++;
    }
    for (const fol of clearableFolders) {
      // localDb.deleteFolder supprime aussi les fichiers rattachés ; comme le
      // dossier est « videable », ils sont tous légitimement supprimables.
      localDb.deleteFolder(fol.id);
      onDeleted?.('folder', fol);
      nFolders++;
    }
    return { files: nFiles, folders: nFolders };
  }

  // Fichiers d'abord (artefacts de stockage + document), puis dossiers.
  const deletedFileIds = new Set<string>();
  for (const f of filesToDelete) {
    try {
      await deleteFileArtifacts(f);
      await deleteDoc(doc(db, 'files', f.id));
      deletedFileIds.add(f.id);
      onDeleted?.('file', f);
      nFiles++;
    } catch (e) {
      console.warn('Suppression auto du fichier impossible:', f.id, e);
    }
  }
  for (const fol of clearableFolders) {
    // On ne retire le dossier que si tous ses fichiers ont bien été supprimés,
    // sinon on laisserait une pièce orpheline (folderId mort).
    const allGone = files.filter((f) => f.folderId === fol.id).every((f) => deletedFileIds.has(f.id));
    if (!allGone) continue;
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
