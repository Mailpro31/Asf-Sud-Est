import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { localDb } from './localDb';
import { AntenneInvite, Organization } from '../types';

/**
 * Gestion des gestionnaires d'antennes (rôle `admin_antenne`) par e-mail.
 *
 * Le super admin crée des « invitations » (`antenne_invites/{email}`) qui
 * rattachent un e-mail à une antenne. À la connexion du compte correspondant,
 * l'application l'élève automatiquement au rôle `admin_antenne` (voir
 * AuthContext). Si le compte existe déjà, on l'attribue aussi immédiatement.
 *
 * Tout fonctionne également en mode sandbox (stockage local) pour permettre les
 * tests sans backend Firestore.
 */

const LS_KEY = 'asf_antenne_invites';

export function inviteKey(email: string): string {
  return email.trim().toLowerCase();
}

// --- Stockage local (sandbox) ---
function readLocalInvites(): AntenneInvite[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as AntenneInvite[]) : [];
  } catch {
    return [];
  }
}

function writeLocalInvites(list: AntenneInvite[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('localdb-update'));
}

// --- Invitations ---

/** Crée ou met à jour l'invitation d'un e-mail vers une antenne. */
export async function upsertInvite(
  email: string,
  delegationId: string,
  antenneId: string,
): Promise<void> {
  const key = inviteKey(email);
  const data = {
    email: key,
    delegation_id: delegationId,
    antenne_id: antenneId,
    createdAt: Date.now(),
  };

  if (localDb.isSandboxActive()) {
    const list = readLocalInvites().filter((i) => i.id !== key);
    list.push({ id: key, ...data });
    writeLocalInvites(list);
    return;
  }
  await setDoc(doc(db, 'antenne_invites', key), data);
}

/** Supprime une invitation (par clé e-mail). */
export async function deleteInvite(key: string): Promise<void> {
  if (localDb.isSandboxActive()) {
    writeLocalInvites(readLocalInvites().filter((i) => i.id !== key));
    return;
  }
  await deleteDoc(doc(db, 'antenne_invites', key));
}

/** Récupère l'invitation correspondant à un e-mail (pour l'auto-attribution). */
export async function getMyInvite(emailLower: string): Promise<AntenneInvite | null> {
  if (!emailLower) return null;
  if (localDb.isSandboxActive()) {
    return readLocalInvites().find((i) => i.id === emailLower) || null;
  }
  try {
    const snap = await getDoc(doc(db, 'antenne_invites', emailLower));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: snap.id,
      email: d.email || snap.id,
      delegation_id: d.delegation_id || '',
      antenne_id: d.antenne_id || '',
      createdAt: d.createdAt || 0,
    };
  } catch {
    return null;
  }
}

/** Abonnement temps réel à toutes les invitations (super admin). */
export function subscribeInvites(cb: (list: AntenneInvite[]) => void): () => void {
  if (localDb.isSandboxActive()) {
    const load = () => cb(readLocalInvites());
    load();
    window.addEventListener('localdb-update', load);
    return () => window.removeEventListener('localdb-update', load);
  }
  try {
    return onSnapshot(
      collection(db, 'antenne_invites'),
      (snap) => {
        const list: AntenneInvite[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            email: data.email || d.id,
            delegation_id: data.delegation_id || '',
            antenne_id: data.antenne_id || '',
            createdAt: data.createdAt || 0,
          };
        });
        cb(list);
      },
      (err) => {
        console.warn('subscribeInvites failed, fallback to sandbox:', err);
        localDb.setSandboxActive(true);
        cb(readLocalInvites());
      },
    );
  } catch (e) {
    console.warn('subscribeInvites threw, fallback to sandbox:', e);
    localDb.setSandboxActive(true);
    cb(readLocalInvites());
    return () => {};
  }
}

// --- Attribution directe sur un compte existant ---

/** Promeut un compte existant au rôle gestionnaire d'une antenne. */
export async function assignOrgAsAntenneAdmin(
  org: Organization,
  delegationId: string,
  antenneId: string,
): Promise<void> {
  const patch = {
    role: 'admin_antenne' as const,
    delegation_id: delegationId,
    antenne_id: antenneId,
    updatedAt: Date.now(),
  };
  if (localDb.isSandboxActive()) {
    const target = localDb.getOrganizations().find((o) => o.id === org.id);
    if (target) {
      localDb.saveOrganization({ ...target, ...patch });
    }
    return;
  }
  await updateDoc(doc(db, 'organizations', org.id), patch);
}

/** Retire le rôle gestionnaire d'un compte (retour à « organization »). */
export async function revokeOrgAntenneAdmin(org: Organization): Promise<void> {
  const patch = { role: 'organization' as const, updatedAt: Date.now() };
  if (localDb.isSandboxActive()) {
    const target = localDb.getOrganizations().find((o) => o.id === org.id);
    if (target) {
      localDb.saveOrganization({ ...target, ...patch });
    }
    return;
  }
  await updateDoc(doc(db, 'organizations', org.id), patch);
}
