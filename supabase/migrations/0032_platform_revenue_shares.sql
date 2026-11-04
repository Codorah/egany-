-- ============================================================================
-- 0032 — RÉPARTITION DES REVENUS ENTRE LES ADMINISTRATEURS
-- ============================================================================
-- Jusqu'ici la commission de décaissement allait dans UN SEUL portefeuille
-- (platform_settings.platform_wallet_id). Les deux administrateurs veulent la
-- partager : 70 % / 30 %, chacun retirant sa part depuis son propre
-- portefeuille avec le circuit de retrait habituel.
--
-- Fonctionnement :
--   - table platform_revenue_shares : un administrateur = une part en % ;
--   - set_platform_revenue_shares() : réservée aux administrateurs, refuse
--     tout total différent de 100 % ou tout compte qui n'est pas admin ;
--   - execute_payout_disbursement() : chaque commission est coupée selon ces
--     parts et créditée directement sur le portefeuille de chacun (grand
--     livre double-entrée + historique du portefeuille). Le reste de la
--     division (arrondi au franc) va à la plus grosse part : pas un franc
--     perdu. Sans parts définies, l'ancien comportement (platform_wallet_id)
--     est conservé tel quel.
--   - un administrateur qui reçoit lui-même le pot ne paie pas de commission
--     (comme avant pour le portefeuille de la plateforme).
-- Reprend 0018 à l'identique hors ce calcul.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_revenue_shares (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  share_percent numeric NOT NULL CHECK (share_percent > 0 AND share_percent <= 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_revenue_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "revenue_shares_select_admin" ON public.platform_revenue_shares;
CREATE POLICY "revenue_shares_select_admin" ON public.platform_revenue_shares
  FOR SELECT USING (public.is_admin());
-- Aucune policy d'écriture : on ne modifie que par set_platform_revenue_shares.

CREATE OR REPLACE FUNCTION public.set_platform_revenue_shares(p_shares jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_id uuid;
  v_pct numeric;
  v_total numeric := 0;
  v_seen uuid[] := '{}';
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Non autorisé.');
  END IF;
  IF jsonb_typeof(p_shares) <> 'array' OR jsonb_array_length(p_shares) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Indiquez au moins une part.');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_shares) LOOP
    v_id := (v_item->>'profileId')::uuid;
    v_pct := (v_item->>'percent')::numeric;
    IF v_pct IS NULL OR v_pct <= 0 OR v_pct > 100 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Chaque part doit être comprise entre 0 et 100 %.');
    END IF;
    IF v_id = ANY(v_seen) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Un administrateur apparaît deux fois.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_id AND role = 'admin') THEN
      RETURN jsonb_build_object('success', false, 'message', 'Seul un administrateur peut recevoir une part.');
    END IF;
    v_seen := v_seen || v_id;
    v_total := v_total + v_pct;
  END LOOP;

  IF v_total <> 100 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le total doit faire exactement 100 % (actuellement ' || v_total || ' %).');
  END IF;

  DELETE FROM public.platform_revenue_shares;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_shares) LOOP
    INSERT INTO public.platform_revenue_shares (profile_id, share_percent)
    VALUES ((v_item->>'profileId')::uuid, (v_item->>'percent')::numeric);
  END LOOP;

  INSERT INTO public.audit_logs (user_id, action, details, ip, device, status)
  VALUES (auth.uid(), 'revenue_shares_update', 'Répartition des revenus mise à jour : ' || p_shares::text, 'non disponible', 'Admin', 'success');

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_platform_revenue_shares(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_platform_revenue_shares(jsonb) TO authenticated, service_role;

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
  v_has_shares boolean;
  v_beneficiary_is_partner boolean;
  v_share record;
  v_part numeric;
  v_distributed numeric := 0;
  v_top_profile uuid;
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

  IF NOT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_beneficiary_id AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le bénéficiaire n''est pas membre actif de ce cercle.');
  END IF;

  SELECT count(*) INTO v_num_members FROM public.group_members
  WHERE group_id = p_group_id AND status = 'active';

  v_total_pot := v_group.contribution_amount * v_num_members;
  IF p_discount_amount < 0 OR p_discount_amount >= v_total_pot THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le montant du rabais est invalide.');
  END IF;
  IF p_discount_amount > 0 AND v_num_members < 2 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Un rabais d''enchère suppose au moins deux membres actifs.');
  END IF;

  v_idempotency_key := 'payout_' || p_group_id::text || '_cycle_' || v_group.current_payout_index::text;
  IF EXISTS (SELECT 1 FROM public.idempotency_keys WHERE key = v_idempotency_key) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Décaissement déjà exécuté pour ce cycle (Idempotent).');
  END IF;

  SELECT payout_fee_mode, payout_fee_percent, platform_wallet_id
    INTO v_fee_mode, v_fee_percent, v_platform_wallet
  FROM public.platform_settings WHERE id = 1;

  SELECT EXISTS (SELECT 1 FROM public.platform_revenue_shares) INTO v_has_shares;
  SELECT EXISTS (SELECT 1 FROM public.platform_revenue_shares WHERE profile_id = p_beneficiary_id)
    INTO v_beneficiary_is_partner;

  IF (v_has_shares AND NOT v_beneficiary_is_partner)
     OR (NOT v_has_shares AND v_platform_wallet IS NOT NULL AND v_platform_wallet <> p_beneficiary_id) THEN
    IF v_fee_mode = 'contribution_share' THEN
      v_fee := floor(v_group.contribution_amount);
      v_fee_label := 'une part de cotisation';
    ELSIF v_fee_mode = 'percent' AND coalesce(v_fee_percent, 0) > 0 THEN
      v_fee := floor(v_total_pot * v_fee_percent / 100);
      v_fee_label := v_fee_percent || ' %';
    END IF;
  END IF;

  v_beneficiary_payout := v_total_pot - p_discount_amount - v_fee;
  IF v_beneficiary_payout <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Commission et rabais dépassent le pot : décaissement annulé.');
  END IF;

  IF p_discount_amount > 0 THEN
    v_discount_share := floor(p_discount_amount / (v_num_members - 1));
    v_beneficiary_payout := v_beneficiary_payout + (p_discount_amount - v_discount_share * (v_num_members - 1));
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

  INSERT INTO public.wallet_transactions (user_id, amount, type, description, status, reference)
  VALUES (p_beneficiary_id, v_beneficiary_payout, 'payout_credit', v_description, 'completed', v_idempotency_key);

  IF v_fee > 0 THEN
    IF v_has_shares THEN
      -- Le reste de la division va à la plus grosse part (puis à l'ordre des
      -- identifiants, pour que le choix soit toujours le même).
      SELECT profile_id INTO v_top_profile FROM public.platform_revenue_shares
      ORDER BY share_percent DESC, profile_id LIMIT 1;

      SELECT coalesce(sum(floor(v_fee * share_percent / 100)), 0) INTO v_distributed
      FROM public.platform_revenue_shares;

      FOR v_share IN SELECT profile_id, share_percent FROM public.platform_revenue_shares ORDER BY profile_id LOOP
        v_part := floor(v_fee * v_share.share_percent / 100);
        IF v_share.profile_id = v_top_profile THEN
          v_part := v_part + (v_fee - v_distributed);
        END IF;
        CONTINUE WHEN v_part <= 0;

        UPDATE public.profiles SET wallet_balance = wallet_balance + v_part, updated_at = now()
        WHERE id = v_share.profile_id;

        INSERT INTO public.double_entry_ledger (id, transaction_id, idempotency_key, account, counterparty, type, amount, currency, description)
        VALUES
          (v_transaction_id || '_fee_' || v_share.profile_id || '_dr', v_transaction_id, v_idempotency_key, 'tontine_group:' || p_group_id, 'platform_wallet:' || v_share.profile_id, 'debit', v_part, v_group.currency, 'Commission plateforme (' || v_fee_label || '), part de ' || v_share.share_percent || ' %'),
          (v_transaction_id || '_fee_' || v_share.profile_id || '_cr', v_transaction_id, v_idempotency_key, 'platform_wallet:' || v_share.profile_id, 'tontine_group:' || p_group_id, 'credit', v_part, v_group.currency, 'Commission plateforme (' || v_fee_label || '), part de ' || v_share.share_percent || ' %');

        INSERT INTO public.wallet_transactions (user_id, amount, type, description, status, reference)
        VALUES (v_share.profile_id, v_part, 'payout_credit', 'Commission plateforme, part de ' || v_share.share_percent || ' % — cercle ' || v_group.name, 'completed', v_idempotency_key || '_fee_' || v_share.profile_id);
      END LOOP;
    ELSE
      UPDATE public.profiles SET wallet_balance = wallet_balance + v_fee, updated_at = now()
      WHERE id = v_platform_wallet;

      INSERT INTO public.double_entry_ledger (id, transaction_id, idempotency_key, account, counterparty, type, amount, currency, description)
      VALUES
        (v_transaction_id || '_fee_dr', v_transaction_id, v_idempotency_key, 'tontine_group:' || p_group_id, 'platform_wallet:' || v_platform_wallet, 'debit', v_fee, v_group.currency, 'Commission plateforme (' || v_fee_label || ') sur le pot de ' || v_total_pot || ' ' || v_group.currency),
        (v_transaction_id || '_fee_cr', v_transaction_id, v_idempotency_key, 'platform_wallet:' || v_platform_wallet, 'tontine_group:' || p_group_id, 'credit', v_fee, v_group.currency, 'Commission plateforme (' || v_fee_label || ') sur le pot de ' || v_total_pot || ' ' || v_group.currency);

      INSERT INTO public.wallet_transactions (user_id, amount, type, description, status, reference)
      VALUES (v_platform_wallet, v_fee, 'payout_credit', 'Commission plateforme (' || v_fee_label || ') — cercle ' || v_group.name, 'completed', v_idempotency_key);
    END IF;
  END IF;

  IF p_discount_amount > 0 AND v_discount_share > 0 THEN
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

      INSERT INTO public.wallet_transactions (user_id, amount, type, description, status, reference)
      VALUES (v_member.user_id, v_discount_share, 'payout_credit', 'Bonus Enchères — redistribué par ' || v_beneficiary_name, 'completed', v_idempotency_key || '_share_' || v_member.user_id);

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
  VALUES (p_admin_user_id, 'payout_disbursement', 'Décaissement de tontine pour le groupe [' || v_group.name || '] : ' || v_beneficiary_name || ' reçoit ' || v_beneficiary_payout || ' ' || v_group.currency || ' (Rabais: ' || p_discount_amount || ', Commission: ' || v_fee || ')', 'non disponible', 'Système Tontine', 'success', v_idempotency_key);

  INSERT INTO public.messages (group_id, user_id, user_name, is_system, content)
  VALUES (p_group_id, null, 'Système Tontine', true, CASE WHEN p_discount_amount > 0
    THEN 'Félicitations à ' || v_beneficiary_name || ' qui remporte l''enchère et encaisse un payout net de ' || v_beneficiary_payout || ' ' || v_group.currency || ' ! Un rabais de ' || p_discount_amount || ' ' || v_group.currency || ' a été redistribué équitablement entre les autres membres.'
    ELSE 'Félicitations à ' || v_beneficiary_name || ' qui encaisse un payout de ' || v_beneficiary_payout || ' ' || v_group.currency || ' pour ce cycle !' END);

  INSERT INTO public.idempotency_keys (key, transaction_id, user_id, amount, action_type)
  VALUES (v_idempotency_key, v_transaction_id, p_beneficiary_id, v_beneficiary_payout, 'payout_disbursement');

  RETURN jsonb_build_object('success', true, 'message', 'Décaissement de ' || v_beneficiary_payout || ' ' || v_group.currency || ' exécuté avec succès.', 'transactionId', v_transaction_id, 'fee', v_fee);
EXCEPTION WHEN others THEN
  INSERT INTO public.audit_logs (user_id, action, details, ip, device, status)
  VALUES (p_admin_user_id, 'payout_disbursement', 'ÉCHEC : ' || sqlerrm, 'non disponible', 'Système Tontine', 'failure');
  RETURN jsonb_build_object('success', false, 'message', sqlerrm);
END;
$$;

REVOKE ALL ON FUNCTION public.execute_payout_disbursement(uuid, uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_payout_disbursement(uuid, uuid, uuid, numeric) TO authenticated, service_role;
