/**
 * Autorise l'app Android à appeler /api.
 *
 * L'APK (Capacitor) charge l'interface depuis https://localhost et appelle
 * https://eganye.codorah.com/api : c'est une requête d'une autre origine. Le
 * WebView envoie d'abord une requête OPTIONS (« preflight ») à cause des
 * en-têtes Content-Type JSON et Authorization ; nos fonctions répondaient
 * 405, et le WebView abandonnait l'appel. Résultat : recharge Mobile Money,
 * notifications et assistant ne marchaient pas dans l'app installée.
 *
 * Seules les origines de l'app native sont ajoutées : le site lui-même est
 * sur la même origine et n'a besoin de rien.
 *
 * Renvoie true si la requête était un preflight, déjà traité.
 */
const NATIVE_APP_ORIGINS = new Set([
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
]);

export function handleCors(req: any, res: any): boolean {
  const origin: string | undefined = req.headers?.origin;
  if (origin && NATIVE_APP_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
