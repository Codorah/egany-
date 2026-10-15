-- ============================================================================
-- 0020 — Une seule cotisation par membre, par cercle et par période
-- ============================================================================
-- Constaté le 15 oct. 2026 : un membre du cercle « Commerce & Marché » avait
-- DEUX cotisations « Octobre 2026 » — l'une payée en espèces le 2 oct.,
-- l'autre créée 3 secondes plus tard et restée « en retard ». Le soir du
-- 15 oct., dès que son dépôt PayDunya de 1 000 F a été crédité, le
-- prélèvement automatique a payé ce doublon avec : octobre payé DEUX fois,
-- portefeuille retombé à 0, épargne comptée 3 000 F au lieu de 2 000 F.
--
-- Cause : ContributionsManager insérait une nouvelle ligne à chaque appui
-- (« Enregistrer un paiement », « Créer l'appel de cotisation ») sans
-- regarder si la période existait déjà, et rien en base ne l'interdisait.
-- Le client est corrigé ; cette migration répare les données puis pose la
-- règle en base.
--
-- Rejouable sans risque : le remboursement porte une clé d'idempotence.
-- ============================================================================

-- 1. Rembourser tout doublon PAYÉ PAR LE PORTEFEUILLE alors que la même
--    période était déjà payée. Écritures complètes : grand livre (partie
--    double), solde, épargne comptée, historique visible, journal d'audit.
DO $$
DECLARE
  v_dup record;
  v_amount numeric;
  v_key text;
  v_tx text;
BEGIN
  FOR v_dup IN
    WITH ranked AS (
      SELECT c.*,
             row_number() OVER (
               PARTITION BY group_id, user_id, period
               ORDER BY (status = 'paid') DESC, created_at ASC
             ) AS rn
      FROM public.contributions c
      WHERE period IS NOT NULL
    )
    SELECT r.*, g.name AS group_name, coalesce(g.currency, 'FCFA') AS currency
    FROM ranked r
    JOIN public.groups g ON g.id = r.group_id
    WHERE r.rn > 1
      AND r.status = 'paid'
      AND r.idempotency_key LIKE 'debit\_%'          -- payé par le portefeuille
      AND EXISTS (                                    -- et la période l'était déjà
        SELECT 1 FROM public.contributions o
        WHERE o.group_id = r.group_id AND o.user_id = r.user_id AND o.period = r.period
          AND o.id <> r.id AND o.status = 'paid' AND o.created_at < r.created_at
      )
  LOOP
    v_key := 'refund_duplicate_contribution_' || v_dup.id::text;
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.idempotency_keys WHERE key = v_key);

    -- Montant réellement prélevé (cotisation + pénalité éventuelle), lu dans
    -- l'idempotence du prélèvement plutôt que recalculé.
    SELECT amount INTO v_amount FROM public.idempotency_keys WHERE key = v_dup.idempotency_key;
    v_amount := coalesce(v_amount, v_dup.amount);
    v_tx := gen_random_uuid()::text;

    UPDATE public.profiles
       SET wallet_balance = wallet_balance + v_amount,
           total_saved = greatest(0, total_saved - v_dup.amount),
           updated_at = now()
     WHERE id = v_dup.user_id;

    INSERT INTO public.double_entry_ledger (id, transaction_id, idempotency_key, account, counterparty, type, amount, currency, description)
    VALUES
      (v_tx || '_dr', v_tx, v_key, 'tontine_group:' || v_dup.group_id, 'user_wallet:' || v_dup.user_id, 'debit', v_amount, v_dup.currency,
       'Remboursement — cotisation ' || v_dup.period || ' payée deux fois (' || v_dup.group_name || ')'),
      (v_tx || '_cr', v_tx, v_key, 'user_wallet:' || v_dup.user_id, 'tontine_group:' || v_dup.group_id, 'credit', v_amount, v_dup.currency,
       'Remboursement — cotisation ' || v_dup.period || ' payée deux fois (' || v_dup.group_name || ')');

    INSERT INTO public.idempotency_keys (key, transaction_id, user_id, amount, action_type)
    VALUES (v_key, v_tx, v_dup.user_id, v_amount, 'duplicate_contribution_refund');

    INSERT INTO public.wallet_transactions (user_id, amount, type, description, status, reference, payment_method)
    VALUES (v_dup.user_id, v_amount, 'payout_credit',
            'Remboursement : cotisation ' || v_dup.period || ' prélevée deux fois — ' || v_dup.group_name,
            'completed', v_tx, 'wallet');

    INSERT INTO public.audit_logs (user_id, action, details, ip, device, status, idempotency_key)
    VALUES (v_dup.user_id, 'duplicate_contribution_refund',
            'Cotisation ' || v_dup.id || ' (' || v_dup.period || ') payée en double : ' || v_amount || ' ' || v_dup.currency
              || ' rendus au portefeuille, doublon supprimé (migration 0020).',
            'non disponible', 'Migration', 'success', v_key);

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (v_dup.user_id, 'Cotisation remboursée',
            'Votre cotisation ' || v_dup.period || ' du cercle ' || v_dup.group_name || ' avait été prélevée deux fois. '
              || v_amount || ' ' || v_dup.currency || ' ont été rendus à votre portefeuille.',
            'system');

    DELETE FROM public.contributions WHERE id = v_dup.id;
  END LOOP;
END;
$$;

-- 2. Suppression des doublons qui ne portent AUCUN argent : pas de débit
--    (debited_at, idempotency_key), pas de pénalité réglée, pas « payés ».
--    On garde, par (cercle, membre, période), la ligne payée si elle existe,
--    sinon la plus ancienne.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY group_id, user_id, period
           ORDER BY (status = 'paid') DESC, created_at ASC
         ) AS rn
  FROM public.contributions
  WHERE period IS NOT NULL
)
DELETE FROM public.contributions c
USING ranked r
WHERE c.id = r.id
  AND r.rn > 1
  AND c.status <> 'paid'
  AND c.debited_at IS NULL
  AND c.idempotency_key IS NULL
  AND coalesce(c.penalty_status, 'none') <> 'paid';

-- 3. La règle, en base. Si cette instruction échoue encore, il reste un
--    doublon d'un autre type (ex. deux paiements en espèces) : à examiner à
--    la main, jamais à supprimer automatiquement.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_contribution_member_period
  ON public.contributions (group_id, user_id, period)
  WHERE period IS NOT NULL;
