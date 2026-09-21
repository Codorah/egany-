import { createClient } from '@supabase/supabase-js';

/**
 * Vérifie que l'appelant est une utilisatrice connectée d'eganyé.
 *
 * POURQUOI
 * --------
 * Quatre endpoints (send-sms, send-email, send-whatsapp, ai-assistant)
 * n'exerçaient aucun contrôle : ils lisaient `to` et `message` dans le corps
 * de la requête et les transmettaient au fournisseur. Déployés sur un domaine
 * public, c'étaient donc des relais ouverts — n'importe qui sur Internet
 * pouvait envoyer des SMS et des e-mails vers n'importe quel numéro ou
 * adresse, sur le compte Twilio / Africa's Talking / Resend d'eganyé, et
 * consommer sans limite la clé Anthropic.
 *
 * Les conséquences ne sont pas seulement financières : un domaine qui sert de
 * relais à des campagnes d'hameçonnage finit sur les listes noires, et les
 * messages légitimes de l'application cessent d'arriver.
 *
 * COMMENT
 * -------
 * Le client envoie son jeton d'accès Supabase ; on le fait valider par
 * Supabase lui-même. Aucune vérification de signature maison : la clé de
 * service interroge l'API d'authentification, qui reste l'autorité.
 */

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export async function requireUser(req: any): Promise<AuthenticatedUser | null> {
  const header: string | undefined = req.headers?.authorization || req.headers?.Authorization;
  if (!header || !header.startsWith('Bearer ')) return null;

  const accessToken = header.slice('Bearer '.length).trim();
  if (!accessToken) return null;

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    // Refuser plutôt que laisser passer : une configuration incomplète ne
    // doit jamais rouvrir le relais.
    console.error('[auth] Configuration Supabase absente — requête refusée.');
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data?.user) return null;
    return { id: data.user.id, email: data.user.email ?? undefined };
  } catch (err) {
    console.error('[auth] Vérification du jeton impossible :', err);
    return null;
  }
}

/**
 * Raccourci pour les gestionnaires : répond 401 et renvoie null si l'appelant
 * n'est pas authentifié.
 */
export async function requireUserOr401(req: any, res: any): Promise<AuthenticatedUser | null> {
  const user = await requireUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentification requise.' });
    return null;
  }
  return user;
}
