/**
 * Puces de filtre rapide par statut (« Tous » + un statut par puce).
 * Composant « sans style » : la logique (ordre des statuts, libellés, pastille,
 * compteurs) est partagée, mais chaque écran fournit ses classes via `chipClass`
 * pour conserver son apparence propre.
 */

import React from 'react';
import { cn } from '../../lib/utils';
import { STATUS_ORDER, getStatusMeta } from '../../lib/status';
import type { SubmissionStatus } from '../../types';

export type StatusFilterValue = 'all' | SubmissionStatus;

export interface StatusFilterChipsProps {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
  /** Compteurs optionnels par statut (clé 'all' + chaque statut). */
  counts?: Partial<Record<StatusFilterValue, number>>;
  /** Libellé de la puce « tous » (défaut : « Tous statuts »). */
  allLabel?: string;
  /** Classe de chaque puce selon son état actif. */
  chipClass: (active: boolean) => string;
  /** Affiche la pastille de couleur du statut (défaut : true). */
  showDot?: boolean;
  /** Conserve la couleur de la pastille même quand la puce est active
   *  (à activer quand la puce active a un fond clair). Défaut : false (pastille blanche). */
  keepDotColorWhenActive?: boolean;
  className?: string;
}

export function StatusFilterChips({
  value,
  onChange,
  counts,
  allLabel = 'Tous statuts',
  chipClass,
  showDot = true,
  keepDotColorWhenActive = false,
  className,
}: StatusFilterChipsProps) {
  const countOf = (k: StatusFilterValue) => (counts ? ` (${counts[k] ?? 0})` : '');
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <button type="button" onClick={() => onChange('all')} className={chipClass(value === 'all')}>
        {allLabel}{countOf('all')}
      </button>
      {STATUS_ORDER.map((s) => {
        const meta = getStatusMeta(s);
        const active = value === s;
        return (
          <button key={s} type="button" onClick={() => onChange(s)} title={meta.label} className={chipClass(active)}>
            {showDot && <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle', active && !keepDotColorWhenActive ? 'bg-white' : meta.dot)} />}
            {meta.label}{countOf(s)}
          </button>
        );
      })}
    </div>
  );
}

export default StatusFilterChips;
