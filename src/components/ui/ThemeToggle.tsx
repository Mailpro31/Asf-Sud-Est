import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';

function SunIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/**
 * Bouton de bascule clair / sombre, à intégrer dans une barre d'outils.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { mode, toggleTheme } = useTheme();
  const isDark = mode === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      title={isDark ? 'Mode clair' : 'Mode sombre'}
      className={cn(
        'inline-flex items-center justify-center w-9 h-9 rounded-xl border transition-colors cursor-pointer',
        'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-deep',
        'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white',
        className,
      )}
    >
      {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
    </button>
  );
}

/**
 * Bascule clair / sombre flottante, toujours visible quel que soit l'écran.
 * Rendue une seule fois au niveau de l'application.
 */
export function FloatingThemeToggle() {
  const { mode, toggleTheme } = useTheme();
  const isDark = mode === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      title={isDark ? 'Mode clair' : 'Mode sombre'}
      className={cn(
        'fixed bottom-5 left-5 z-[9980] inline-flex items-center justify-center w-12 h-12 rounded-full',
        'border shadow-asf-lg backdrop-blur-md transition-all duration-300 cursor-pointer hover:scale-105 active:scale-95',
        'border-azur/20 bg-white/85 text-sourire hover:text-sourire-dark hover:border-azur/40 ring-1 ring-azur/5',
        'dark:border-white/10 dark:bg-[#0f1c2e]/85 dark:text-azur-pastel dark:hover:text-white dark:ring-azur/10',
      )}
    >
      {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
    </button>
  );
}
