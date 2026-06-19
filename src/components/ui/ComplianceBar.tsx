/**
 * Barre de conformité : proportion de documents validés sur le total.
 *
 * Couleur adaptative (rouge → ambre → vert) pour repérer en un coup d'œil
 * les organismes dont le dossier est complet. Utilisée dans les cartes
 * organisme (espace antenne) et le panneau super admin.
 */

import React from 'react';
import { cn } from '../../lib/utils';

export interface ComplianceBarProps {
  validated: number;
  total: number;
  /** Affiche le pourcentage et le ratio au-dessus de la barre (défaut : true). */
  showLabel?: boolean;
  className?: string;
}

export function ComplianceBar({ validated, total, showLabel = true, className }: ComplianceBarProps) {
  const pct = total > 0 ? Math.round((validated / total) * 100) : 0;
  const tone =
    total === 0 ? 'bg-slate-300'
      : pct >= 100 ? 'bg-emerald-500'
        : pct >= 50 ? 'bg-amber-500'
          : 'bg-rose-500';
  const textTone =
    total === 0 ? 'text-slate-400'
      : pct >= 100 ? 'text-emerald-600'
        : pct >= 50 ? 'text-amber-600'
          : 'text-rose-600';

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Conformité</span>
          <span className={cn('text-[11px] font-bold', textTone)}>
            {total === 0 ? '—' : `${pct}%`} <span className="text-slate-400 font-medium">({validated}/{total})</span>
          </span>
        </div>
      )}
      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', tone)}
          style={{ width: `${total === 0 ? 0 : pct}%` }}
        />
      </div>
    </div>
  );
}

export default ComplianceBar;
