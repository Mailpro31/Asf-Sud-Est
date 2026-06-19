/**
 * Lance la visite guidée une seule fois, à la TOUTE première connexion du
 * compte. L'état « déjà vue » est persisté sur le profil (markTourSeen), donc
 * pas de relance au rechargement. Le `start` est lu via une ref pour qu'il
 * reflète l'état courant au moment où le minuteur se déclenche.
 */

import { useEffect, useRef } from 'react';
import { markTourSeen, hasSeenTourLocal } from '../lib/tour';
import type { Organization } from '../types';

export function useFirstRunTour(organization: Organization | null, start: () => void) {
  const triggered = useRef(false);
  const startRef = useRef(start);
  startRef.current = start;

  useEffect(() => {
    if (triggered.current || !organization) return;
    triggered.current = true;
    // Déjà vue ? (profil OU localStorage — résilient même si l'écriture
    // Firestore du flag est refusée par les règles).
    if (organization.hasSeenTour || hasSeenTourLocal(organization.id)) return;
    markTourSeen(organization.id);
    const t = setTimeout(() => startRef.current(), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);
}
