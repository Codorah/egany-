-- ============================================================================
-- 0009 — MODES DE COMMISSION : PART DE COTISATION OU POURCENTAGE
-- ============================================================================
-- 0007 n'offrait qu'un pourcentage fixe. Le modèle retenu est différent : la
-- plateforme prélève l'équivalent d'UNE cotisation à chaque distribution.
-- Sur un cercle à 1000 F, cela fait 1000 F par tour, donc 1000 × N sur la
-- rotation complète — ce qui correspond exactement à la règle voulue.
--
-- Exprimé en pourcentage ce serait 1/N du pot, donc variable selon la taille
-- du cercle : un taux fixe ne peut pas le représenter, d'où ce mode dédié.

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS payout_fee_mode text NOT NULL DEFAULT 'none'
    CHECK (payout_fee_mode IN ('none', 'contribution_share', 'percent'));

COMMENT ON COLUMN public.platform_settings.payout_fee_mode IS
  'none = aucune commission ; contribution_share = une cotisation par distribution ; percent = payout_fee_percent % du pot.';

CREATE OR REPLACE FUNCTION public.execute_payout_disbursement(
  p_group_id uuid,
  p_beneficiary_id uuid,
  p_admin_user_id uuid,
  p_discount_amount numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_group record;
  v_beneficiary_name text;
  v_num_members integer;
  v_total_pot numeric;
  v_beneficiary_payout numeric;
  v_transaction_id text;
  v_idempotency_key text;
  v_next_index integer;
  v_next_date date;
  v_beneficiary_position integer;
  v_slot_holder uuid;
  v_discount_share numeric;
  v_member record;
  v_description text;
  v_fee_mode text;
  v_fee_percent numeric;
  v_platform_wallet uuid;
  v_fee numeric := 0;
  v_fee_label text := '';
BEGIN
  IF NOT (public.is_group_creator(p_group_id) OR public.is_admin()) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Non autorisé.');
  END IF;

  p_admin_user_id := auth.uid();

  SELECT * INTO v_group FROM public.groups WHERE id = p_group_id FOR UPDATE;
  IF NOT found THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le cercle d''épargne n''existe pas.');
  END IF;
  IF v_group.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le cercle n''est pas actif.');
  END IF;

  SELECT display_name INTO v_beneficiary_name FROM public.profiles WHERE id = p_beneficiary_id;
  IF NOT found THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le bénéficiaire n''existe pas.');
  END IF;

  SELECT count(*) INTO v_num_members FROM public.group_members
  WHERE group_id = p_group_id AND status = 'active';

  v_total_pot := v_group.contribution_amount * v_num_members;
  IF p_discount_amount < 0 OR p_discount_amount >= v_total_pot THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le montant du rabais est invalide.');
  END IF;

  v_idempotency_key := 'payout_' || p_group_id::text || '_cycle_' || v_group.current_payout_index::text;
  IF EXISTS (SELECT 1 FROM public.idempotency_keys WHERE key = v_idempotency_key) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Décaissement déjà exécuté pour ce cycle (Idempotent).');
  END IF;

  SELECT payout_fee_mode, payout_fee_percent, platform_wallet_id
    INTO v_fee_mode, v_fee_percent, v_platform_wallet
  FROM public.platform_settings WHERE id = 1;

  -- Jamais de commission vers le bénéficiaire lui-même : elle ne ferait que
  -- retirer puis rendre le même argent, en polluant le journal au passage.
  IF v_platform_wallet IS NOT NULL AND v_platform_wallet <> p_beneficiary_id THEN
    IF v_fee_mode = 'contribution_share' THEN
      v_fee := floor(v_group.contribution_amount);
      v_fee_label := 'une part de cotisation';
    ELSIF v_fee_mode = 'percent' AND coalesce(v_fee_percent, 0) > 0 THEN
      v_fee := floor(v_total_pot * v_fee_percent / 100);
      v_fee_label := v_fee_percent || ' %';
    END IF;
  END IF;

  v_beneficiary_payout := v_total_pot - p_discount_amount - v_fee;
  -- Couvre notamment le cercle à un seul membre, où une part de cotisation
  -- égale le pot entier : on refuse plutôt que de tout prélever.
  IF v_beneficiary_payout <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Commission et rabais dépassent le pot : décaissement annulé.');
  END IF;

  v_transaction_id := gen_random_uuid()::text;
  v_description := CASE WHEN p_discount_amount > 0
    THEN 'Encaissement Tontine Enchères - Pot ' || v_total_pot || ' ' || v_group.currency || ' (Rabais: -' || p_discount_amount || ')'
    ELSE 'Encaissement Tontine - Payout de ' || v_total_pot || ' ' || v_group.currency END;

  UPDATE public.profiles SET wallet_balance = wallet_balance + v_beneficiary_payout, updated_at = now()
  WHERE id = p_beneficiary_id;

  INSERT INTO public.double_entry_ledger (id, transaction_id, idempotency_key, account, counterparty, type, amount, currency, description)
  VALUES
    (v_transaction_id || '_benef_dr', v_transaction_id, v_idempotency_key, 'tontine_group:' || p_group_id, 'user_wallet:' || p_beneficiary_id, 'debit', v_beneficiary_payout, v_group.currency, v_description),
    (v_transaction_id || '_benef_cr', v_transaction_id, v_idempotency_key, 'user_wallet:' || p_beneficiary_id, 'tontine_group:' || p_group_id, 'credit', v_beneficiary_payout, v_group.currency, v_description);

  IF v_fee > 0 THEN
    UPDATE public.profiles SET wallet_balance = wallet_balance + v_fee, updated_at = now()
    WHERE id = v_platform_wallet;

    INSERT INTO public.double_entry_ledger (id, transaction_id, idempotency_key, account, counterparty, type, amount, currency, description)
    VALUES
      (v_transaction_id || '_fee_dr', v_transaction_id, v_idempotency_key, 'tontine_group:' || p_group_id, 'platform_wallet:' || v_platform_wallet, 'debit', v_fee, v_group.currency, 'Commission plateforme (' || v_fee_label || ') sur le pot de ' || v_total_pot || ' ' || v_group.currency),
      (v_transaction_id || '_fee_cr', v_transaction_id, v_idempotency_key, 'platform_wallet:' || v_platform_wallet, 'tontine_group:' || p_group_id, 'credit', v_fee, v_group.currency, 'Commission plateforme (' || v_fee_label || ') sur le pot de ' || v_total_pot || ' ' || v_group.currency);
  END IF;

  IF p_discount_amount > 0 THEN
    v_discount_share := floor(p_discount_amount / greatest(v_num_members - 1, 1));
    FOR v_member IN
      SELECT user_id FROM public.group_members
      WHERE group_id = p_group_id AND status = 'active' AND user_id <> p_beneficiary_id
    LOOP
      UPDATE public.profiles SET wallet_balance = wallet_balance + v_discount_share, updated_at = now()
      WHERE id = v_member.user_id;

      INSERT INTO public.double_entry_ledger (id, transaction_id, idempotency_key, account, counterparty, type, amount, currency, description)
      VALUES
        (v_transaction_id || '_share_' || v_member.user_id || '_dr', v_transaction_id, v_idempotency_key, 'tontine_group:' || p_group_id, 'user_wallet:' || v_member.user_id, 'debit', v_discount_share, v_group.currency, 'Bonus Enchères - Intérêts redistribués de l''enchère remportée par ' || v_beneficiary_name),
        (v_transaction_id || '_share_' || v_member.user_id || '_cr', v_transaction_id, v_idempotency_key, 'user_wallet:' || v_member.user_id, 'tontine_group:' || p_group_id, 'credit', v_discount_share, v_group.currency, 'Bonus Enchères - Intérêts redistribués de l''enchère remportée par ' || v_beneficiary_name);

      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (v_member.user_id, 'Intérêts d''enchère reçus !', 'Vous avez reçu un bonus de ' || v_discount_share || ' ' || v_group.currency || ' redistribué suite à l''enchère remportée par ' || v_beneficiary_name || '.', 'payout', '/group/' || p_group_id);
    END LOOP;
  END IF;

  SELECT payout_position INTO v_beneficiary_position FROM public.group_members
  WHERE group_id = p_group_id AND user_id = p_beneficiary_id;
  SELECT user_id INTO v_slot_holder FROM public.group_members
  WHERE group_id = p_group_id AND payout_position = v_group.current_payout_index;

  IF v_slot_holder IS DISTINCT FROM p_beneficiary_id AND v_slot_holder IS NOT NULL THEN
    UPDATE public.group_members SET payout_position = v_beneficiary_position WHERE group_id = p_group_id AND user_id = v_slot_holder;
    UPDATE public.group_members SET payout_position = v_group.current_payout_index WHERE group_id = p_group_id AND user_id = p_beneficiary_id;
  END IF;

  v_next_index := (v_group.current_payout_index + 1) % v_num_members;
  v_next_date := (v_group.next_payout_date::timestamptz + CASE v_group.frequency
    WHEN 'daily' THEN interval '1 day'
    WHEN 'weekly' THEN interval '7 days'
    WHEN 'bi-weekly' THEN interval '14 days'
    ELSE interval '30 days' END)::date;

  UPDATE public.groups SET current_payout_index = v_next_index, next_payout_date = v_next_date, drawn_beneficiary_id = NULL, updated_at = now()
  WHERE id = p_group_id;

  INSERT INTO public.payouts (group_id, user_id, amount, discount_amount, currency, cycle, transaction_id)
  VALUES (p_group_id, p_beneficiary_id, v_beneficiary_payout, p_discount_amount, v_group.currency, v_group.current_payout_index + 1, v_transaction_id);

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (p_beneficiary_id, 'Fonds de tontine reçus !', 'Félicitations ! Vous avez reçu votre payout de ' || v_beneficiary_payout || ' ' || v_group.currency || ' pour le cycle ' || (v_group.current_payout_index + 1) || '.', 'payout', '/group/' || p_group_id);

  INSERT INTO public.audit_logs (user_id, action, details, ip, device, status, idempotency_key)
  VALUES (p_admin_user_id, 'payout_disbursement', 'Décaissement de tontine pour le groupe [' || v_group.name || '] : ' || v_beneficiary_name || ' reçoit ' || v_beneficiary_payout || ' ' || v_group.currency || ' (Rabais: ' || p_discount_amount || ', Commission: ' || v_fee || ')', '197.221.34.8', 'Système Tontine', 'success', v_idempotency_key);

  INSERT INTO public.messages (group_id, user_id, user_name, is_system, content)
  VALUES (p_group_id, null, 'Système Tontine', true, CASE WHEN p_discount_amount > 0
    THEN 'Félicitations à ' || v_beneficiary_name || ' qui remporte l''enchère et encaisse un payout net de ' || v_beneficiary_payout || ' ' || v_group.currency || ' ! Un rabais de ' || p_discount_amount || ' ' || v_group.currency || ' a été redistribué équitablement entre les autres membres.'
    ELSE 'Félicitations à ' || v_beneficiary_name || ' qui encaisse un payout de ' || v_beneficiary_payout || ' ' || v_group.currency || ' pour ce cycle !' END);

  INSERT INTO public.idempotency_keys (key, transaction_id, user_id, amount, action_type)
  VALUES (v_idempotency_key, v_transaction_id, p_beneficiary_id, v_beneficiary_payout, 'payout_disbursement');

  RETURN jsonb_build_object('success', true, 'message', 'Décaissement de ' || v_beneficiary_payout || ' ' || v_group.currency || ' exécuté avec succès.', 'transactionId', v_transaction_id, 'fee', v_fee);
EXCEPTION WHEN others THEN
  INSERT INTO public.audit_logs (user_id, action, details, ip, device, status)
  VALUES (p_admin_user_id, 'payout_disbursement', 'ÉCHEC : ' || sqlerrm, '197.221.34.8', 'Système Tontine', 'failure');
  RETURN jsonb_build_object('success', false, 'message', sqlerrm);
END;
$$;

REVOKE ALL ON FUNCTION public.execute_payout_disbursement(uuid, uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_payout_disbursement(uuid, uuid, uuid, numeric) TO authenticated, service_role;
