-- ============================================================================
-- 0038 — Corrections de sécurité issues du test d'intrusion du 5 novembre 2026
-- ============================================================================
-- Chaque faille ci-dessous a été reproduite sur le schéma rejoué, avec les seuls
-- droits d'un compte connecté. À exécuter après 0036 et 0037.
--
--  1. Distribution : le pot était calculé (cotisation × membres) sans vérifier
--     qu'il avait été réuni. Un organisateur créditait son portefeuille à partir
--     de rien, puis pouvait retirer en vrai. Le pot vient désormais du grand
--     livre, et les espèces déclarées n'arrivent jamais sur un portefeuille.
--  2. Distribution : l'organisateur pouvait se désigner à chaque tour et garder
--     les cotisations des autres.
--  3. Cotisations : un membre pouvait réduire son montant ou effacer sa pénalité.
--  4. Profil : créer son profil avec un solde et le rôle admin était possible
--     pour un compte sans profil (par exemple après une suppression par un admin).
--  5. Retrait : la fonction SQL ne vérifiait pas le code PIN. Une session volée
--     suffisait à déposer une demande. Elle est maintenant réservée au serveur.
--  6. Code PIN : un changement bloque l'envoi automatique pendant 24 h et prévient
--     la personne, pour limiter les dégâts d'une session volée.
--  7. Admin : le solde se modifiait sans trace. Tout passe par admin_adjust_wallet,
--     avec un motif, dans le grand livre, et jamais sur son propre compte.
--  8. Admin : supprimer un profil effaçait son argent et son historique.
--  9. Cercles : un membre pouvait quitter, ou être retiré, après le début des
--     versements, ce qui réduisait le pot et laissait l'argent des autres.
-- 10. Droits : tâches internes appelables par tout le monde, journal des rôles,
--     suppression de documents de cercle par n'importe quel membre.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1 et 2. Distribution
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_payout_disbursement(p_group_id uuid, p_beneficiary_id uuid, p_admin_user_id uuid, p_discount_amount numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_wallet_funds numeric;
  v_cash_funds numeric;
  v_cash_part numeric := 0;
  v_wallet_payout numeric;
  v_received integer;
  v_min_received integer;
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

  -- Personne ne reçoit deux fois avant que tout le monde ait reçu une fois.
  SELECT count(*) INTO v_received FROM public.payouts
   WHERE group_id = p_group_id AND user_id = p_beneficiary_id;
  SELECT min(s.n) INTO v_min_received FROM (
    SELECT count(p.id) AS n
    FROM public.group_members gm
    LEFT JOIN public.payouts p ON p.group_id = gm.group_id AND p.user_id = gm.user_id
    WHERE gm.group_id = p_group_id AND gm.status = 'active'
    GROUP BY gm.user_id
  ) s;
  IF v_received > coalesce(v_min_received, 0) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce membre a déjà reçu sa part : les autres membres doivent recevoir la leur d''abord.');
  END IF;

  -- L'argent réellement réuni, d'après le grand livre :
  --   v_wallet_funds : venu des portefeuilles, donc de l'argent réel chez nous ;
  --   v_cash_funds   : déclaré en espèces, entre les mains de l'organisateur.
  SELECT
    coalesce(sum(CASE
      WHEN type = 'credit' AND counterparty LIKE 'user_wallet:%' THEN amount
      WHEN type = 'debit' AND (counterparty LIKE 'user_wallet:%' OR counterparty LIKE 'platform_wallet:%') THEN -amount
      ELSE 0 END), 0),
    coalesce(sum(CASE
      WHEN type = 'credit' AND counterparty LIKE 'external_cash:%' THEN amount
      WHEN type = 'debit' AND counterparty LIKE 'cash_handover:%' THEN -amount
      ELSE 0 END), 0)
    INTO v_wallet_funds, v_cash_funds
  FROM public.double_entry_ledger
  WHERE account = 'tontine_group:' || p_group_id;

  v_wallet_funds := greatest(v_wallet_funds, 0);
  v_cash_funds := greatest(v_cash_funds, 0);

  IF v_wallet_funds + v_cash_funds < v_total_pot THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Pot incomplet : ' || (v_wallet_funds + v_cash_funds) || ' ' || v_group.currency
        || ' réunis sur ' || v_total_pot || '. Tous les membres doivent avoir cotisé avant la distribution.'
    );
  END IF;

  -- Les espèces déclarées n'arrivent JAMAIS sur un portefeuille : aucun argent
  -- réel n'est entré, et ce solde pourrait être retiré en vrai. Cette part est
  -- remise en main propre par l'organisateur.
  v_cash_part := greatest(v_total_pot - v_wallet_funds, 0);

  IF v_cash_part > 0 AND p_discount_amount > 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Pas de rabais sur un pot réuni en espèces.');
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

  -- La commission ne peut venir que de l'argent réel.
  v_fee := least(v_fee, v_total_pot - v_cash_part);

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

  v_wallet_payout := v_beneficiary_payout - v_cash_part;

  IF v_wallet_payout > 0 THEN
  UPDATE public.profiles SET wallet_balance = wallet_balance + v_wallet_payout, updated_at = now()
  WHERE id = p_beneficiary_id;

  INSERT INTO public.double_entry_ledger (id, transaction_id, idempotency_key, account, counterparty, type, amount, currency, description)
  VALUES
    (v_transaction_id || '_benef_dr', v_transaction_id, v_idempotency_key, 'tontine_group:' || p_group_id, 'user_wallet:' || p_beneficiary_id, 'debit', v_wallet_payout, v_group.currency, v_description),
    (v_transaction_id || '_benef_cr', v_transaction_id, v_idempotency_key, 'user_wallet:' || p_beneficiary_id, 'tontine_group:' || p_group_id, 'credit', v_wallet_payout, v_group.currency, v_description);

  INSERT INTO public.wallet_transactions (user_id, amount, type, description, status, reference)
  VALUES (p_beneficiary_id, v_wallet_payout, 'payout_credit', v_description, 'completed', v_idempotency_key);
  END IF;

  IF v_cash_part > 0 THEN
    INSERT INTO public.double_entry_ledger (id, transaction_id, idempotency_key, account, counterparty, type, amount, currency, description)
    VALUES
      (v_transaction_id || '_cash_dr', v_transaction_id, v_idempotency_key, 'tontine_group:' || p_group_id, 'cash_handover:' || p_beneficiary_id, 'debit', v_cash_part, v_group.currency, 'Part en espèces, remise par l''organisateur'),
      (v_transaction_id || '_cash_cr', v_transaction_id, v_idempotency_key, 'cash_handover:' || p_beneficiary_id, 'tontine_group:' || p_group_id, 'credit', v_cash_part, v_group.currency, 'Part en espèces, remise par l''organisateur');

    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (p_beneficiary_id, 'Part en espèces à recevoir',
      v_cash_part || ' ' || v_group.currency || ' de votre tour ont été cotisés en espèces : l''organisateur du cercle vous les remet en main propre. Ils n''arrivent pas sur votre portefeuille.',
      'payout', '/group/' || p_group_id);
  END IF;

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
    ELSE interval '1 month' END)::date;

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

  RETURN jsonb_build_object('success', true, 'cashPart', v_cash_part, 'message', 'Décaissement de ' || v_beneficiary_payout || ' ' || v_group.currency || ' exécuté avec succès.', 'transactionId', v_transaction_id, 'fee', v_fee);
EXCEPTION WHEN others THEN
  INSERT INTO public.audit_logs (user_id, action, details, ip, device, status)
  VALUES (p_admin_user_id, 'payout_disbursement', 'ÉCHEC : ' || sqlerrm, 'non disponible', 'Système Tontine', 'failure');
  RETURN jsonb_build_object('success', false, 'message', sqlerrm);
END;
$function$;


-- ----------------------------------------------------------------------------
-- 3. Cotisations : ce qu'un membre peut encore changer sur la sienne
-- ----------------------------------------------------------------------------
-- Déclarer un paiement en attente de validation, et marquer son propre retard.
create or replace function public.prevent_self_settling_contribution()
returns trigger
language plpgsql security invoker set search_path = public
as $$
declare
  v_allowed boolean := current_user not in ('authenticated', 'anon');
begin
  if v_allowed or public.is_group_creator(new.group_id) or public.is_admin() then
    return new;
  end if;

  if (new.status = 'paid' and old.status is distinct from 'paid')
     or (new.penalty_status = 'paid' and old.penalty_status is distinct from 'paid')
  then
    raise exception 'Seule l''organisatrice du cercle peut valider un paiement.';
  end if;

  if new.amount is distinct from old.amount
     or new.user_id is distinct from old.user_id
     or new.group_id is distinct from old.group_id
     or new.period is distinct from old.period
     or new.date is distinct from old.date
     or coalesce(new.penalty_applied, 0) < coalesce(old.penalty_applied, 0)
     or (old.penalty_status = 'pending' and new.penalty_status is distinct from 'pending')
     or old.status = 'paid'
  then
    raise exception 'Cette cotisation ne peut pas être modifiée.';
  end if;

  return new;
end;
$$;


-- ----------------------------------------------------------------------------
-- 4 et 7. Profils : création et colonnes sensibles
-- ----------------------------------------------------------------------------
alter table public.profiles add column if not exists pin_changed_at timestamptz;

create or replace function public.prevent_privileged_profile_insert()
returns trigger
language plpgsql security invoker set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  -- Un compte qui crée son propre profil part toujours de zéro.
  new.role := 'user';
  new.wallet_balance := 0;
  new.total_saved := 0;
  new.reputation_score := 75;
  new.groups_joined := 0;
  new.kyc_level := 0;
  new.kyc_verified_at := null;
  new.bank_tier := 'none';
  new.bank_subscription_expires_at := null;
  new.subscription_plan := null;
  new.subscription_expires_at := null;
  new.security_pin_hash := null;
  return new;
end;
$$;

drop trigger if exists trg_prevent_privileged_profile_insert on public.profiles;
create trigger trg_prevent_privileged_profile_insert
  before insert on public.profiles
  for each row execute function public.prevent_privileged_profile_insert();

create or replace function public.prevent_privileged_profile_changes()
returns trigger
language plpgsql security invoker set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.wallet_balance is distinct from old.wallet_balance
     or new.total_saved is distinct from old.total_saved
     or new.pin_changed_at is distinct from old.pin_changed_at
  then
    raise exception 'Le solde ne se modifie pas directement : utilisez l''ajustement tracé.';
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.reputation_score is distinct from old.reputation_score
     or new.groups_joined is distinct from old.groups_joined
     or new.kyc_level is distinct from old.kyc_level
     or new.kyc_verified_at is distinct from old.kyc_verified_at
     or new.bank_tier is distinct from old.bank_tier
     or new.bank_subscription_expires_at is distinct from old.bank_subscription_expires_at
     or new.subscription_plan is distinct from old.subscription_plan
     or new.subscription_expires_at is distinct from old.subscription_expires_at
     or new.pin_failed_attempts is distinct from old.pin_failed_attempts
     or new.pin_locked_until is distinct from old.pin_locked_until
  then
    raise exception 'Ces informations ne peuvent pas être modifiées directement.';
  end if;

  return new;
end;
$$;

-- Ajustement de solde par un admin : motif obligatoire, grand livre, historique
-- de la personne, notification. Jamais sur son propre compte.
create or replace function public.admin_adjust_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_result jsonb;
  v_reason text := trim(coalesce(p_reason, ''));
  v_wallet text := 'user_wallet:' || p_user_id::text;
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'message', 'Réservé aux administrateurs.');
  end if;
  if p_user_id = auth.uid() then
    return jsonb_build_object('success', false, 'message', 'Un autre administrateur doit ajuster votre propre solde.');
  end if;
  if p_amount is null or p_amount = 0 then
    return jsonb_build_object('success', false, 'message', 'Le montant ne peut pas être nul.');
  end if;
  if char_length(v_reason) < 5 then
    return jsonb_build_object('success', false, 'message', 'Indiquez un motif précis.');
  end if;
  if coalesce(char_length(p_idempotency_key), 0) < 8 then
    return jsonb_build_object('success', false, 'message', 'Requête invalide.');
  end if;

  v_result := public.execute_financial_transaction(
    p_idempotency_key := 'admin_adjust_' || p_idempotency_key,
    p_user_id := p_user_id,
    p_amount := abs(p_amount),
    p_currency := 'FCFA',
    p_description := 'Ajustement administrateur : ' || v_reason,
    p_action_type := 'admin_adjustment',
    p_debit_account := case when p_amount > 0 then 'admin_adjustment' else v_wallet end,
    p_credit_account := case when p_amount > 0 then v_wallet else 'admin_adjustment' end
  );

  if coalesce((v_result->>'success')::boolean, false) then
    insert into public.notifications (user_id, title, message, type)
    values (p_user_id, 'Solde ajusté',
            'Votre solde a été ' || case when p_amount > 0 then 'crédité' else 'débité' end || ' de ' || abs(p_amount) || ' FCFA par notre équipe. Motif : ' || v_reason,
            'system');
  end if;

  return v_result;
end;
$$;

revoke all on function public.admin_adjust_wallet(uuid, numeric, text, text) from public, anon;
grant execute on function public.admin_adjust_wallet(uuid, numeric, text, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 5. Retrait : réservé au serveur, qui vérifie le code PIN
-- ----------------------------------------------------------------------------
drop function if exists public.request_wallet_withdrawal(text, numeric, text, text, text, text);
drop function if exists public.request_wallet_withdrawal(text, numeric, text, text, text, text, boolean, numeric);

create or replace function public.request_wallet_withdrawal_for(
  p_user_id uuid,
  p_idempotency_key text,
  p_amount numeric,
  p_payment_method text,
  p_phone text,
  p_method_label text,
  p_ip text default null,
  p_fee_on_top boolean default false,
  p_expected_fee numeric default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_caller uuid := p_user_id;
  v_wallet_account text;
  v_balance numeric;
  v_transaction_id text;
  v_withdrawal_id uuid;
  v_description text;
  v_existing record;
  v_settings record;
  v_fee numeric := 0;
  v_debit numeric;
  v_payout numeric;
begin
  if v_caller is null then
    return jsonb_build_object('success', false, 'message', 'Vous devez être connectée pour demander un retrait.');
  end if;

  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('success', false, 'message', 'Le montant doit être strictement supérieur à zéro.');
  end if;

  if coalesce(trim(p_phone), '') = '' then
    return jsonb_build_object('success', false, 'message', 'Le numéro bénéficiaire est obligatoire.');
  end if;

  -- Idempotence : un double envoi ne débite jamais deux fois.
  select * into v_existing from public.idempotency_keys where key = p_idempotency_key;
  if found then
    if v_existing.user_id is distinct from v_caller then
      return jsonb_build_object('success', false, 'message', 'Demande non autorisée.');
    end if;
    select id into v_withdrawal_id from public.wallet_transactions
     where withdraw_idempotency_key = p_idempotency_key and user_id = v_caller;
    return jsonb_build_object(
      'success', true, 'message', 'Demande déjà enregistrée.',
      'transactionId', v_existing.transaction_id,
      'withdrawalId', v_withdrawal_id,
      'replayed', true
    );
  end if;

  -- Même formule que computeWithdrawFee (src/lib/platformSettings.ts).
  select withdraw_fee_enabled, withdraw_fee_percent, withdraw_fee_fixed, withdraw_fee_min
    into v_settings
    from public.platform_settings where id = 1;
  if found and v_settings.withdraw_fee_enabled then
    v_fee := greatest(
      ceil(p_amount * v_settings.withdraw_fee_percent / 100 + v_settings.withdraw_fee_fixed),
      v_settings.withdraw_fee_min
    );
  end if;

  if p_expected_fee is not null and p_expected_fee <> v_fee then
    return jsonb_build_object(
      'success', false, 'feeChanged', true,
      'message', 'Les frais ont changé : ' || v_fee || ' FCFA. Rechargez la page et vérifiez le montant.'
    );
  end if;

  if coalesce(p_fee_on_top, false) then
    v_debit := p_amount + v_fee;
    v_payout := p_amount;
  else
    v_debit := p_amount;
    v_payout := p_amount - v_fee;
  end if;

  if v_payout <= 0 then
    return jsonb_build_object('success', false, 'message', 'Montant trop faible une fois les frais retenus.');
  end if;

  v_wallet_account := 'user_wallet:' || v_caller::text;

  select wallet_balance into v_balance from public.profiles where id = v_caller for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Profil introuvable.');
  end if;

  if v_balance < v_debit then
    return jsonb_build_object('success', false, 'message', case
      when v_fee > 0 then 'Solde insuffisant : il faut ' || v_debit || ' FCFA, frais compris.'
      else 'Solde insuffisant dans votre portefeuille.'
    end);
  end if;

  v_transaction_id := gen_random_uuid()::text;
  v_description := 'Retrait vers ' || coalesce(p_method_label, p_payment_method) || ' (' || p_phone || ')'
    || case when v_fee > 0 then ' dont ' || v_fee || ' FCFA de frais' else '' end;

  update public.profiles
     set wallet_balance = v_balance - v_debit, updated_at = now()
   where id = v_caller;

  insert into public.double_entry_ledger (id, transaction_id, idempotency_key, account, counterparty, type, amount, currency, description)
  values
    (v_transaction_id || '_dr', v_transaction_id, p_idempotency_key, v_wallet_account, 'mobile_money_payout_pending', 'debit', v_debit, 'FCFA', v_description),
    (v_transaction_id || '_cr', v_transaction_id, p_idempotency_key, 'mobile_money_payout_pending', v_wallet_account, 'credit', v_debit, 'FCFA', v_description);

  insert into public.idempotency_keys (key, transaction_id, user_id, amount, action_type)
  values (p_idempotency_key, v_transaction_id, v_caller, v_debit, 'wallet_withdrawal');

  insert into public.wallet_transactions (user_id, amount, type, description, status, reference, payment_method, withdraw_idempotency_key, payout_amount, withdraw_fee)
  values (v_caller, -v_debit, 'withdraw', v_description, 'pending', p_phone, p_payment_method, p_idempotency_key, v_payout, v_fee)
  returning id into v_withdrawal_id;

  insert into public.audit_logs (user_id, action, details, ip, device, status, idempotency_key)
  values (v_caller, 'wallet_withdrawal',
          v_description || ' | Débit [' || v_wallet_account || '] / Crédit [mobile_money_payout_pending] de ' || v_debit || ' FCFA | À envoyer : ' || v_payout || ' FCFA',
          coalesce(p_ip, 'non disponible'), 'Application', 'success', p_idempotency_key);

  return jsonb_build_object(
    'success', true, 'message', 'Demande de retrait enregistrée.',
    'transactionId', v_transaction_id,
    'withdrawalId', v_withdrawal_id,
    'replayed', false
  );
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;


revoke all on function public.request_wallet_withdrawal_for(uuid, text, numeric, text, text, text, text, boolean, numeric) from public, anon, authenticated;
grant execute on function public.request_wallet_withdrawal_for(uuid, text, numeric, text, text, text, text, boolean, numeric) to service_role;

-- Les anciennes versions de l'app appellent encore cette fonction directement :
-- elles reçoivent un message clair, sans aucun débit.
create function public.request_wallet_withdrawal(
  p_idempotency_key text default null,
  p_amount numeric default null,
  p_payment_method text default null,
  p_phone text default null,
  p_method_label text default null,
  p_ip text default null
)
returns jsonb
language sql stable set search_path = public
as $$
  select jsonb_build_object('success', false, 'message', 'Mettez à jour l''application pour effectuer un retrait.');
$$;

revoke all on function public.request_wallet_withdrawal(text, numeric, text, text, text, text) from public, anon;
grant execute on function public.request_wallet_withdrawal(text, numeric, text, text, text, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 6. Code PIN : trace, alerte, délai
-- ----------------------------------------------------------------------------
create or replace function public.set_user_pin(p_user_id uuid, p_new_pin text)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_had_pin boolean;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Non autorisé.';
  end if;

  if p_new_pin !~ '^[0-9]{4}$' then
    raise exception 'Le code PIN doit comporter exactement 4 chiffres.';
  end if;

  -- 0000 est public : le remplacer ne déclenche ni délai ni alerte, on veut au
  -- contraire que tout le monde le fasse.
  if p_new_pin = '0000' then
    raise exception 'Choisissez un autre code que 0000.';
  end if;

  select security_pin_hash is not null into v_had_pin from public.profiles where id = p_user_id;

  perform set_config('eganye.allow_pin_hash_write', 'on', true);

  update public.profiles
  set security_pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf')),
      pin_failed_attempts = 0,
      pin_locked_until = null,
      pin_changed_at = case when v_had_pin then now() else pin_changed_at end
  where id = p_user_id;

  insert into public.audit_logs (user_id, action, details, ip, device, status)
  values (p_user_id, 'withdrawal_pin_changed',
          case when v_had_pin then 'Code PIN de retrait modifié.' else 'Premier code PIN de retrait défini.' end,
          'non disponible', 'Application', 'success');

  if v_had_pin then
    insert into public.notifications (user_id, title, message, type)
    values (p_user_id, 'Code PIN modifié',
            'Votre code PIN de retrait vient d''être modifié. Vos retraits passent par notre équipe pendant 24 h. Si ce n''est pas vous, contactez-nous tout de suite et changez votre mot de passe.',
            'system');
  end if;
end;
$$;


-- ----------------------------------------------------------------------------
-- 8. Suppression d'un profil par un admin
-- ----------------------------------------------------------------------------
-- La suppression en cascade efface l'historique financier, que la loi impose de
-- garder. Les comptes avec de l'argent ou un historique passent par la suppression
-- de compte, qui vérifie tout et anonymise (admin_request_account_deletion).
create or replace function public.prevent_profile_delete_with_money()
returns trigger
language plpgsql security invoker set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return old;
  end if;
  if old.wallet_balance <> 0
     or exists (select 1 from public.personal_vaults where user_id = old.id and balance <> 0)
     or exists (select 1 from public.wallet_transactions where user_id = old.id)
  then
    raise exception 'Ce compte a de l''argent ou un historique financier : utilisez la suppression de compte.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_prevent_profile_delete_with_money on public.profiles;
create trigger trg_prevent_profile_delete_with_money
  before delete on public.profiles
  for each row execute function public.prevent_profile_delete_with_money();


-- ----------------------------------------------------------------------------
-- 9. Membres d'un cercle en cours
-- ----------------------------------------------------------------------------
create or replace function public.prevent_member_exit_after_money()
returns trigger
language plpgsql security invoker set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and (old.status <> 'active' or new.status = 'active') then
    return new;
  end if;
  if old.status = 'active'
     and exists (select 1 from public.groups g where g.id = old.group_id and g.status = 'active')
     and (exists (select 1 from public.contributions c where c.group_id = old.group_id and c.status = 'paid')
          or exists (select 1 from public.payouts p where p.group_id = old.group_id))
  then
    raise exception 'Le cercle a commencé : un membre ne peut plus partir. Contactez le support.';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_prevent_member_exit_after_money on public.group_members;
create trigger trg_prevent_member_exit_after_money
  before update or delete on public.group_members
  for each row execute function public.prevent_member_exit_after_money();


-- ----------------------------------------------------------------------------
-- 10. Droits
-- ----------------------------------------------------------------------------
-- Tâche planifiée : elle tourne sans utilisateur. Personne n'a à la lancer.
revoke all on function public.process_due_contributions() from public, anon, authenticated;

do $$
declare
  v_fn regprocedure;
begin
  for v_fn in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'make_credit_offer'
  loop
    execute format('revoke all on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated', v_fn);
  end loop;
end $$;

-- Toute promotion ou rétrogradation d'un admin laisse une trace.
create or replace function public.log_role_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    insert into public.audit_logs (user_id, action, details, ip, device, status)
    values (new.id, 'role_changed',
            'Rôle ' || old.role || ' -> ' || new.role || ' par ' || coalesce(auth.uid()::text, 'système'),
            'non disponible', 'Application', 'success');
  end if;
  return new;
end;
$$;

revoke all on function public.log_role_change() from public, anon, authenticated;

drop trigger if exists trg_log_role_change on public.profiles;
create trigger trg_log_role_change
  after update of role on public.profiles
  for each row execute function public.log_role_change();

-- Documents de cercle : plus de suppression par n'importe quel membre.
drop policy if exists "group_documents_delete_member_or_admin" on public.group_documents;
do $$
declare
  v_policy text;
begin
  for v_policy in
    select polname from pg_policy
    where polrelid = 'public.group_documents'::regclass and polcmd = 'd'
  loop
    execute format('drop policy %I on public.group_documents', v_policy);
  end loop;
end $$;

create policy "group_documents_delete_owner_creator_or_admin" on public.group_documents
  for delete using (uploader_id = auth.uid() or public.is_group_creator(group_id) or public.is_admin());
