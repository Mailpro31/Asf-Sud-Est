/**
 * Panneau « Checklist de conformité » : liste des pièces réglementaires
 * attendues avec leur état (manquante / en attente / validée) et un anneau
 * de complétude. Utilisé côté organisme (savoir quoi déposer) et côté
 * coordinateur (voir ce qui manque).
 */

import React from 'react';
import { CheckCircle2, Clock, Circle, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { computeChecklist } from '../../lib/requiredDocuments';
import type { DossierFile } from '../../types';
import { ComplianceRing } from './ComplianceRing';

export interface ChecklistPanelProps {
  files: DossierFile[];
  className?: string;
  /** Réduit les marges pour un affichage en colonne étroite (ex. modale). */
  compact?: boolean;
}

export function ChecklistPanel({ files, className, compact }: ChecklistPanelProps) {
  const { entries, validatedCount, total, percent } = computeChecklist(files);

  return (
    <div className={cn('card-asf', compact ? 'p-4' : 'p-5', className)}>
      <div className="flex items-center gap-3 mb-3">
        <ComplianceRing validated={validatedCount} total={total} size={compact ? 44 : 52} />
        <div className="min-w-0">
          <h3 className="font-display text-deep dark:text-white font-bold tracking-tight text-sm">
            Pièces réglementaires
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {validatedCount}/{total} validée{validatedCount > 1 ? 's' : ''} · {percent}% de complétude
          </p>
        </div>
      </div>

      <ul className="space-y-1.5">
        {entries.map(({ item, state, count }) => {
          const tone =
            state === 'validated' ? 'text-emerald-600'
              : state === 'incomplete' ? 'text-rose-600'
                : state === 'pending' ? 'text-amber-600'
                  : 'text-slate-400';
          const Icon =
            state === 'validated' ? CheckCircle2
              : state === 'incomplete' ? AlertCircle
                : state === 'pending' ? Clock
                  : Circle;
          const badge =
            state === 'validated' ? 'Validé'
              : state === 'incomplete' ? 'À corriger'
                : state === 'pending' ? 'En attente'
                  : 'Manquant';
          return (
            <li
              key={item.id}
              className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40"
              title={item.description}
            >
              <Icon className={cn('w-4 h-4 shrink-0', tone)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{item.label}</p>
                {!compact && <p className="text-[11px] text-slate-400 truncate">{item.description}</p>}
              </div>
              <span className={cn('text-[10px] font-bold uppercase tracking-wider shrink-0', tone)}>
                {badge}{count > 1 ? ` ·${count}` : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ChecklistPanel;
