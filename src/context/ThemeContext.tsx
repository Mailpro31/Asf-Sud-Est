import React, { createContext, useContext, useState } from 'react';

export type AppTheme = 'navy' | 'neo-dark' | 'swiss' | 'vintage';

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  themeConfig: {
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
  };
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const themeOptions: { id: AppTheme; label: string; desc: string; preview: string; textStyle: string }[] = [
  { id: 'navy', label: 'Minimalist Slate', desc: 'Sleek professional slate and indigo grid', preview: 'bg-slate-900', textStyle: 'text-indigo-600' },
];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>('navy');

  const setTheme = (newTheme: AppTheme) => {
    // Locked to minimalist Slate for consistent corporate UX
  };

  const getThemeConfig = (currentTheme: AppTheme) => {
    return {
      bg: 'bg-slate-50/60',
      sidebarBg: 'bg-slate-900 border-r border-slate-200/5',
      sidebarText: 'text-slate-400 hover:text-white hover:bg-white/5',
      sidebarActive: 'bg-azur/15 text-azur border-l-4 border-azur font-semibold',
      cardBg: 'bg-white',
      cardBorder: 'border-slate-200/60',
      textColor: 'text-slate-850',
      textMuted: 'text-slate-500',
      accent: 'blue' as const,
      btnPrimary: 'bg-azur text-white hover:bg-azur-hover font-medium rounded-xl shadow-xs transition-all duration-200',
      btnPrimaryHover: 'hover:bg-azur-hover',
      btnSecondary: 'bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs transition-all duration-200',
      accentGlow: 'shadow-[0_4px_20px_rgba(27,152,196,0.02)]',
      fontFamily: 'font-sans',
    };
  };

  const themeConfig = getThemeConfig(theme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themeConfig }}>
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
