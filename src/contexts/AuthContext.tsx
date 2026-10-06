import React, { createContext, useContext } from 'react';
import { useAuth as useAuthState } from '@/hooks/useAuth';

/**
 * Source unique de la session et du profil.
 *
 * `useAuth` ouvre un canal temps réel nommé `profile-<uid>` pour que le
 * solde affiché suive les crédits (dépôt Paydunya, décaissement…) sans
 * recharger la page. Avant ce contexte, App.tsx, LanguageContext.tsx et
 * GroupDetails.tsx appelaient chacun `useAuth()` séparément : trois canaux
 * indépendants portant le même nom, pour la même utilisatrice.
 *
 * GroupDetails se monte et se démonte à chaque entrée/sortie d'un cercle —
 * un geste courant, répété plusieurs fois par session. À son démontage,
 * son `useEffect` ferme SON canal `profile-<uid>` ; selon la façon dont le
 * client realtime partage une connexion par nom de canal, cela pouvait
 * couper le flux que App.tsx utilise pour afficher le solde, sans qu'aucune
 * erreur ne soit visible. Résultat observé en production : un dépôt
 * confirmé par Paydunya (notification reçue), le portefeuille réellement
 * crédité en base, mais la page de l'utilisatrice encore ouverte continuait
 * d'afficher l'ancien solde (souvent 0) jusqu'à un rechargement complet.
 *
 * En ne faisant tourner `useAuth` qu'une fois, pour toute la durée de vie de
 * l'application, ce risque disparaît : un seul canal, jamais démonté tant
 * que l'application reste ouverte.
 */
const AuthContext = createContext<ReturnType<typeof useAuthState> | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuthState();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext doit être utilisé à l\'intérieur de <AuthProvider>.');
  }
  return ctx;
}
