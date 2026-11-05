/**
 * Mot de passe oublié : le code à 6 chiffres échange contre une vraie session.
 * Sans ce drapeau, l'appli y voit une personne connectée et affiche l'accueil
 * avant qu'elle ait pu saisir son nouveau mot de passe. Tant qu'il est levé,
 * App.tsx garde l'écran d'inscription/connexion.
 */
let recoveryInProgress = false;

export const isRecoveryInProgress = () => recoveryInProgress;
export const setRecoveryInProgress = (value: boolean) => {
  recoveryInProgress = value;
};
