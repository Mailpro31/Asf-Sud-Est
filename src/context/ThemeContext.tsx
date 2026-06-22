import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

/**
 * Thème de l'application — modes CLAIR et SOMBRE (charte ASF).
 *
 * - `mode` : 'light' | 'dark', persisté dans localStorage et appliqué via la
 *   classe `dark` sur <html> (stratégie « class » de Tailwind v4).
 * - `themeConfig` : source de vérité partagée pour les classes récurrentes
 *   (sidebar, cartes, boutons, inputs, modales…). Ses valeurs s'adaptent
 *   automatiquement au mode courant, de sorte que tout composant qui s'appuie
 *   dessus reste lisible dans les deux thèmes.
 */
export type ThemeMode = 'light' | 'dark';

interface ThemeConfig {
  bg: string;
  sidebarBg: string;
  sidebarText: string;
  sidebarActive: string;
  cardBg: string;
  cardBorder: string;
  textColor: string;
  textMuted: string;
  accent: 'blue' | 'cyan' | 'zinc' | 'amber';
  btnPrimary: string;
  btnPrimaryHover: string;
  btnSecondary: string;
  accentGlow: string;
  fontFamily: string;
  btnDanger: string;
  btnGhost: string;
  inputBase: string;
  sectionTitle: string;
  modalOverlay: string;
  modalPanel: string;
  divider: string;
}

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  setMode: (m: ThemeMode) => void;
  themeConfig: ThemeConfig;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const LS_KEY = 'asf_theme';

/** Configuration partagée — mode CLAIR. */
const lightConfig: ThemeConfig = {
  bg: 'bg-transparent',
  sidebarBg: 'bg-slate-900 border-r border-slate-200/5',
  sidebarText: 'text-slate-400 hover:text-white hover:bg-white/5',
  sidebarActive: 'bg-azur/15 text-azur border-l-4 border-azur font-semibold',
  cardBg: 'bg-white',
  cardBorder: 'border-slate-200/70',
  textColor: 'text-slate-800',
  textMuted: 'text-slate-500',
  accent: 'blue',
  btnPrimary: 'bg-azur text-white hover:bg-azur-hover font-medium rounded-xl shadow-xs transition-all duration-200',
  btnPrimaryHover: 'hover:bg-azur-hover',
  btnSecondary: 'bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs transition-all duration-200',
  accentGlow: 'shadow-[0_4px_20px_rgba(27,152,196,0.02)]',
  fontFamily: 'font-sans',
  btnDanger: 'bg-rose-600 text-white hover:bg-rose-700 font-medium rounded-xl shadow-xs transition-all duration-200',
  btnGhost: 'text-slate-600 hover:text-deep hover:bg-slate-100 font-medium rounded-xl transition-all duration-200',
  inputBase: 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-azur focus:ring-3 focus:ring-azur/15 transition',
  sectionTitle: 'font-display text-deep font-bold tracking-tight',
  modalOverlay: 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm',
  modalPanel: 'w-full bg-white rounded-3xl shadow-[0_18px_40px_-12px_rgba(14,94,118,0.22)] overflow-hidden',
  divider: 'border-slate-200/70',
};

/** Configuration partagée — mode SOMBRE (contrastes garantis). */
const darkConfig: ThemeConfig = {
  bg: 'bg-transparent',
  sidebarBg: 'bg-[#060c16] border-r border-white/10',
  sidebarText: 'text-slate-400 hover:text-white hover:bg-white/10',
  sidebarActive: 'bg-azur/20 text-azur-pastel border-l-4 border-azur font-semibold',
  cardBg: 'bg-[#0f1c2e]',
  cardBorder: 'border-white/10',
  textColor: 'text-slate-100',
  textMuted: 'text-slate-400',
  accent: 'blue',
  btnPrimary: 'bg-azur text-white hover:bg-azur-hover font-medium rounded-xl shadow-xs transition-all duration-200',
  btnPrimaryHover: 'hover:bg-azur-hover',
  btnSecondary: 'bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium rounded-xl border border-slate-700 hover:border-slate-600 shadow-xs transition-all duration-200',
  accentGlow: 'shadow-[0_4px_20px_rgba(0,0,0,0.4)]',
  fontFamily: 'font-sans',
  btnDanger: 'bg-rose-600 text-white hover:bg-rose-500 font-medium rounded-xl shadow-xs transition-all duration-200',
  btnGhost: 'text-slate-300 hover:text-white hover:bg-white/10 font-medium rounded-xl transition-all duration-200',
  inputBase: 'w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-azur focus:ring-3 focus:ring-azur/25 transition',
  sectionTitle: 'font-display text-azur-pastel font-bold tracking-tight',
  modalOverlay: 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm',
  modalPanel: 'w-full bg-slate-900 border border-slate-700 rounded-3xl shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)] overflow-hidden',
  divider: 'border-slate-700/70',
};

function getInitialMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* ignore */
  }
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    /* ignore */
  }
  return 'light';
}

/** Applique le mode sur <html> (classe + color-scheme natif). */
function applyMode(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  root.style.colorScheme = mode;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode);

  useEffect(() => {
    applyMode(mode);
    try {
      localStorage.setItem(LS_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);
  const toggleTheme = useCallback(
    () => setModeState((prev) => (prev === 'dark' ? 'light' : 'dark')),
    [],
  );

  const themeConfig = mode === 'dark' ? darkConfig : lightConfig;

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setMode, themeConfig }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
