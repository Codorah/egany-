import { createClient } from '@supabase/supabase-js';

/**
 * Webhook Paydunya (IPN) — le SEUL endroit autorisé à créditer un portefeuille.
 *
 * Principe : le corps du POST reçu n'est jamais cru sur parole. On en extrait
 * uniquement le jeton de facture, puis on interroge Paydunya nous-mêmes pour
 * connaître le statut réel. Sans cette re-vérification, n'importe qui pouvant
 * poster sur cette URL pourrait déclarer un paiement.
 *
 * Le crédit passe par execute_financial_transaction appelée avec la clé
 * service : depuis la migration 0005, une recharge est refusée si elle vient
 * du client.
 */

const PAYDUNYA_CONFIRM_URL: Record<string, string> = {
  live: 'https://app.paydunya.com/api/v1/checkout-invoice/confirm/',
  sandbox: 'https://sandbox.paydunya.com/api/v1/checkout-invoice/confirm/',
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const masterKey = process.env.PAYDUNYA_MASTER_KEY;
  const privateKey = process.env.PAYDUNYA_PRIVATE_KEY;
  const token = process.env.PAYDUNYA_TOKEN;
  const mode = process.env.PAYDUNYA_MODE || 'sandbox';

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!masterKey || !privateKey || !token) {
    console.error('[paydunya-webhook] Identifiants Paydunya absents — webhook inopérant.');
    return res.status(500).json({ error: 'Payment provider not configured' });
  }
  if (!supabaseUrl || !serviceKey) {
    console.error('[paydunya-webhook] SUPABASE_SERVICE_ROLE_KEY absent — impossible de créditer.');
    return res.status(500).json({ error: 'Server not configured' });
  }

  // Paydunya poste soit du form-urlencoded (data[...]) soit du JSON selon la
  // configuration ; on accepte les deux et on ne garde que le jeton.
  const body = req.body ?? {};
  const invoiceToken: string | undefined =
    body?.data?.invoice?.token ||
    body?.invoice?.token ||
    body?.token ||
    body?.['data[invoice][token]'];

  if (!invoiceToken) {
    console.warn('[paydunya-webhook] Notification sans jeton de facture, ignorée.');
    return res.status(400).json({ error: 'Missing invoice token' });
  }

  try {
    // ---- 1. Re-vérification auprès de Paydunya (source de vérité) ----
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
      console.error('[paydunya-webhook] Confirmation HTTP', confirmResponse.status);
      return res.status(502).json({ error: 'Provider verification failed' });
    }

    const confirmation: any = await confirmResponse.json();
    const status = String(confirmation?.status || '').toLowerCase();

    if (confirmation?.response_code !== '00' || status !== 'completed') {
      // Paiement non abouti : on l'enregistre mais on ne crédite rien.
      console.log(`[paydunya-webhook] Facture ${invoiceToken} non aboutie (statut: ${status || 'inconnu'}).`);
      return res.status(200).json({ received: true, credited: false, status });
    }

    // ---- 2. Montant et bénéficiaire : depuis la confirmation, pas du POST ----
    const amount = Number(confirmation?.invoice?.total_amount);
    const userId: string | undefined = confirmation?.custom_data?.userId;

    if (!userId || !Number.isFinite(amount) || amount <= 0) {
      console.error('[paydunya-webhook] Confirmation sans userId ou montant exploitable.');
      return res.status(422).json({ error: 'Incomplete confirmation payload' });
    }

    // ---- 3. Crédit, avec la clé service ----
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Le jeton de facture est unique côté Paydunya : il sert de clé
    // d'idempotence, donc un IPN rejoué ne crédite jamais deux fois.
    const idempotencyKey = `paydunya_${invoiceToken}`;

    const { data: ledger, error: ledgerError } = await supabase.rpc('execute_financial_transaction', {
      p_idempotency_key: idempotencyKey,
      p_user_id: userId,
      p_amount: amount,
      p_currency: 'FCFA',
      p_description: 'Recharge de portefeuille via Paydunya',
      p_action_type: 'wallet_recharge',
      p_debit_account: 'psp_paydunya',
      p_credit_account: `user_wallet:${userId}`,
      p_contribution_id: null,
      p_group_id: null,
      p_ip: 'webhook paydunya',
    });

    if (ledgerError || !(ledger as any)?.success) {
      console.error('[paydunya-webhook] Échec du crédit :', ledgerError || ledger);
      // 500 → Paydunya réessaiera la notification.
      return res.status(500).json({ error: 'Ledger credit failed' });
    }

    // ---- 4. Trace visible par l'utilisatrice ----
    await supabase.from('wallet_transactions').insert({
      user_id: userId,
      amount,
      type: 'recharge',
      description: 'Recharge de portefeuille via Paydunya',
      status: 'completed',
      payment_method: 'paydunya',
      reference: (ledger as any)?.transactionId || invoiceToken,
    });

    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Portefeuille rechargé',
      message: `Votre portefeuille a été crédité de ${amount.toLocaleString('fr-FR')} FCFA.`,
      type: 'system',
      read: false,
    });

    return res.status(200).json({ received: true, credited: true });
  } catch (err: any) {
    console.error('[paydunya-webhook] Erreur inattendue :', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
