/**
 * Fonctions masquées pour l'instant. Passer à true suffit à les réafficher : le code, les
 * tables et les conditions restent en place.
 */

/**
 * Coup de pouce, masqué depuis le 6 nov. 2026. Une personne qui a déjà un dossier voit
 * toujours le sien (elle a payé des frais d'étude), et l'Admin peut toujours les traiter.
 */
export const AID_ENABLED = false;

/**
 * Microcrédit, masqué depuis le 20 nov. 2026 pour le lancement sur Google Play (prêter avec
 * intérêt est en principe réservé aux établissements agréés : voir docs/GOOGLE-PLAY.md).
 * Une personne qui a déjà un dossier le voit toujours (elle doit pouvoir rembourser), et
 * l'Admin peut toujours les traiter. Désactiver aussi les services « credit » dans l'Admin.
 */
export const CREDIT_ENABLED = false;
