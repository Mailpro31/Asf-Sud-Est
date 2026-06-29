/**
 * Préférences d'affichage personnalisables par utilisateur (mémorisées dans le
 * navigateur, comme le thème). Deux axes :
 *
 *  - `accent` : la couleur d'accent des actions (boutons « déposer », tutoriel…).
 *    Appliquée via les variables CSS `--color-accent*` posées sur <html>, donc
 *    sans toucher au reste de la charte ASF (logos, badges de statut, marque).
 *  - `density` : l'échelle générale de l'interface, pilotée par la taille de
 *    police racine (les espacements Tailwind sont en `rem`, donc tout suit).
 *    « Grand » est pensé pour les utilisateurs qui préfèrent un texte plus gros.
 *
 * À garder aligné avec les défauts CSS de `:root` dans index.css.
 */

export type AccentKey = 'sourire' | 'azur' | 'deep' | 'violet' | 'emerald' | 'rose';
export type DensityKey = 'compact' | 'normal' | 'large';

export interface AccentDef {
  label: string;
  base: string;
  dark: string;
  light: string;
}

/** Palette d'accents proposée (l'orange ASF « sourire » reste le défaut). */
export const ACCENTS: Record<AccentKey, AccentDef> = {
  sourire: { label: 'Orange ASF', base: '#f39200', dark: '#d97e00', light: '#fff4e6' },
  azur:    { label: 'Azur',        base: '#1b98c4', dark: '#126b8b', light: '#e8f5fb' },
  deep:    { label: 'Bleu profond',base: '#0e5e76', dark: '#0a4658', light: '#e3eef2' },
  violet:  { label: 'Violet',      base: '#7c3aed', dark: '#6d28d9', light: '#f3eaff' },
  emerald: { label: 'Émeraude',    base: '#10b981', dark: '#059669', light: '#e7f8f1' },
  rose:    { label: 'Rose',        base: '#f43f5e', dark: '#e11d48', light: '#ffe9ee' },
};

export interface DensityDef {
  label: string;
  hint: string;
  fontSize: string;
}

export const DENSITIES: Record<DensityKey, DensityDef> = {
  compact: { label: 'Compact', hint: 'Plus d’informations à l’écran', fontSize: '15px' },
  normal:  { label: 'Normal',  hint: 'Équilibré (par défaut)',        fontSize: '16px' },
  large:   { label: 'Grand',   hint: 'Texte et boutons plus gros',    fontSize: '17px' },
};

export const ACCENT_LS_KEY = 'asf_accent';
export const DENSITY_LS_KEY = 'asf_density';

export const DEFAULT_ACCENT: AccentKey = 'sourire';
export const DEFAULT_DENSITY: DensityKey = 'normal';

export function getInitialAccent(): AccentKey {
  try {
    const s = localStorage.getItem(ACCENT_LS_KEY);
    if (s && s in ACCENTS) return s as AccentKey;
  } catch { /* ignore */ }
  return DEFAULT_ACCENT;
}

export function getInitialDensity(): DensityKey {
  try {
    const s = localStorage.getItem(DENSITY_LS_KEY);
    if (s && s in DENSITIES) return s as DensityKey;
  } catch { /* ignore */ }
  return DEFAULT_DENSITY;
}

/** Pose les variables CSS d'accent sur <html>. */
export function applyAccent(key: AccentKey) {
  const a = ACCENTS[key] || ACCENTS[DEFAULT_ACCENT];
  const root = document.documentElement;
  root.style.setProperty('--color-accent', a.base);
  root.style.setProperty('--color-accent-dark', a.dark);
  root.style.setProperty('--color-accent-light', a.light);
  root.setAttribute('data-accent', key);
}

/** Applique l'échelle d'interface (taille de police racine). */
export function applyDensity(key: DensityKey) {
  const d = DENSITIES[key] || DENSITIES[DEFAULT_DENSITY];
  document.documentElement.style.fontSize = d.fontSize;
  document.documentElement.setAttribute('data-density', key);
}
