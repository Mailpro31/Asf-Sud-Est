/**
 * Fenêtre « Préférences d'affichage » — personnalisation par utilisateur,
 * accessible depuis l'en-tête de chaque dashboard via <PreferencesButton/>.
 *
 * Réunit trois réglages mémorisés dans le navigateur :
 *   - Thème (clair / sombre) — délégué à ThemeContext ;
 *   - Couleur d'accent des actions — PreferencesContext ;
 *   - Densité / taille de l'interface — PreferencesContext.
 */
import React, { useState } from 'react';
import { SlidersHorizontal, X, Check, Sun, Moon, Palette, Type, RotateCcw } from 'lucide-react';
import { usePreferences } from '../../context/PreferencesContext';
import { useTheme } from '../../context/ThemeContext';
import { ACCENTS, DENSITIES, type AccentKey, type DensityKey } from '../../lib/preferences';

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
      {icon}
      {children}
    </h4>
  );
}

export function PreferencesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { accent, density, setAccent, setDensity, reset } = usePreferences();
  const { mode, setMode } = useTheme();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
      <button aria-label="Fermer" className="absolute inset-0 bg-deep-dark/55 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-asf-lg border border-slate-200/70 dark:border-slate-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/70 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-light text-accent">
              <SlidersHorizontal className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold text-deep dark:text-azur-pastel leading-tight">Préférences d'affichage</h3>
              <p className="text-[12px] text-slate-500 dark:text-slate-400">Personnalisez votre espace — mémorisé sur cet appareil.</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2" title="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Thème */}
          <section>
            <SectionTitle icon={mode === 'dark' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}>
              Thème
            </SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: 'light', label: 'Clair', icon: <Sun className="w-4 h-4" /> },
                { key: 'dark', label: 'Sombre', icon: <Moon className="w-4 h-4" /> },
              ] as const).map((opt) => {
                const active = mode === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setMode(opt.key)}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                      active
                        ? 'border-accent bg-accent-light text-accent'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {opt.icon}
                    {opt.label}
                    {active && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Couleur d'accent */}
          <section>
            <SectionTitle icon={<Palette className="w-3.5 h-3.5" />}>Couleur d'accent</SectionTitle>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ACCENTS) as AccentKey[]).map((key) => {
                const a = ACCENTS[key];
                const active = accent === key;
                return (
                  <button
                    key={key}
                    onClick={() => setAccent(key)}
                    title={a.label}
                    className={`group flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors ${
                      active
                        ? 'border-slate-400 dark:border-slate-400 bg-slate-50 dark:bg-slate-800'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-inner"
                      style={{ background: `linear-gradient(135deg, ${a.base}, ${a.dark})` }}
                    >
                      {active && <Check className="w-4 h-4 text-white drop-shadow" />}
                    </span>
                    <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 truncate">{a.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Densité / taille */}
          <section>
            <SectionTitle icon={<Type className="w-3.5 h-3.5" />}>Taille de l'interface</SectionTitle>
            <div className="space-y-2">
              {(Object.keys(DENSITIES) as DensityKey[]).map((key) => {
                const d = DENSITIES[key];
                const active = density === key;
                return (
                  <button
                    key={key}
                    onClick={() => setDensity(key)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                      active
                        ? 'border-accent bg-accent-light'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>
                      <span className={`block text-sm font-semibold ${active ? 'text-accent' : 'text-slate-700 dark:text-slate-200'}`}>{d.label}</span>
                      <span className="block text-[12px] text-slate-500 dark:text-slate-400">{d.hint}</span>
                    </span>
                    {active && <Check className="w-4 h-4 text-accent shrink-0" />}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Pied */}
        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-slate-200/70 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40">
          <button onClick={reset} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <RotateCcw className="w-4 h-4" /> Réinitialiser
          </button>
          <button onClick={onClose} className="btn-sourire text-sm">Terminé</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Bouton d'en-tête ouvrant la fenêtre de préférences. À placer à côté du
 * ThemeToggle dans chaque dashboard.
 */
export function PreferencesButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Préférences d'affichage"
        title="Préférences d'affichage (couleur, taille, thème)"
        className={
          className ||
          'inline-flex items-center justify-center w-9 h-9 rounded-xl border transition-colors cursor-pointer ' +
            'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-deep ' +
            'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
        }
      >
        <SlidersHorizontal className="w-5 h-5" />
      </button>
      <PreferencesModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default PreferencesModal;
