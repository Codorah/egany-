/**
 * Un message reçu par un membre peut venir d'un autre membre. Sans échappement, il
 * pouvait contenir des liens et du HTML envoyés depuis l'adresse d'eganyé.
 */
export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
