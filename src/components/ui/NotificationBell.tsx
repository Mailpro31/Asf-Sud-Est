/**
 * Cloche de notifications réutilisable, affichée dans l'en-tête de chaque
 * dashboard. Montre un compteur rouge et, au clic, un panneau listant les
 * notifications du moment avec une courte explication (quoi · où · quand).
 *
 * Le composant est « sans logique métier » : chaque dashboard calcule sa propre
 * liste d'items à partir de ses données et la passe en prop.
 */

import { useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export type NotifTone = 'info' | 'warning' | 'success' | 'danger';

export interface NotificationItem {
  id: string;
  /** Titre court (ex. « Nouveau document »). */
  title: string;
  /** Explication courte (ex. « Déposé par X — à valider »). */
  description: string;
  /** Horodatage (ms) pour l'ordre + « il y a … ». */
  ts?: number;
  tone?: NotifTone;
  /** Action au clic (ex. ouvrir l'élément, marquer comme vu). */
  onClick?: () => void;
}

const TONE: Record<NotifTone, { dot: string; ring: string }> = {
  info: { dot: 'bg-azur', ring: 'bg-azur/10 text-azur dark:text-azur-pastel' },
  warning: { dot: 'bg-amber-500', ring: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300' },
  success: { dot: 'bg-emerald-500', ring: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' },
  danger: { dot: 'bg-rose-500', ring: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300' },
};

function timeAgo(ts?: number): string {
  if (!ts) return '';
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

export function NotificationBell({
  items,
  className,
  title = 'Notifications',
}: {
  items: NotificationItem[];
  className?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const count = items.length;
  const sorted = [...items].sort((a, b) => (b.ts || 0) - (a.ts || 0));

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${count} notification${count > 1 ? 's' : ''}`}
        title={title}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-deep dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition-colors cursor-pointer"
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white dark:ring-slate-900 animate-pulse">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Click-away */}
          <div className="fixed inset-0 z-[9970]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-[320px] max-w-[90vw] z-[9971] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-left">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-sm font-black text-deep dark:text-slate-100 flex items-center gap-2">
                <Bell className="w-4 h-4 text-azur" /> Notifications
              </span>
              {count > 0 && (
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-2 py-0.5 rounded-full">
                  {count} en cours
                </span>
              )}
            </div>

            {count === 0 ? (
              <div className="px-4 py-8 text-center">
                <Check className="w-8 h-8 text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 p-1.5 rounded-full mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Tout est à jour</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Aucune notification pour le moment.</p>
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {sorted.map((n) => {
                  const tone = TONE[n.tone || 'info'];
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => { n.onClick?.(); setOpen(false); }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex gap-3 cursor-pointer"
                    >
                      <span className={cn('mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0', tone.ring)}>
                        <span className={cn('w-2 h-2 rounded-full', tone.dot)} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{n.title}</span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-2">{n.description}</span>
                        {n.ts ? <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">{timeAgo(n.ts)}</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default NotificationBell;
