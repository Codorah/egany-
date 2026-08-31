-- =====================================================================
-- 0005 — Verrouillage des autorisations sur execute_financial_transaction
--
-- PROBLÈME CORRIGÉ (critique)
-- ---------------------------
-- La fonction acceptait p_user_id, p_amount et p_credit_account depuis le
-- client, en `security definer`, sans vérifier QUI appelait. N'importe quel
-- utilisateur authentifié pouvait donc s'auto-créditer :
--
--     supabase.rpc('execute_financial_transaction', {
--       p_user_id: <son propre id>,
--       p_amount: 10000000,
--       p_action_type: 'wallet_recharge',
--       p_credit_account: 'user_wallet:<son id>', ...
--     })
--
-- Le même effet était atteignable sans écrire de code : l'application
-- créditait le portefeuille à partir des paramètres d'URL au retour de
-- Paydunya (?paydunya_success=true&amount=...), qu'il suffisait de taper
-- à la main dans la barre d'adresse.
--
-- RÈGLES POSÉES ICI
-- -----------------
--   1. Un appelant authentifié n'agit que sur son propre compte.
--   2. Un client ne peut JAMAIS créditer un portefeuille. Le crédit est
--      réservé au rôle service (webhook du prestataire de paiement) et,
--      pour les remboursements, aux administrateurs — dans les deux cas
--      l'opération reste auditée.
--   3. Une recharge (wallet_recharge) ne peut venir que du serveur : elle
--      atteste qu'un paiement a réellement été encaissé, ce qu'un client
--      ne peut pas prouver.
--
-- Les débits (cotisation depuis le portefeuille, demande de retrait)
-- restent appelables par l'utilisatrice elle-même : ils ne créent pas
-- d'argent.
-- =====================================================================

-- La signature déployée a divergé du fichier 0001 (le client envoie un
-- p_ip absent de la définition d'origine). On supprime donc toutes les
-- surcharges avant de recréer : sans cela, `create or replace` laisserait
-- l'ancienne version vulnérable appelable en parallèle.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'execute_financial_transaction'
  loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end
$$;

create function public.execute_financial_transaction(
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

  -- ---------- 0. Autorisation ----------
  if not v_is_service then
    if v_caller is null then
      return jsonb_build_object('success', false, 'message', 'Vous devez être connectée pour effectuer cette opération.');
    end if;

    select (role = 'admin') into v_is_admin from public.profiles where id = v_caller;
    v_is_admin := coalesce(v_is_admin, false);

    if p_user_id <> v_caller and not v_is_admin then
      return jsonb_build_object('success', false, 'message', 'Opération non autorisée sur le compte d''une autre personne.');
    end if;

    -- Une recharge atteste d'un encaissement réel : seul le serveur peut
    -- l'affirmer, après confirmation du prestataire de paiement.
    if p_action_type = 'wallet_recharge' then
      return jsonb_build_object('success', false, 'message', 'Une recharge doit être confirmée par le prestataire de paiement.');
    end if;

    -- Créditer un portefeuille, c'est créer de l'argent : interdit au client.
    -- Les remboursements administrateurs restent possibles et audités.
    if v_credits_wallet and not v_is_admin then
      return jsonb_build_object('success', false, 'message', 'Le crédit d''un portefeuille ne peut pas être demandé depuis l''application.');
    end if;
  end if;

  if p_amount <= 0 then
    return jsonb_build_object('success', false, 'message', 'Le montant doit être strictement supérieur à zéro.');
  end if;

  -- ---------- 1. Idempotence stricte ----------
  select * into v_existing from public.idempotency_keys where key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'success', true,
      'message', 'Transaction déjà exécutée (Idempotent).',
      'transactionId', v_existing.transaction_id
    );
  end if;

  -- ---------- 2. Lecture verrouillée du solde ----------
  select wallet_balance, total_saved into v_balance, v_total_saved
  from public.profiles where id = p_user_id for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'L''utilisateur spécifié n''existe pas.');
  end if;

  v_new_balance := v_balance;

  -- ---------- 3. Garde de solde ----------
  if p_debit_account = v_wallet_account then
    if v_balance < p_amount then
      return jsonb_build_object('success', false, 'message', 'Solde insuffisant dans votre portefeuille.');
    end if;
    v_new_balance := v_balance - p_amount;
  elsif v_credits_wallet then
    v_new_balance := v_balance + p_amount;
  end if;

  v_transaction_id := gen_random_uuid()::text;

  -- ---------- 4. Profil ----------
  update public.profiles set
    wallet_balance = v_new_balance,
    total_saved = case when p_action_type = 'contribution_payment' then v_total_saved + p_amount else v_total_saved end,
    updated_at = now()
  where id = p_user_id;

  -- ---------- 5. Partie double ----------
  insert into public.double_entry_ledger (id, transaction_id, idempotency_key, account, counterparty, type, amount, currency, description)
  values
    (v_transaction_id || '_dr', v_transaction_id, p_idempotency_key, p_debit_account, p_credit_account, 'debit', p_amount, p_currency, p_description),
    (v_transaction_id || '_cr', v_transaction_id, p_idempotency_key, p_credit_account, p_debit_account, 'credit', p_amount, p_currency, p_description);

  -- ---------- 6. Clé d'idempotence ----------
  insert into public.idempotency_keys (key, transaction_id, user_id, amount, action_type)
  values (p_idempotency_key, v_transaction_id, p_user_id, p_amount, p_action_type);

  -- ---------- 7. Audit ----------
  insert into public.audit_logs (user_id, action, details, ip, device, status, idempotency_key)
  values (
    p_user_id, p_action_type,
    p_description || ' | Double-entrée : Débit [' || p_debit_account || '] / Crédit [' || p_credit_account || '] de ' || p_amount || ' ' || p_currency
      || ' | Appelant : ' || case when v_is_service then 'service' when v_is_admin then 'admin ' || v_caller::text else v_caller::text end,
    coalesce(p_ip, 'non disponible'),
    case when v_is_service then 'Serveur (service role)' else 'Application' end,
    'success', p_idempotency_key
  );

  -- ---------- 8. Cotisation liée ----------
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
