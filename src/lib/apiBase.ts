import { Capacitor } from '@capacitor/core';

// Sur le web (navigateur, servi depuis eganye.codorah.com), un chemin relatif
// /api/... suffit — même origine. Dans l'app native Capacitor, le contenu est
// chargé depuis un schéma local (capacitor://localhost), donc un chemin
// relatif ne résoudrait jamais vers les fonctions serverless réelles : il
// faut l'URL absolue du site déployé.
const PRODUCTION_API_BASE = 'https://eganye.codorah.com';

export function apiUrl(path: string): string {
  if (Capacitor.isNativePlatform()) {
    return `${PRODUCTION_API_BASE}${path}`;
  }
  return path;
}

/**
 * Appel d'un endpoint /api en tant qu'utilisatrice connectée.
 *
 * Les endpoints qui font envoyer un message (SMS, e-mail, WhatsApp) ou qui
 * consomment une clé payante exigent désormais un jeton : sans lui, ils
 * étaient des relais ouverts sur Internet (voir api/_requireUser.ts). Ce
 * helper évite d'oublier l'en-tête d'un appel à l'autre.
 *
 * Import paresseux de supabase.ts : apiBase est importé par du code très bas
 * niveau, et une dépendance en dur créerait un cycle d'imports.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { supabase } = await import('./supabase');
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  return fetch(apiUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
}
