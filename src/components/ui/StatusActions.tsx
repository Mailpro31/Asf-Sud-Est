/**
 * Contrôle de validation UNIQUE, partagé par tous les dashboards.
 *
 * Remplace les 5 contrôles divergents (selects, menus, paires d'icônes…) par un
 * seul segment premium « Valider / Refuser » :
 *  - Validé  → bouton vert actif
 *  - Refusé  → bouton rouge actif
 *  - En attente → aucun des deux actif (re-cliquer un bouton actif y revient)
 *
 * Un bouton « note » optionnel (motif transmis au partenaire) peut être affiché.
 */

import { Check, X, MessageSquare } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { SubmissionStatus } from '../../types';

export interface StatusActionsProps {
  status?: SubmissionStatus;
  /** Appelé avec le nouveau statut (Validated / Incomplete / Pending). */
  onChange: (status: SubmissionStatus) => void;
  /** Si fourni, affiche un bouton « note » (motif pour le partenaire). */
  onAddNote?: () => void;
  /** Met en évidence le bouton note quand une note existe déjà. */
  hasNote?: boolean;
  /** Icônes seules (rangées denses : tableaux, modales). */
  compact?: boolean;
  className?: string;
  /** Désactive l'interaction (lecture seule). */
  disabled?: boolean;
}

/** Segment de validation premium, identique sur tous les dashboards. */
export function StatusActions({
  status,
  onChange,
  onAddNote,
  hasNote = false,
  compact = false,
  className,
  disabled = false,
}: StatusActionsProps) {
  const isValidated = status === 'Validated';
  const isRefused = status === 'Incomplete';

  // Re-cliquer l'état actif revient à « En attente » (annulation).
  const toggle = (target: SubmissionStatus) => {
    if (disabled) return;
    onChange(status === target ? 'Pending' : target);
  };

  const seg =
    'inline-flex items-center justify-center gap-1.5 font-bold rounded-full transition-all cursor-pointer disabled:cursor-not-allowed select-none';
  const pad = compact ? 'h-8 w-8' : 'h-8 px-3 text-xs';

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 shadow-3xs">
        <button
          type="button"
          onClick={() => toggle('Validated')}
          disabled={disabled}
          aria-pressed={isValidated}
          aria-label="Valider la pièce"
          title="Valider la pièce"
          className={cn(
            seg,
            pad,
            isValidated
              ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
              : 'text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-slate-700/60',
          )}
        >
          <Check className={cn('shrink-0', compact ? 'w-4 h-4' : 'w-3.5 h-3.5', isValidated && 'stroke-[3]')} />
          {!compact && <span>Valider</span>}
        </button>
        <button
          type="button"
          onClick={() => toggle('Incomplete')}
          disabled={disabled}
          aria-pressed={isRefused}
          aria-label="Marquer la pièce à corriger"
          title="Marquer la pièce à corriger"
          className={cn(
            seg,
            pad,
            isRefused
              ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/30'
              : 'text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-slate-700/60',
          )}
        >
          <X className={cn('shrink-0', compact ? 'w-4 h-4' : 'w-3.5 h-3.5', isRefused && 'stroke-[3]')} />
          {!compact && <span>À corriger</span>}
        </button>
      </div>

      {onAddNote && (
        <button
          type="button"
          onClick={onAddNote}
          disabled={disabled}
          aria-label={hasNote ? 'Modifier le motif transmis au partenaire' : 'Ajouter un motif pour le partenaire'}
          title={hasNote ? 'Modifier le motif transmis au partenaire' : 'Ajouter un motif pour le partenaire'}
          className={cn(
            'inline-flex items-center justify-center w-8 h-8 rounded-full border transition-all cursor-pointer shrink-0',
            hasNote
              ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-300'
              : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-azur dark:hover:text-azur-pastel hover:border-azur/40',
          )}
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default StatusActions;
