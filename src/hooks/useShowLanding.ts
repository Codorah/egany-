import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

const DESKTOP_QUERY = '(min-width: 1024px)';

/**
 * Faut-il montrer la page d'accueil du site plutôt que l'écran d'inscription ?
 *
 * Oui seulement dans un navigateur d'ordinateur :
 *   - jamais dans l'application Android (Capacitor) : on y installe déjà
 *     l'app, une vitrine n'aurait aucun sens ;
 *   - jamais sur téléphone ou petite tablette, où l'accueil de l'app est
 *     déjà fait pour l'écran ;
 *   - jamais quand l'adresse porte un paramètre (lien d'invitation ?join=,
 *     retour de paiement, raccourci) : la personne doit arriver droit sur
 *     l'action attendue.
 */
export function useShowLanding(): boolean {
  const eligible =
    typeof window !== 'undefined' &&
    !Capacitor.isNativePlatform() &&
    window.location.search === '' &&
    window.location.pathname === '/';

  const [isDesktop, setIsDesktop] = useState(
    () => eligible && window.matchMedia(DESKTOP_QUERY).matches,
  );

  useEffect(() => {
    if (!eligible) return;
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [eligible]);

  return eligible && isDesktop;
}
