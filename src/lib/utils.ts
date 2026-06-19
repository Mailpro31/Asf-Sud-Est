/**
 * Utilitaires partagés de l'application.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Fusionne des classes Tailwind de façon sûre (clsx + tailwind-merge).
 * Permet de surcharger des classes par défaut sans conflit.
 * Ex : cn('px-4 py-2', condition && 'px-6') => "py-2 px-6"
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Pastille de couleur déterministe à partir d'une graine (ex. id d'organisme
 * ou nom de dossier). Permet de différencier visuellement les dossiers /
 * organismes « d'un coup d'œil, mais pas trop » (teintes douces).
 */
export interface Swatch {
  /** Fond + texte de l'icône. */
  icon: string;
  /** Accent plein (barre/point). */
  dot: string;
  /** Bordure légère. */
  border: string;
}

const SWATCHES: Swatch[] = [
  { icon: 'bg-indigo-100 text-indigo-600', dot: 'bg-indigo-500', border: 'border-indigo-200' },
  { icon: 'bg-emerald-100 text-emerald-600', dot: 'bg-emerald-500', border: 'border-emerald-200' },
  { icon: 'bg-rose-100 text-rose-600', dot: 'bg-rose-500', border: 'border-rose-200' },
  { icon: 'bg-amber-100 text-amber-600', dot: 'bg-amber-500', border: 'border-amber-200' },
  { icon: 'bg-sky-100 text-sky-600', dot: 'bg-sky-500', border: 'border-sky-200' },
  { icon: 'bg-violet-100 text-violet-600', dot: 'bg-violet-500', border: 'border-violet-200' },
  { icon: 'bg-teal-100 text-teal-600', dot: 'bg-teal-500', border: 'border-teal-200' },
  { icon: 'bg-orange-100 text-orange-600', dot: 'bg-orange-500', border: 'border-orange-200' },
  { icon: 'bg-fuchsia-100 text-fuchsia-600', dot: 'bg-fuchsia-500', border: 'border-fuchsia-200' },
  { icon: 'bg-cyan-100 text-cyan-600', dot: 'bg-cyan-500', border: 'border-cyan-200' },
];

export function swatchFor(seed: string): Swatch {
  let h = 0;
  for (let i = 0; i < (seed || '').length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return SWATCHES[h % SWATCHES.length];
}

/** Initiales (1–2 lettres majuscules) à partir d'un nom, pour les avatars. */
export function initialsOf(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Formate une taille en octets en chaîne lisible (français).
 * Ex : formatBytes(1536) => "1.5 Ko"
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return '0 Octets';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Octets', 'Ko', 'Mo', 'Go', 'To', 'Po', 'Eo', 'Zo', 'Yo'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Lecture sécurisée d'une valeur JSON depuis localStorage.
 * Retourne `fallback` si la clé est absente ou si le JSON est invalide.
 */
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
