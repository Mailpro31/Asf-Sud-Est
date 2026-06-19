/**
 * Persistance de l'état « visite guidée déjà vue ».
 *
 * Double persistance volontaire :
 *  - localStorage (par compte) : fiable et immédiat, indépendant des règles
 *    Firestore — garantit qu'on ne relance pas la visite à chaque rechargement ;
 *  - document organisation (`hasSeenTour`) : partagé entre appareils.
 */

import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { localDb } from './localDb';

const lsKey = (orgId: string) => `asf_tour_seen_${orgId}`;

export function hasSeenTourLocal(orgId?: string): boolean {
  if (!orgId) return false;
  try {
    return localStorage.getItem(lsKey(orgId)) === '1';
  } catch {
    return false;
  }
}

export async function markTourSeen(orgId?: string): Promise<void> {
  if (!orgId) return;
  // 1) localStorage : immédiat et toujours possible.
  try {
    localStorage.setItem(lsKey(orgId), '1');
  } catch {
    /* stockage indisponible : on tente quand même Firestore */
  }
  // 2) Profil (best-effort) : non bloquant si les règles refusent l'écriture.
  try {
    if (localDb.isSandboxActive()) {
      const org = localDb.getOrganizations().find((o) => o.id === orgId);
      if (org) localDb.saveOrganization({ ...org, hasSeenTour: true, updatedAt: Date.now() });
      return;
    }
    await setDoc(doc(db, 'organizations', orgId), { hasSeenTour: true, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.warn('Could not persist tour-seen flag to Firestore (non-blocking)', e);
  }
}
