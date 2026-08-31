/**
 * Ouverture d'une session de paiement Paydunya.
 *
 * Cet endpoint ne crédite RIEN : il se contente de demander une facture au
 * prestataire et de renvoyer l'URL de paiement. Le crédit du portefeuille est
 * décidé plus tard, et uniquement, par api/paydunya-webhook une fois le
 * paiement confirmé par Paydunya lui-même.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, userId, userName, userEmail, phone, paymentMethod } = req.body;

    const parsedAmount = Number(amount);
    if (!userId || !Number.isFinite(parsedAmount) || parsedAmount < 100) {
      return res.status(400).json({ error: 'Requête invalide (utilisateur ou montant).' });
    }

    const masterKey = process.env.PAYDUNYA_MASTER_KEY;
    const privateKey = process.env.PAYDUNYA_PRIVATE_KEY;
    const token = process.env.PAYDUNYA_TOKEN;
    const mode = process.env.PAYDUNYA_MODE || 'sandbox';

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const isProduction = process.env.VERCEL_ENV === 'production';

    if (!masterKey || !privateKey || !token) {
      // En production, mieux vaut un échec franc qu'un faux parcours de
      // paiement : l'utilisatrice croirait avoir payé.
      if (isProduction) {
        console.error('[paydunya] Identifiants absents en production — recharge indisponible.');
        return res.status(503).json({ error: 'Le paiement est momentanément indisponible.' });
      }
      // Hors production seulement : parcours simulé, pour travailler l'interface.
      // Il ne crédite aucun portefeuille (seul le webhook en a le droit).
      console.log('[paydunya] Identifiants absents — parcours simulé (aucun crédit).');
      const simUrl = `${origin}/?paydunya_sim=true&amount=${parsedAmount}&userId=${userId}`
        + `&userName=${encodeURIComponent(userName || '')}&userEmail=${encodeURIComponent(userEmail || '')}`
        + `&phone=${encodeURIComponent(phone || '')}&operator=${encodeURIComponent(paymentMethod || '')}`;
      return res.status(200).json({ id: 'sim_session_id', url: simUrl, simulated: true });
    }

    const baseUrl = mode === 'live'
      ? 'https://app.paydunya.com/api/v1/checkout-invoice/create'
      : 'https://sandbox.paydunya.com/api/v1/checkout-invoice/create';

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PAYDUNYA-MASTER-KEY': masterKey,
        'PAYDUNYA-PRIVATE-KEY': privateKey,
        'PAYDUNYA-TOKEN': token,
      },
      body: JSON.stringify({
        invoice: {
          total_amount: parsedAmount,
          description: 'Recharge de portefeuille eganyé',
          name: 'Recharge eganyé',
          // Préremplit nom/email/téléphone sur la page Paydunya hébergée.
          // Doit être imbriqué DANS "invoice" (pas à la racine du corps de
          // la requête) — un essai précédent l'avait placé au mauvais
          // niveau, ce qui faisait échouer la création de facture.
          customer: {
            name: userName || undefined,
            email: userEmail || undefined,
            phone: phone || undefined,
          },
        },
        store: {
          name: 'eganyé',
        },
        actions: {
          cancel_url: `${origin}/?paydunya_cancel=true`,
          // Retour de l'utilisatrice : purement informatif, ne prouve pas le
          // paiement (elle peut aussi taper cette adresse à la main).
          return_url: `${origin}/?paydunya_success=true`,
          // Notification serveur à serveur : c'est elle qui fait autorité.
          callback_url: `${origin}/api/paydunya-webhook`,
        },
        // Repris tel quel dans la confirmation : c'est ainsi que le webhook
        // sait quel portefeuille créditer, sans faire confiance au client.
        custom_data: {
          userId,
          userName,
          userEmail,
          phone,
          paymentMethod,
        },
      }),
    });

    const data = await response.json();

    if (data.response_code === '00') {
      return res.status(200).json({ id: data.token, url: data.response_text });
    }
    throw new Error(data.response_text || "Erreur de réponse de l'API Paydunya");
  } catch (error: any) {
    console.error('[paydunya] Erreur création de facture :', error);
    return res.status(500).json({ error: 'Impossible de démarrer le paiement.' });
  }
}
