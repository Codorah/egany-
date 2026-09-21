import { apiFetch } from './apiBase';

export interface NotifyParams {
  userId: string;
  title: string;
  message: string;
  type: 'reminder' | 'payout' | 'system' | 'chat';
  link?: string;
}

/**
 * Enregistre une notification et la relaie par e-mail, SMS ou WhatsApp selon
 * les préférences de la destinataire.
 *
 * Tout se passe côté serveur (api/notify.ts). Auparavant, le navigateur lisait
 * lui-même l'adresse et le téléphone de la personne à prévenir dans la table
 * des profils — ce qui supposait que n'importe quel compte connecté puisse
 * lire les coordonnées de tous les autres. Dans un produit où des inconnues
 * se retrouvent dans un même cercle d'épargne, cela revenait à publier un
 * annuaire : de quoi démarcher, arnaquer ou harceler.
 *
 * Depuis la migration 0012, les profils ne sont lisibles que par leur
 * propriétaire. Le navigateur envoie donc un identifiant, jamais un contact,
 * et c'est la base qui décide — par ses règles d'accès — si l'expéditrice a
 * le droit d'écrire à cette personne.
 *
 * Un échec n'interrompt jamais l'action en cours : prévenir est important,
 * mais moins que l'opération qui a déclenché la notification.
 */
export async function notifyUser(params: NotifyParams): Promise<void> {
  try {
    const response = await apiFetch('/api/notify', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      console.warn('Notification non enregistrée :', response.status);
    }
  } catch (err) {
    console.warn('Notification impossible :', err);
  }
}
