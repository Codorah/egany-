/**
 * Ouverture d'une session de paiement Paydunya.
 *
 * Cet endpoint ne crédite RIEN : il se contente de demander une facture au
 * prestataire, puis (pour les opérateurs qui le permettent) de déclencher
 * directement le débit SoftPay sans quitter eganyé. Le crédit du portefeuille
 * est décidé plus tard, et uniquement, par api/paydunya-webhook une fois le
 * paiement confirmé par Paydunya lui-même.
 */

interface SoftpayRoute {
  endpoint: string;
  fields: (ctx: { name: string; email: string; phone: string; token: string }) => Record<string, string>;
}

// Correspondance opérateur eganyé -> route SoftPay Paydunya (documentation
// EN/softpay, vérifiée le 2026-08-31). Seuls les opérateurs sans code OTP
// à saisir côté marchand, et dont la confirmation ne redirige pas de toute
// façon vers une page tierce (Wave, Djamo), sont ici : ce sont les seuls
// pour lesquels rester sur eganyé apporte un vrai gain. Les noms de champs
// varient d'un opérateur à l'autre côté Paydunya (pas standardisés) — c'est
// volontairement recopié tel quel, ne pas "harmoniser".
const SOFTPAY_ROUTES: Record<string, SoftpayRoute> = {
  tmoney_tg: {
    endpoint: 't-money-togo',
    fields: ({ name, email, phone, token }) => ({
      name_t_money: name, email_t_money: email, phone_t_money: phone, payment_token: token,
    }),
  },
  moov_tg: {
    endpoint: 'moov-togo',
    fields: ({ name, email, phone, token }) => ({
      // customer_address doit être non vide (vérifié en direct : Paydunya le
      // rejette sinon) — on ne collecte pas d'adresse dans le formulaire de
      // recharge, donc on renseigne le pays à défaut de mieux.
      moov_togo_customer_fullname: name, moov_togo_email: email,
      moov_togo_customer_address: 'Togo', moov_togo_phone_number: phone, payment_token: token,
    }),
  },
  orange_money_sn: {
    endpoint: 'new-orange-money-senegal',
    fields: ({ name, email, phone, token }) => ({
      customer_name: name, customer_email: email, phone_number: phone, invoice_token: token,
    }),
  },
  expresso_sn: {
    endpoint: 'expresso-senegal',
    fields: ({ name, email, phone, token }) => ({
      expresso_sn_fullName: name, expresso_sn_email: email, expresso_sn_phone: phone, payment_token: token,
    }),
  },
  free_money_sn: {
    endpoint: 'free-money-senegal',
    fields: ({ name, email, phone, token }) => ({
      customer_name: name, customer_email: email, phone_number: phone, payment_token: token,
    }),
  },
  moov_bj: {
    endpoint: 'moov-benin',
    fields: ({ name, email, phone, token }) => ({
      moov_benin_customer_fullname: name, moov_benin_email: email,
      moov_benin_phone_number: phone, payment_token: token,
    }),
  },
  celtiis_bj: {
    endpoint: 'celtiis-cash',
    fields: ({ name, email, phone, token }) => ({
      celtiis_cash_customer_fullname: name, celtiis_cash_customer_email: email,
      celtiis_cash_phone_number: phone, payment_token: token,
    }),
  },
  moov_bf: {
    endpoint: 'moov-burkina',
    fields: ({ name, email, phone, token }) => ({
      moov_burkina_faso_fullName: name, moov_burkina_faso_email: email,
      moov_burkina_faso_phone_number: phone, moov_burkina_faso_payment_token: token,
    }),
  },
  moov_ci: {
    endpoint: 'moov-ci',
    fields: ({ name, email, phone, token }) => ({
      moov_ci_customer_fullname: name, moov_ci_email: email,
      moov_ci_phone_number: phone, payment_token: token,
    }),
  },
  orange_money_ml: {
    endpoint: 'orange-money-mali',
    fields: ({ name, email, phone, token }) => ({
      // Même remarque que moov_tg ci-dessus pour customer_address (par
      // analogie — pas vérifié en direct pour cette route spécifique).
      orange_money_mali_customer_fullname: name, orange_money_mali_email: email,
      orange_money_mali_phone_number: phone, orange_money_mali_customer_address: 'Mali', payment_token: token,
    }),
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, userId, userName, userEmail, phone, paymentMethod } = req.body;

    const parsedAmount = Number(amount);
    // Paydunya refuse toute facture sous 200 FCFA (vérifié en direct contre
    // l'API : "Invalid Total Amount. Minimum checkout amount is 200 FCFA.").
    if (!userId || !Number.isFinite(parsedAmount) || parsedAmount < 200) {
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
      return res.status(200).json({ id: 'sim_session_id', url: simUrl, mode: 'redirect', simulated: true });
    }

    const isLive = mode === 'live';
    const invoiceUrl = isLive
      ? 'https://app.paydunya.com/api/v1/checkout-invoice/create'
      : 'https://sandbox.paydunya.com/api/v1/checkout-invoice/create';
    const softpayBase = isLive
      ? 'https://app.paydunya.com/api/v1/softpay/'
      : 'https://sandbox.paydunya.com/api/v1/softpay/';

    const authHeaders = {
      'Content-Type': 'application/json',
      'PAYDUNYA-MASTER-KEY': masterKey,
      'PAYDUNYA-PRIVATE-KEY': privateKey,
      'PAYDUNYA-TOKEN': token,
    };

    const response = await fetch(invoiceUrl, {
      method: 'POST',
      headers: authHeaders,
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

    if (data.response_code !== '00') {
      throw new Error(data.response_text || "Erreur de réponse de l'API Paydunya");
    }

    const invoiceToken = data.token as string;
    const redirectUrl = data.response_text as string;

    // ---- SoftPay : rester sur eganyé au lieu de rediriger, si l'opérateur
    // choisi le permet. En cas d'échec ou d'imprévu, on retombe sur l'URL de
    // la facture déjà créée plutôt que de faire échouer toute la recharge —
    // la facture reste valable, seul le canal de confirmation change.
    const softpayRoute = SOFTPAY_ROUTES[paymentMethod as string];
    if (softpayRoute) {
      try {
        const softpayResponse = await fetch(softpayBase + softpayRoute.endpoint, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(softpayRoute.fields({
            name: userName || '',
            email: userEmail || '',
            phone: phone || '',
            token: invoiceToken,
          })),
        });
        const softpayData: any = await softpayResponse.json().catch(() => null);
        if (softpayResponse.ok && softpayData?.success === true) {
          return res.status(200).json({ mode: 'direct', invoiceToken, message: softpayData.message });
        }
        console.warn('[paydunya] SoftPay refusé, repli sur la redirection :', softpayData);
      } catch (softpayError) {
        console.warn('[paydunya] SoftPay indisponible, repli sur la redirection :', softpayError);
      }
    }

    return res.status(200).json({ id: invoiceToken, url: redirectUrl, mode: 'redirect' });
  } catch (error: any) {
    console.error('[paydunya] Erreur création de facture :', error);
    return res.status(500).json({ error: 'Impossible de démarrer le paiement.' });
  }
}
