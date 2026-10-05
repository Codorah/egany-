-- ============================================================================
-- 0016 — Dépôt/retrait de coffre : une vraie clé d'idempotence
-- ============================================================================
-- deposit_to_vault et withdraw_from_vault construisaient leur clé avec
-- `extract(epoch from now())` : une valeur différente à chaque appel, même
-- en cas de rejeu réseau de la même requête. La migration 0006 avait déjà
-- corrigé exactement ce défaut pour repay_marketplace_credit en acceptant
-- une clé fournie par l'appelant ; même traitement ici.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.deposit_to_vault(
  p_vault_id uuid,
  p_amount numeric,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_vault record;
  v_ledger_result jsonb;
  v_key text;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le montant doit être supérieur à zéro.');
  END IF;

  SELECT * INTO v_vault FROM public.personal_vaults WHERE id = p_vault_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Banque introuvable.');
  END IF;

  v_key := coalesce(p_idempotency_key, 'vault_deposit_' || p_vault_id::text || '_' || gen_random_uuid()::text);

  v_ledger_result := public.execute_financial_transaction(
    p_idempotency_key := v_key,
    p_user_id := auth.uid(),
    p_amount := p_amount,
    p_currency := 'FCFA',
    p_description := 'Dépôt dans la banque « ' || v_vault.name || ' »',
    p_action_type := 'vault_deposit',
    p_debit_account := 'user_wallet:' || auth.uid()::text,
    p_credit_account := 'personal_vault:' || p_vault_id::text
  );

  IF NOT (v_ledger_result->>'success')::boolean THEN
    RETURN jsonb_build_object('success', false, 'message', v_ledger_result->>'message');
  END IF;

  UPDATE public.personal_vaults SET balance = balance + p_amount WHERE id = p_vault_id;

  RETURN jsonb_build_object('success', true, 'message', 'Dépôt effectué.');
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_from_vault(
  p_vault_id uuid,
  p_amount numeric,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_vault record;
  v_ledger_result jsonb;
  v_key text;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le montant doit être supérieur à zéro.');
  END IF;

  SELECT * INTO v_vault FROM public.personal_vaults WHERE id = p_vault_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Banque introuvable.');
  END IF;

  IF v_vault.unlock_at > now() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cette banque est encore bloquée jusqu''au ' || to_char(v_vault.unlock_at, 'DD/MM/YYYY HH24:MI') || '.');
  END IF;

  IF p_amount > v_vault.balance THEN
    RETURN jsonb_build_object('success', false, 'message', 'Solde insuffisant dans cette banque.');
  END IF;

  v_key := coalesce(p_idempotency_key, 'vault_withdraw_' || p_vault_id::text || '_' || gen_random_uuid()::text);

  v_ledger_result := public.execute_financial_transaction(
    p_idempotency_key := v_key,
    p_user_id := auth.uid(),
    p_amount := p_amount,
    p_currency := 'FCFA',
    p_description := 'Retrait de la banque « ' || v_vault.name || ' »',
    p_action_type := 'vault_withdrawal',
    p_debit_account := 'personal_vault:' || p_vault_id::text,
    p_credit_account := 'user_wallet:' || auth.uid()::text
  );

  IF NOT (v_ledger_result->>'success')::boolean THEN
    RETURN jsonb_build_object('success', false, 'message', v_ledger_result->>'message');
  END IF;

  UPDATE public.personal_vaults SET balance = balance - p_amount WHERE id = p_vault_id;

  RETURN jsonb_build_object('success', true, 'message', 'Retrait effectué.');
END;
$$;
