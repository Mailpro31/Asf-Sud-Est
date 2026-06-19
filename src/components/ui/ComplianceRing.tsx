/**
 * Anneau de conformité : même information que ComplianceBar (validés / total)
 * mais sous forme circulaire, pour les indicateurs « globaux » (KPI).
 *
 * Couleur adaptative (rouge → ambre → vert), cohérente avec ComplianceBar.
 */

import React from 'react';
import { cn } from '../../lib/utils';

export interface ComplianceRingProps {
  validated: number;
  total: number;
  /** Diamètre en pixels (défaut 64). */
  size?: number;
  className?: string;
}

export function ComplianceRing({ validated, total, size = 64, className }: ComplianceRingProps) {
  const pct = total > 0 ? Math.round((validated / total) * 100) : 0;
  const stroke =
    total === 0 ? '#cbd5e1'
      : pct >= 100 ? '#10b981'
        : pct >= 50 ? '#f59e0b'
          : '#f43f5e';
  const sw = 4;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <path
          d="M18 2.5a15.5 15.5 0 1 1 0 31 15.5 15.5 0 0 1 0-31"
          fill="none" stroke="#f1f5f9" strokeWidth={sw}
        />
        <path
          d="M18 2.5a15.5 15.5 0 1 1 0 31 15.5 15.5 0 0 1 0-31"
          fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${total === 0 ? 0 : pct} 100`}
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute font-display font-extrabold text-deep-dark" style={{ fontSize: size * 0.24 }}>
        {total === 0 ? '—' : `${pct}%`}
      </span>
    </div>
  );
}

export default ComplianceRing;
