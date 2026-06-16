/**
 * Source unique de vérité pour les statuts de soumission de dossiers.
 *
 * Centralise les libellés (français) et le style visuel afin que tous les
 * écrans (Dashboard, AdminPanel, modales…) affichent les statuts de manière
 * cohérente, plutôt que de redéfinir des `statusConfig` locaux.
 */

import type { SubmissionStatus } from '../types';

export interface StatusMeta {
  /** Libellé affiché à l'utilisateur (français). */
  label: string;
  /** Classe utilitaire pour la pastille colorée (point d'état). */
  dot: string;
  /** Classe du badge complet (à combiner avec `.badge`). */
  badge: string;
}

export const STATUS_META: Record<SubmissionStatus, StatusMeta> = {
  Pending: {
    label: 'En attente',
    dot: 'bg-status-pending',
    badge: 'badge-pending',
  },
  'Under review': {
    label: 'En révision',
    dot: 'bg-status-review',
    badge: 'badge-review',
  },
  Validated: {
    label: 'Validé',
    dot: 'bg-status-validated',
    badge: 'badge-validated',
  },
  Incomplete: {
    label: 'Incomplet',
    dot: 'bg-status-incomplete',
    badge: 'badge-incomplete',
  },
};

/** Ordre canonique des statuts (utile pour les filtres / onglets). */
export const STATUS_ORDER: SubmissionStatus[] = [
  'Pending',
  'Under review',
  'Validated',
  'Incomplete',
];

/** Métadonnées d'un statut, avec repli sécurisé sur « En attente ». */
export function getStatusMeta(status?: SubmissionStatus): StatusMeta {
  return (status && STATUS_META[status]) || STATUS_META.Pending;
}
