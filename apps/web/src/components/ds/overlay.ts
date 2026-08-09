import { useEffect, useState } from 'react';

/**
 * Gère la présence + l'animation d'entrée/sortie d'un overlay (tiroir/modale).
 * `mounted` : garder l'élément dans le DOM ; `shown` : classe d'ouverture active.
 * Ajoute la fermeture par Échap et le verrouillage du scroll du body.
 */
export function useOverlay(open: boolean, onClose: () => void, exitMs = 320) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // setTimeout plutôt que rAF : laisse peindre l'état fermé (transition
      // d'entrée) tout en restant fiable même onglet en arrière-plan (rAF gelé).
      const t = setTimeout(() => setShown(true), 16);
      return () => clearTimeout(t);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(t);
  }, [open, exitMs]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return { mounted, shown };
}
