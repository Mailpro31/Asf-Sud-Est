import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  AccentKey,
  DensityKey,
  applyAccent,
  applyDensity,
  getInitialAccent,
  getInitialDensity,
  ACCENT_LS_KEY,
  DENSITY_LS_KEY,
  DEFAULT_ACCENT,
  DEFAULT_DENSITY,
} from '../lib/preferences';

/**
 * Préférences d'affichage personnalisables (couleur d'accent, densité). Le
 * thème clair/sombre reste géré par ThemeContext ; la fenêtre de préférences
 * réunit les deux pour l'utilisateur.
 */
interface PreferencesContextType {
  accent: AccentKey;
  density: DensityKey;
  setAccent: (a: AccentKey) => void;
  setDensity: (d: DensityKey) => void;
  reset: () => void;
}

const PreferencesContext = createContext<PreferencesContextType | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<AccentKey>(getInitialAccent);
  const [density, setDensityState] = useState<DensityKey>(getInitialDensity);

  useEffect(() => {
    applyAccent(accent);
    try { localStorage.setItem(ACCENT_LS_KEY, accent); } catch { /* ignore */ }
  }, [accent]);

  useEffect(() => {
    applyDensity(density);
    try { localStorage.setItem(DENSITY_LS_KEY, density); } catch { /* ignore */ }
  }, [density]);

  const setAccent = useCallback((a: AccentKey) => setAccentState(a), []);
  const setDensity = useCallback((d: DensityKey) => setDensityState(d), []);
  const reset = useCallback(() => {
    setAccentState(DEFAULT_ACCENT);
    setDensityState(DEFAULT_DENSITY);
  }, []);

  return (
    <PreferencesContext.Provider value={{ accent, density, setAccent, setDensity, reset }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within a PreferencesProvider');
  return ctx;
}
