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
