import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * `useState` persistant : mémorise la valeur dans localStorage sous `key`, de
 * sorte qu'un dashboard ou une fenêtre retrouve son dernier tri / filtre /
 * onglet d'une visite à l'autre.
 *
 * - La clé devrait inclure l'identité du compte (ex. `asf:dash:${orgId}:sort`)
 *   pour que les préférences restent propres à l'utilisateur.
 * - Si la clé change (changement de compte), l'état est ré-hydraté depuis la
 *   nouvelle clé (ou retombe sur `defaultValue`).
 * - Tolérant aux erreurs : stockage indisponible ou JSON corrompu ⇒ défaut.
 */
export function useStickyState<T>(defaultValue: T, key: string): [T, Dispatch<SetStateAction<T>>] {
  const read = (k: string): T => {
    try {
      const raw = localStorage.getItem(k);
      if (raw != null) return JSON.parse(raw) as T;
    } catch { /* ignore */ }
    return defaultValue;
  };

  const [value, setValue] = useState<T>(() => read(key));

  // Ré-hydrate quand la clé change (ex. nouvel utilisateur connecté).
  const prevKey = useRef(key);
  useEffect(() => {
    if (prevKey.current !== key) {
      prevKey.current = key;
      setValue(read(key));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }, [key, value]);

  return [value, setValue];
}
