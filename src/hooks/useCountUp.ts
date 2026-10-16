import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * Fait « compter » un nombre vers sa nouvelle valeur au lieu de le remplacer
 * d'un coup : quand un dépôt arrive, on voit le solde monter, et on comprend
 * que c'est bien l'argent qui vient d'entrer.
 *
 * - Pas d'animation au premier affichage : un écran qui s'ouvre ne doit pas
 *   faire défiler des chiffres.
 * - Aucune animation si la personne a demandé de réduire les mouvements.
 * - Si la valeur change en cours de route, on repart de ce qui est affiché.
 */
export function useCountUp(target: number, duration = 700): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(target);
  const shownRef = useRef(target);

  useEffect(() => {
    if (reduced || !Number.isFinite(target) || target === shownRef.current) {
      shownRef.current = target;
      setValue(target);
      return;
    }

    const from = shownRef.current;
    const startedAt = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = progress === 1 ? target : Math.round(from + (target - from) * eased);
      shownRef.current = next;
      setValue(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduced]);

  return value;
}
