import { createClient } from '@supabase/supabase-js';

/**
 * Crédit d'un portefeuille pour le parcours de paiement SIMULÉ, hors production.
 *
 * Pourquoi ce fichier existe
 * --------------------------
 * Le crédit réel est réservé à api/paydunya-webhook, appelé par Paydunya
 * lui-même. En développement, ce webhook ne peut jamais arriver : callback_url
 * pointe sur localhost, que Paydunya ne peut pas joindre. Sans identifiants
 * Paydunya, create-paydunya-checkout bascule donc sur un parcours simulé
 * (PaydunyaSimulator) qui affichait « paiement réussi » sans rien créditer —
 * le solde ne bougeait jamais, et l'application paraissait cassée alors qu'elle
 * se comportait correctement.
 *
 * Cet endpoint ferme cette boucle en local uniquement.
 *
 * Garde-fous
 * ----------
 * Deux conditions cumulatives, vérifiées à chaque appel :
 *   1. on n'est pas en production (VERCEL_ENV) ;
 *   2. aucun identifiant Paydunya n'est configuré — dès qu'un vrai paiement
 *      est possible, la simulation n'a plus aucune raison d'exister.
 *
 * Si l'une des deux tombe, l'endpoint refuse. Il ne peut donc pas devenir un
 * distributeur d'argent gratuit sur l'environnement déployé.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isProduction = process.env.VERCEL_ENV === 'production';
  const hasPaydunyaCredentials = Boolean(
    process.env.PAYDUNYA_MASTER_KEY && process.env.PAYDUNYA_PRIVATE_KEY && process.env.PAYDUNYA_TOKEN
  );

  if (isProduction || hasPaydunyaCredentials) {
    console.warn('[dev-simulate-payment] Appel refusé : environnement réel.');
    return res.status(404).json({ error: 'Not found' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY absent — le crédit simulé est impossible.',
    });
  }

  const { userId, amount, reference } = req.body ?? {};
  const parsedAmount = Number(amount);
  if (!userId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Requête invalide (utilisateur ou montant).' });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Même clé d'idempotence que la vraie recharge : rejouer la simulation ne
    // crédite pas deux fois. Le préfixe distingue clairement ces mouvements
    // des vrais dans le grand livre.
    const idempotencyKey = `devsim_${reference || `${userId}_${parsedAmount}_${Date.now()}`}`;

    const { data: ledger, error: ledgerError } = await supabase.rpc('execute_financial_transaction', {
      p_idempotency_key: idempotencyKey,
      p_user_id: userId,
      p_amount: parsedAmount,
      p_currency: 'FCFA',
      p_description: 'Recharge de portefeuille (paiement simulé — développement)',
      p_action_type: 'wallet_recharge',
      p_debit_account: 'psp_paydunya_simulated',
      p_credit_account: `user_wallet:${userId}`,
      p_contribution_id: null,
      p_group_id: null,
      p_ip: 'simulation locale',
    });

    if (ledgerError || !(ledger as any)?.success) {
      console.error('[dev-simulate-payment] Échec du crédit :', ledgerError || ledger);
      return res.status(500).json({ error: (ledger as any)?.message || 'Ledger credit failed' });
    }

    return res.status(200).json({ credited: true, amount: parsedAmount });
  } catch (err: any) {
    console.error('[dev-simulate-payment] Erreur inattendue :', err);
    return res.status(500).json({ error: 'Simulation failed' });
  }
}
