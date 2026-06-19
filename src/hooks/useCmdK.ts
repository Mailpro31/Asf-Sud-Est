/**
 * Raccourci clavier ⌘K / Ctrl+K. Le callback est lu via une ref, ce qui permet
 * de passer une fonction inline sans réabonner l'écouteur à chaque rendu.
 */

import { useEffect, useRef } from 'react';

export function useCmdK(onTrigger: () => void) {
  const ref = useRef(onTrigger);
  ref.current = onTrigger;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ref.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
