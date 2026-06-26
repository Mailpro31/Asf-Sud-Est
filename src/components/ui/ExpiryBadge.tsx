import type { MouseEvent } from 'react';
import { CalendarClock } from 'lucide-react';
import { expiryInfo, EXPIRY_STYLES } from '../../lib/expiry';

export interface ExpiryBadgeProps {
  /** Timestamp d'échéance (ms). Le badge ne s'affiche pas s'il est absent. */
  ts?: number | null;
  /** Classe(s) supplémentaire(s) (marges…). */
  className?: string;
  /** Rend le badge cliquable (curseur + handler). */
  onClick?: (e: MouseEvent) => void;
}

/**
 * Pastille « suppression automatique programmée ». La couleur chauffe à mesure
 * que la date approche (gris → ambre → orange → rouge), et clignote une fois
 * l'échéance imminente. Rendu unique réutilisé côté antenne et côté partenaire.
 */
export function ExpiryBadge({ ts, className = '', onClick }: ExpiryBadgeProps) {
  const info = expiryInfo(ts);
  if (!info) return null;
  const s = EXPIRY_STYLES[info.tone];
  return (
    <span
      onClick={onClick}
      title={`Suppression automatique le ${info.date}`}
      className={`inline-flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-full text-[10px] font-bold border leading-none ${s.badge} ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {s.pulse && <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${s.dot}`} />}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${s.dot}`} />
      </span>
      <CalendarClock className="w-3 h-3 shrink-0" />
      <span className="truncate">{info.label}</span>
    </span>
  );
}
