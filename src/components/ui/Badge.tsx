/**
 * Badges du design system ASF.
 *
 * `StatusBadge` affiche un statut de dossier de manière cohérente partout,
 * en s'appuyant sur la source unique de vérité `STATUS_META`.
 */

import React from 'react';
import { cn } from '../../lib/utils';
import { getStatusMeta } from '../../lib/status';
import type { SubmissionStatus } from '../../types';

export interface BadgeProps {
  className?: string;
  children: React.ReactNode;
}

/** Badge générique (forme + typographie). Couleur via `className`. */
export function Badge({ className, children }: BadgeProps) {
  return <span className={cn('badge', className)}>{children}</span>;
}

export interface StatusBadgeProps {
  status?: SubmissionStatus;
  /** Affiche la pastille colorée avant le libellé (défaut : true). */
  withDot?: boolean;
  className?: string;
}

/** Badge de statut de dossier (En attente / En révision / Validé / Incomplet). */
export function StatusBadge({
  status,
  withDot = true,
  className,
}: StatusBadgeProps) {
  const meta = getStatusMeta(status);
  return (
    <span className={cn('badge', meta.badge, className)}>
      {withDot && (
        <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />
      )}
      {meta.label}
    </span>
  );
}

export default Badge;
