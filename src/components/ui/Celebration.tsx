import { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const COLORS = ['#E9B44C', '#C96F4A', '#4F8A5B', '#FFF6EC', '#3B2418'];

interface CelebrationProps {
  /** Nombre de confettis. */
  count?: number;
  /** Rayon maximal de l'éclatement, en pixels. */
  spread?: number;
}

/**
 * Éclat de confettis pour marquer une bonne nouvelle d'argent (paiement
 * confirmé, cagnotte reçue). Se joue une fois à l'affichage, ne capte aucun
 * clic, et n'apparaît pas du tout si la personne a demandé de réduire les
 * mouvements. À poser dans un conteneur `relative`.
 */
export function Celebration({ count = 18, spread = 120 }: CelebrationProps) {
  const reduced = useReducedMotion();

  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const distance = spread * (0.55 + Math.random() * 0.45);
        return {
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance + 14,
          size: 5 + Math.random() * 5,
          color: COLORS[i % COLORS.length],
          delay: Math.random() * 0.12,
          duration: 0.9 + Math.random() * 0.4,
          round: i % 3 !== 0,
        };
      }),
    [count, spread]
  );

  if (reduced) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" aria-hidden="true">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.round ? '9999px' : '2px',
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
          animate={{ x: p.dx, y: p.dy, opacity: 0, scale: 0.4, rotate: 180 }}
          transition={{ duration: p.duration, delay: p.delay, ease: [0.15, 0.7, 0.3, 1] }}
        />
      ))}
    </div>
  );
}
