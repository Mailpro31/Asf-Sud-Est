/**
 * Persistance de l'état « visite guidée déjà vue » sur le compte.
 *
 * Stocké sur le document organisation (et non en localStorage) afin que la
 * visite ne se lance qu'une seule fois — à la toute première connexion —
 * et ne réapparaisse pas à chaque rechargement de page ni sur un autre appareil.
 */

import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { localDb } from './localDb';

export async function markTourSeen(orgId?: string): Promise<void> {
  if (!orgId) return;
  try {
    if (localDb.isSandboxActive()) {
      const org = localDb.getOrganizations().find((o) => o.id === orgId);
      if (org) localDb.saveOrganization({ ...org, hasSeenTour: true, updatedAt: Date.now() });
      return;
    }
    await setDoc(doc(db, 'organizations', orgId), { hasSeenTour: true, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.warn('Could not persist tour-seen flag', e);
  }
}
