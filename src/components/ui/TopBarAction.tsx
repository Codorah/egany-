import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Place l'action d'un écran dans la barre du haut, à côté du titre.
 * Reste sans effet si la barre n'est pas affichée.
 */
export function TopBarAction({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    setTarget(document.getElementById('top-bar-action'));
  }, []);

  return target ? createPortal(children, target) : null;
}
