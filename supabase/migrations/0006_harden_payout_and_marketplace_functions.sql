-- =====================================================================
-- 0006 — Verrouillage des fonctions financières exposées sans contrôle
-- d'accès, et clé d'idempotence stable pour repay_marketplace_credit
--
-- PROBLÈME CORRIGÉ (critique)
-- ---------------------------
-- execute_financial_transaction, execute_payout_disbursement et
-- assign_next_payout_position sont toutes trois SECURITY DEFINER,
-- accordées à `anon` ET `authenticated`, et n'effectuaient AUCUNE
-- vérification de l'appelant :
--
--   - execute_financial_transaction acceptait p_user_id, p_amount et
--     p_credit_account depuis le client sans jamais vérifier qui
--     appelait : n'importe qui (même sans être connecté) pouvait se
--     créditer, ou créditer n'importe qui.
--   - execute_payout_disbursement contourne complètement le ledger
--     protégé ci-dessus (elle écrit directement wallet_balance et les
--     lignes du grand livre) : n'importe qui pouvait décaisser le pot
--     complet de n'importe quel cercle vers le portefeuille de son
--     choix, de l'argent créé de toutes pièces, en boucle (l'index de
--     cycle avance à chaque appel réussi, ce qui débloque le suivant).
--   - assign_next_payout_position pouvait, de la même façon, réordonner
--     la file de payout de n'importe quel cercle.
--
-- Ces trois fonctions sont désormais réservées à l'appelant légitime
-- (soi-même / créatrice du cercle / admin / rôle service), à l'identique
-- de ce que fait déjà 0005 pour execute_financial_transaction.
--
-- Par ailleurs, repay_marketplace_credit calculait sa "clé d'idempotence"
-- à partir de extract(epoch from now()) à chaque appel : un rejeu réseau
-- de la même tentative de remboursement obtenait donc une clé différente
-- et repassait la garde d'idempotence, pouvant débiter deux fois le même
-- remboursement. Elle accepte maintenant une clé fournie par le client
-- (même schéma que le retrait dans Profile.tsx), stable tant que la
-- tentative n'a pas abouti.
--
-- Note : ces quatre fonctions vivent dans supabase/schema.sql (pas dans
-- une migration numérotée 0001-0005 comme execute_financial_transaction),
-- car elles ont été ajoutées via des migrations Supabase distinctes
-- ("marketplace_credit_lending" etc.) non répliquées ici. schema.sql a
-- été mis à jour en parallèle de ce fichier pour rester la référence
-- complète et à jour.
-- =====================================================================

create or replace function public.execute_financial_transaction(
  p_idempotency_key text,
  p_user_id uuid,
  p_amount numeric,
  p_currency text,
  p_description text,
  p_action_type text,
  p_debit_account text,
  p_credit_account text,
  p_contribution_id uuid default null,
  p_group_id uuid default null,
  p_ip text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_existing record;
  v_balance numeric;
  v_total_saved numeric;
  v_new_balance numeric;
  v_transaction_id text;
  v_wallet_account text;
  v_caller uuid := auth.uid();
  v_jwt_role text := coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '');
  v_is_service boolean;
  v_is_admin boolean := false;
  v_credits_wallet boolean;
begin
  v_is_service := (v_jwt_role = 'service_role');
  v_wallet_account := 'user_wallet:' || p_user_id::text;
  v_credits_wallet := (p_credit_account = v_wallet_account);

  if not v_is_service then
    if v_caller is null then
      return jsonb_build_object('success', false, 'message', 'Vous devez être connectée pour effectuer cette opération.');
    end if;

    select (role = 'admin') into v_is_admin from public.profiles where id = v_caller;
    v_is_admin := coalesce(v_is_admin, false);

    if p_user_id <> v_caller and not v_is_admin then
      return jsonb_build_object('success', false, 'message', 'Opération non autorisée sur le compte d''une autre personne.');
    end if;

    if p_action_type = 'wallet_recharge' then
      return jsonb_build_object('success', false, 'message', 'Une recharge doit être confirmée par le prestataire de paiement.');
    end if;

    if v_credits_wallet and not v_is_admin then
      return jsonb_build_object('success', false, 'message', 'Le crédit d''un portefeuille ne peut pas être demandé depuis l''application.');
    end if;
  end if;

  if p_amount <= 0 then
    return jsonb_build_object('success', false, 'message', 'Le montant doit être strictement supérieur à zéro.');
  end if;

  select * into v_existing from public.idempotency_keys where key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'success', true,
      'message', 'Transaction déjà exécutée (Idempotent).',
      'transactionId', v_existing.transaction_id
    );
  end if;

  select wallet_balance, total_saved into v_balance, v_total_saved
  from public.profiles where id = p_user_id for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'L''utilisateur spécifié n''existe pas.');
  end if;

  v_new_balance := v_balance;

  if p_debit_account = v_wallet_account then
    if v_balance < p_amount then
      return jsonb_build_object('success', false, 'message', 'Solde insuffisant dans votre portefeuille.');
    end if;
    v_new_balance := v_balance - p_amount;
  elsif v_credits_wallet then
    v_new_balance := v_balance + p_amount;
  end if;

  v_transaction_id := gen_random_uuid()::text;

  update public.profiles set
    wallet_balance = v_new_balance,
    total_saved = case when p_action_type = 'contribution_payment' then v_total_saved + p_amount else v_total_saved end,
    updated_at = now()
  where id = p_user_id;

  insert into public.double_entry_ledger (id, transaction_id, idempotency_key, account, counterparty, type, amount, currency, description)
  values
    (v_transaction_id || '_dr', v_transaction_id, p_idempotency_key, p_debit_account, p_credit_account, 'debit', p_amount, p_currency, p_description),
    (v_transaction_id || '_cr', v_transaction_id, p_idempotency_key, p_credit_account, p_debit_account, 'credit', p_amount, p_currency, p_description);

  insert into public.idempotency_keys (key, transaction_id, user_id, amount, action_type)
  values (p_idempotency_key, v_transaction_id, p_user_id, p_amount, p_action_type);

  insert into public.audit_logs (user_id, action, details, ip, device, status, idempotency_key)
  values (
    p_user_id, p_action_type,
    p_description || ' | Double-entrée : Débit [' || p_debit_account || '] / Crédit [' || p_credit_account || '] de ' || p_amount || ' ' || p_currency
      || ' | Appelant : ' || case when v_is_service then 'service' when v_is_admin then 'admin ' || v_caller::text else v_caller::text end,
    coalesce(p_ip, 'non disponible'),
    case when v_is_service then 'Serveur (service role)' else 'Application' end,
    'success', p_idempotency_key
  );

  if p_contribution_id is not null and p_group_id is not null then
    update public.contributions set
      status = 'paid',
      payment_method = 'wallet',
      debited_at = now(),
      idempotency_key = p_idempotency_key,
      updated_at = now()
    where id = p_contribution_id and group_id = p_group_id;
  end if;

  return jsonb_build_object('success', true, 'message', 'Transaction financière approuvée et enregistrée.', 'transactionId', v_transaction_id);
exception when others then
  insert into public.audit_logs (user_id, action, details, ip, device, status, idempotency_key)
  values (p_user_id, p_action_type, 'ÉCHEC : ' || p_description || ' | Erreur: ' || sqlerrm,
          coalesce(p_ip, 'non disponible'), 'Serveur Supabase', 'failure', p_idempotency_key);
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

revoke all on function public.execute_financial_transaction(text, uuid, numeric, text, text, text, text, text, uuid, uuid, text) from public, anon;
grant execute on function public.execute_financial_transaction(text, uuid, numeric, text, text, text, text, text, uuid, uuid, text) to authenticated, service_role;

create or replace function public.execute_payout_disbursement(p_group_id uuid, p_beneficiary_id uuid, p_admin_user_id uuid, p_discount_amount numeric default 0)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
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
begin
  if not (public.is_group_creator(p_group_id) or public.is_admin()) then
    return jsonb_build_object('success', false, 'message', 'Non autorisé.');
  end if;

  -- L'attribution dans le journal d'audit ne peut pas venir du client :
  -- on l'ancre sur l'appelant réellement authentifié.
  p_admin_user_id := auth.uid();

  select * into v_group from public.groups where id = p_group_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Le cercle d''épargne n''existe pas.');
  end if;
  if v_group.status <> 'active' then
    return jsonb_build_object('success', false, 'message', 'Le cercle n''est pas actif.');
  end if;

  select display_name into v_beneficiary_name from public.profiles where id = p_beneficiary_id;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Le bénéficiaire n''existe pas.');
  end if;

  select count(*) into v_num_members from public.group_members
  where group_id = p_group_id and status = 'active';

  v_total_pot := v_group.contribution_amount * v_num_members;
  if p_discount_amount < 0 or p_discount_amount >= v_total_pot then
    return jsonb_build_object('success', false, 'message', 'Le montant du rabais est invalide.');
  end if;

  v_idempotency_key := 'payout_' || p_group_id::text || '_cycle_' || v_group.current_payout_index::text;
  if exists (select 1 from public.idempotency_keys where key = v_idempotency_key) then
    return jsonb_build_object('success', true, 'message', 'Décaissement déjà exécuté pour ce cycle (Idempotent).');
  end if;

  v_beneficiary_payout := v_total_pot - p_discount_amount;
  v_transaction_id := gen_random_uuid()::text;
  v_description := case when p_discount_amount > 0
    then 'Encaissement Tontine Enchères - Pot ' || v_total_pot || ' ' || v_group.currency || ' (Rabais: -' || p_discount_amount || ')'
    else 'Encaissement Tontine - Payout de ' || v_total_pot || ' ' || v_group.currency end;

  update public.profiles set wallet_balance = wallet_balance + v_beneficiary_payout, updated_at = now()
  where id = p_beneficiary_id;

  insert into public.double_entry_ledger (id, transaction_id, idempotency_key, account, counterparty, type, amount, currency, description)
  values
    (v_transaction_id || '_benef_dr', v_transaction_id, v_idempotency_key, 'tontine_group:' || p_group_id, 'user_wallet:' || p_beneficiary_id, 'debit', v_beneficiary_payout, v_group.currency, v_description),
    (v_transaction_id || '_benef_cr', v_transaction_id, v_idempotency_key, 'user_wallet:' || p_beneficiary_id, 'tontine_group:' || p_group_id, 'credit', v_beneficiary_payout, v_group.currency, v_description);

  if p_discount_amount > 0 then
    v_discount_share := floor(p_discount_amount / greatest(v_num_members - 1, 1));
    for v_member in
      select user_id from public.group_members
      where group_id = p_group_id and status = 'active' and user_id <> p_beneficiary_id
    loop
      update public.profiles set wallet_balance = wallet_balance + v_discount_share, updated_at = now()
      where id = v_member.user_id;

      insert into public.double_entry_ledger (id, transaction_id, idempotency_key, account, counterparty, type, amount, currency, description)
      values
        (v_transaction_id || '_share_' || v_member.user_id || '_dr', v_transaction_id, v_idempotency_key, 'tontine_group:' || p_group_id, 'user_wallet:' || v_member.user_id, 'debit', v_discount_share, v_group.currency, 'Bonus Enchères - Intérêts redistribués de l''enchère remportée par ' || v_beneficiary_name),
        (v_transaction_id || '_share_' || v_member.user_id || '_cr', v_transaction_id, v_idempotency_key, 'user_wallet:' || v_member.user_id, 'tontine_group:' || p_group_id, 'credit', v_discount_share, v_group.currency, 'Bonus Enchères - Intérêts redistribués de l''enchère remportée par ' || v_beneficiary_name);

      insert into public.notifications (user_id, title, message, type, link)
      values (v_member.user_id, '🎉 Intérêts d''enchère reçus !', 'Vous avez reçu un bonus de ' || v_discount_share || ' ' || v_group.currency || ' redistribué suite à l''enchère remportée par ' || v_beneficiary_name || '.', 'payout', '/group/' || p_group_id);
    end loop;
  end if;

  select payout_position into v_beneficiary_position from public.group_members
  where group_id = p_group_id and user_id = p_beneficiary_id;
  select user_id into v_slot_holder from public.group_members
  where group_id = p_group_id and payout_position = v_group.current_payout_index;

  if v_slot_holder is distinct from p_beneficiary_id and v_slot_holder is not null then
    update public.group_members set payout_position = v_beneficiary_position where group_id = p_group_id and user_id = v_slot_holder;
    update public.group_members set payout_position = v_group.current_payout_index where group_id = p_group_id and user_id = p_beneficiary_id;
  end if;

  v_next_index := (v_group.current_payout_index + 1) % v_num_members;
  v_next_date := (v_group.next_payout_date::timestamptz + case v_group.frequency
    when 'daily' then interval '1 day'
    when 'weekly' then interval '7 days'
    when 'bi-weekly' then interval '14 days'
    else interval '30 days' end)::date;

  update public.groups set current_payout_index = v_next_index, next_payout_date = v_next_date, drawn_beneficiary_id = null, updated_at = now()
  where id = p_group_id;

  insert into public.payouts (group_id, user_id, amount, discount_amount, currency, cycle, transaction_id)
  values (p_group_id, p_beneficiary_id, v_beneficiary_payout, p_discount_amount, v_group.currency, v_group.current_payout_index + 1, v_transaction_id);

  insert into public.notifications (user_id, title, message, type, link)
  values (p_beneficiary_id, '💰 Fonds de tontine reçus !', 'Félicitations ! Vous avez reçu votre payout de ' || v_beneficiary_payout || ' ' || v_group.currency || ' pour le cycle ' || (v_group.current_payout_index + 1) || '.', 'payout', '/group/' || p_group_id);

  insert into public.audit_logs (user_id, action, details, ip, device, status, idempotency_key)
  values (p_admin_user_id, 'payout_disbursement', 'Décaissement de tontine pour le groupe [' || v_group.name || '] : ' || v_beneficiary_name || ' reçoit ' || v_beneficiary_payout || ' ' || v_group.currency || ' (Rabais: ' || p_discount_amount || ')', '197.221.34.8', 'Système Tontine', 'success', v_idempotency_key);

  insert into public.messages (group_id, user_id, user_name, is_system, content)
  values (p_group_id, null, 'Système Tontine', true, case when p_discount_amount > 0
    then '🎉 Félicitations à ' || v_beneficiary_name || ' qui remporte l''enchère et encaisse un payout net de ' || v_beneficiary_payout || ' ' || v_group.currency || ' ! Un rabais de ' || p_discount_amount || ' ' || v_group.currency || ' a été redistribué équitablement entre les autres membres.'
    else '🎉 Félicitations à ' || v_beneficiary_name || ' qui encaisse un payout complet de ' || v_beneficiary_payout || ' ' || v_group.currency || ' pour ce cycle !' end);

  insert into public.idempotency_keys (key, transaction_id, user_id, amount, action_type)
  values (v_idempotency_key, v_transaction_id, p_beneficiary_id, v_beneficiary_payout, 'payout_disbursement');

  return jsonb_build_object('success', true, 'message', 'Décaissement de ' || v_beneficiary_payout || ' ' || v_group.currency || ' exécuté avec succès.', 'transactionId', v_transaction_id);
exception when others then
  insert into public.audit_logs (user_id, action, details, ip, device, status)
  values (p_admin_user_id, 'payout_disbursement', 'ÉCHEC : ' || sqlerrm, '197.221.34.8', 'Système Tontine', 'failure');
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

revoke all on function public.execute_payout_disbursement(uuid, uuid, uuid, numeric) from public, anon;
grant execute on function public.execute_payout_disbursement(uuid, uuid, uuid, numeric) to authenticated, service_role;

create or replace function public.assign_next_payout_position(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_next_position integer;
begin
  if not (public.is_group_creator(p_group_id) or public.is_admin()) then
    raise exception 'Non autorisé.';
  end if;

  select count(*) into v_next_position from public.group_members
  where group_id = p_group_id and status = 'active' and payout_position is not null;

  update public.group_members set status = 'active', payout_position = v_next_position
  where group_id = p_group_id and user_id = p_user_id;
end;
$$;

revoke all on function public.assign_next_payout_position(uuid, uuid) from public, anon;
grant execute on function public.assign_next_payout_position(uuid, uuid) to authenticated, service_role;

drop function if exists public.repay_marketplace_credit(uuid, numeric);

create or replace function public.repay_marketplace_credit(
  p_request_id uuid,
  p_amount numeric,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_req record;
  v_remaining numeric;
  v_ledger_result jsonb;
  v_key text;
begin
  if p_amount <= 0 then
    return jsonb_build_object('success', false, 'message', 'Le montant doit être supérieur à zéro.');
  end if;

  select * into v_req from public.marketplace_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Crédit introuvable.');
  end if;
  if auth.uid() is null or v_req.user_id <> auth.uid() then
    return jsonb_build_object('success', false, 'message', 'Non autorisé.');
  end if;
  if v_req.status <> 'approved' or v_req.approved_amount is null then
    return jsonb_build_object('success', false, 'message', 'Ce crédit n''est pas actif.');
  end if;

  v_remaining := v_req.approved_amount - v_req.repaid_amount;
  if p_amount > v_remaining then
    return jsonb_build_object('success', false, 'message', 'Ce montant dépasse le solde restant dû (' || v_remaining || ' FCFA).');
  end if;

  v_key := coalesce(p_idempotency_key, 'credit_repayment_' || p_request_id::text || '_' || gen_random_uuid()::text);

  v_ledger_result := public.execute_financial_transaction(
    p_idempotency_key := v_key,
    p_user_id := v_req.user_id,
    p_amount := p_amount,
    p_currency := 'FCFA',
    p_description := 'Remboursement crédit Marketplace',
    p_action_type := 'admin_adjustment',
    p_debit_account := 'user_wallet:' || v_req.user_id::text,
    p_credit_account := 'marketplace_credit:' || v_req.service_id::text
  );

  if not (v_ledger_result->>'success')::boolean then
    return jsonb_build_object('success', false, 'message', v_ledger_result->>'message');
  end if;

  update public.marketplace_requests set repaid_amount = repaid_amount + p_amount where id = p_request_id;

  return jsonb_build_object('success', true, 'message', 'Remboursement enregistré.', 'remainingBalance', v_remaining - p_amount);
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

revoke all on function public.repay_marketplace_credit(uuid, numeric, text) from public, anon;
grant execute on function public.repay_marketplace_credit(uuid, numeric, text) to authenticated, service_role;
