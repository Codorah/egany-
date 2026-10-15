/**
 * Bilan de santé de la configuration serveur, lu par le panneau admin.
 *
 * Né d'un incident : SUPABASE_SERVICE_ROLE_KEY manquait en production. Le
 * webhook Paydunya répondait « Server not configured » à chaque paiement
 * confirmé — l'argent était payé mais aucun portefeuille n'était crédité — et
 * rien dans l'application ne le signalait. Les SMS, e-mails, WhatsApp et le
 * copilote IA (qui valident l'appelant avec la même clé) étaient bloqués aussi.
 *
 * Ne renvoie que des booléens : jamais une valeur, jamais un début de clé.
 */
export default function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const has = (name: string) => Boolean(process.env[name] && String(process.env[name]).trim());

  const checks = {
    supabaseUrl: has('VITE_SUPABASE_URL') || has('SUPABASE_URL'),
    supabaseServiceKey: has('SUPABASE_SERVICE_ROLE_KEY'),
    paydunya: has('PAYDUNYA_MASTER_KEY') && has('PAYDUNYA_PRIVATE_KEY') && has('PAYDUNYA_TOKEN'),
    paydunyaLive: process.env.PAYDUNYA_MODE === 'live',
    sms: (has('TWILIO_ACCOUNT_SID') && has('TWILIO_AUTH_TOKEN')) || (has('AFRICASTALKING_API_KEY') && has('AFRICASTALKING_USERNAME')),
    email: has('RESEND_API_KEY'),
    ai: has('ANTHROPIC_API_KEY'),
  };

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(checks);
}
