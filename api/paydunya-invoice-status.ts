/**
 * Vérifie l'état d'une facture Paydunya, pour la carte Recharger qui attend
 * une confirmation SoftPay (USSD/PIN sur le téléphone) sans quitter eganyé.
 *
 * Lecture seule : ne crédite JAMAIS un portefeuille — ça reste le rôle exclusif
 * de api/paydunya-webhook (seul point d'entrée avec la clé service). Cet
 * endpoint sert uniquement à afficher "en attente / réussi / échoué" pendant
 * que le webhook fait, de son côté, le travail réel de crédit.
 */

const PAYDUNYA_CONFIRM_URL: Record<string, string> = {
  live: 'https://app.paydunya.com/api/v1/checkout-invoice/confirm/',
  sandbox: 'https://sandbox.paydunya.com/api/v1/checkout-invoice/confirm/',
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const invoiceToken = req.query?.token;
  if (!invoiceToken || typeof invoiceToken !== 'string') {
    return res.status(400).json({ error: 'Missing invoice token' });
  }

  const masterKey = process.env.PAYDUNYA_MASTER_KEY;
  const privateKey = process.env.PAYDUNYA_PRIVATE_KEY;
  const token = process.env.PAYDUNYA_TOKEN;
  const mode = process.env.PAYDUNYA_MODE || 'sandbox';

  if (!masterKey || !privateKey || !token) {
    return res.status(503).json({ error: 'Payment provider not configured' });
  }

  try {
    const confirmUrl = (PAYDUNYA_CONFIRM_URL[mode] || PAYDUNYA_CONFIRM_URL.sandbox) + invoiceToken;
    const confirmResponse = await fetch(confirmUrl, {
      headers: {
        'Content-Type': 'application/json',
        'PAYDUNYA-MASTER-KEY': masterKey,
        'PAYDUNYA-PRIVATE-KEY': privateKey,
        'PAYDUNYA-TOKEN': token,
      },
    });

    if (!confirmResponse.ok) {
      return res.status(502).json({ error: 'Provider verification failed' });
    }

    const confirmation: any = await confirmResponse.json();
    const status = String(confirmation?.status || 'pending').toLowerCase();

    return res.status(200).json({ status });
  } catch (error: any) {
    console.error('[paydunya-invoice-status] Erreur :', error);
    return res.status(500).json({ error: 'Status check failed' });
  }
}
