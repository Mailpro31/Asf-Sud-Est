import {
  addDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { localDb } from './localDb';

/**
 * Journal d'activité (audit log).
 *
 * Toute action traçable de l'application (connexion, dépôt/suppression de
 * fichier, création de dossier, changement de statut/rôle, suspension, etc.)
 * est enregistrée dans la collection `audit_logs`.
 *
 * Lecture :
 *  - super admin : voit TOUS les logs.
 *  - gestionnaire d'antenne : voit uniquement les logs de SON antenne
 *    (filtrés par `antenne_id`).
 *
 * Les écritures sont volontairement « best-effort » : un échec de
 * journalisation ne doit jamais bloquer l'action métier de l'utilisateur.
 */

export type AuditAction =
  | 'login'
  | 'logout'
  | 'file_upload'
  | 'file_delete'
  | 'file_status_change'
  | 'file_share_toggle'
  | 'file_rename'
  | 'folder_create'
  | 'folder_delete'
  | 'org_create'
  | 'org_delete'
  | 'org_role_change'
  | 'org_status_change'
  | 'org_assign_antenne'
  | 'org_profile_update'
  | 'antenne_create'
  | 'antenne_delete'
  | 'antenne_settings_change';

export interface AuditActor {
  uid: string;
  name: string;
  role: string;
  delegation_id?: string;
  antenne_id?: string;
}

export interface AuditLog {
  id: string;
  timestamp: number;
  actorUid: string;
  actorName: string;
  actorRole: string;
  action: AuditAction | string;
  targetType?: string | null;
  targetId?: string | null;
  targetName?: string | null;
  delegation_id?: string;
  antenne_id?: string;
  details?: string | null;
}

export interface LogOptions {
  targetType?: string;
  targetId?: string;
  targetName?: string;
  /** Force la délégation du log (sinon : celle de l'acteur). */
  delegation_id?: string;
  /** Force l'antenne du log (sinon : celle de l'acteur). Détermine quel
   *  gestionnaire d'antenne verra ce log. */
  antenne_id?: string;
  details?: string;
  /** Acteur explicite ; sinon l'acteur courant mémorisé par le contexte Auth. */
  actor?: AuditActor | null;
}

const LS_KEY = 'asf_local_audit_logs';

/**
 * Acteur courant, mis à jour par le contexte d'authentification. Permet
 * d'appeler `logAction(...)` partout sans avoir à transmettre l'acteur.
 */
let currentActor: AuditActor | null = null;
export function setCurrentActor(a: AuditActor | null) {
  currentActor = a;
}
export function getCurrentActor(): AuditActor | null {
  return currentActor;
}

/** Enregistre une action dans le journal. Échec silencieux (non bloquant). */
export async function logAction(action: AuditAction, opts: LogOptions = {}): Promise<void> {
  try {
    const actor = opts.actor || currentActor;
    if (!actor || !actor.uid) return; // impossible d'attribuer l'action

    const entry = {
      timestamp: Date.now(),
      actorUid: actor.uid,
      actorName: actor.name || actor.uid,
      actorRole: actor.role || 'organization',
      action,
      targetType: opts.targetType ?? null,
      targetId: opts.targetId ?? null,
      targetName: opts.targetName ?? null,
      delegation_id: opts.delegation_id ?? actor.delegation_id ?? '',
      antenne_id: opts.antenne_id ?? actor.antenne_id ?? '',
      details: opts.details ?? null,
    };

    if (localDb.isSandboxActive()) {
      localDb.saveAuditLog({
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ...entry,
      } as AuditLog);
      return;
    }
    await addDoc(collection(db, 'audit_logs'), entry);
  } catch (err) {
    console.warn('logAction échec (non bloquant) :', err);
  }
}

/**
 * Abonnement temps réel au journal.
 *  - `antenneId` fourni → logs de cette antenne (vue gestionnaire d'antenne).
 *  - `antenneId` absent → tous les logs (vue super admin / siège).
 */
export function subscribeAuditLogs(
  scope: { antenneId?: string | null },
  cb: (logs: AuditLog[]) => void,
  max = 500,
): () => void {
  const antenneId = scope.antenneId || null;
  const field: 'antenne_id' | null = antenneId ? 'antenne_id' : null;
  const value = antenneId;

  if (localDb.isSandboxActive()) {
    const load = () => {
      let logs = localDb.getAuditLogs();
      if (field && value) logs = logs.filter((l) => (l as any)[field] === value);
      logs.sort((a, b) => b.timestamp - a.timestamp);
      cb(logs.slice(0, max));
    };
    load();
    window.addEventListener('localdb-update', load);
    return () => window.removeEventListener('localdb-update', load);
  }

  try {
    if (field && value) {
      const coll = collection(db, 'audit_logs');
      const emit = (snap: any) => {
        const list: AuditLog[] = [];
        snap.forEach((d: any) => list.push({ id: d.id, ...d.data() } as AuditLog));
        list.sort((a, b) => b.timestamp - a.timestamp);
        cb(list.slice(0, max));
      };
      // Requête triée côté serveur (newest-first, bornée à `max`). Si l'index
      // composite (<champ>, timestamp desc) n'est pas encore déployé, on bascule
      // sur une requête sans `orderBy` triée côté client — la vue fonctionne
      // dans les deux cas.
      let inner = () => {};
      inner = onSnapshot(
        query(coll, where(field, '==', value), orderBy('timestamp', 'desc'), limit(max)),
        emit,
        (err) => {
          console.warn('subscribeAuditLogs : repli sans tri serveur (index manquant ?) :', err);
          inner = onSnapshot(
            query(coll, where(field, '==', value), limit(1000)),
            emit,
            (e2) => {
              console.warn('subscribeAuditLogs échec :', e2);
              cb([]);
            },
          );
        },
      );
      return () => inner();
    }

    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(max));
    return onSnapshot(
      q,
      (snap) => {
        const list: AuditLog[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as AuditLog));
        cb(list);
      },
      (err) => {
        console.warn('subscribeAuditLogs (global) échec :', err);
        cb([]);
      },
    );
  } catch (e) {
    console.warn('subscribeAuditLogs exception :', e);
    cb([]);
    return () => {};
  }
}
