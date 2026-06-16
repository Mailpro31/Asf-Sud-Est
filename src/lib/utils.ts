/**
 * Utilitaires partagés de l'application.
 */

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
