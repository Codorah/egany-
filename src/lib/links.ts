/**
 * Liens publics d'eganyé.
 *
 * Le bouton « Télécharger l'app » de la page d'accueil reste caché tant que
 * l'application n'est pas publiée : un lien vers une fiche Play Store qui
 * n'existe pas encore mène à une page d'erreur Google. Passer
 * PLAY_STORE_PUBLISHED à true le jour de la mise en ligne.
 */
export const PLAY_STORE_PUBLISHED = false;
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.codorah.eganye';

/**
 * APK Android servi par le site en attendant le Play Store. Signé avec la clé
 * release (la même que celle prévue pour le Play Store), pour que le passage
 * au store se fasse sans désinstaller. À regénérer à chaque version :
 * android/app/build/outputs/apk/release/app-release.apk → public/downloads/.
 */
export const APK_DOWNLOAD_URL = '/downloads/eganye.apk';

/**
 * Afficher le nom des entreprises partenaires sur les services annexes.
 *
 * Dossier BCEAO : nommer un partenaire exige une convention de collaboration
 * signée et son RCCM. Les services restent ouverts aux demandes, mais sans
 * nom d'entreprise tant que les conventions ne sont pas signées. Passer à
 * true une fois signées.
 */
export const SHOW_PARTNER_NAMES = false;
