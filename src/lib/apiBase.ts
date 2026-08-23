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
