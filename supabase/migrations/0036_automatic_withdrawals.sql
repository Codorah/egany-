-- ============================================================================
-- 0036 — Retraits automatiques via PayDunya
-- ============================================================================
-- Jusqu'ici un admin envoyait l'argent à la main. Désormais api/paydunya-payout
-- envoie les petits retraits tout seul. Les autres, et tout envoi refusé par
-- PayDunya, restent dans la file de l'Admin.
--
-- payout_state, sur une ligne wallet_transactions de type 'withdraw' :
--   NULL         demande créée, aucune décision prise (ou ancienne version de l'app)
--   'processing' un envoi PayDunya est en cours : personne d'autre n'y touche
--   'manual'     à traiter dans l'Admin (payout_error dit pourquoi)
--   'sent'       envoyé, confirmé par PayDunya
--
-- Reprend aussi la colonne de la migration 0035 : exécuter celle-ci suffit.
-- ============================================================================

alter table public.wallet_transactions
  add column if not exists payout_reference text,
  add column if not exists payout_state text,
  add column if not exists payout_token text,
  add column if not exists payout_attempts integer not null default 0,
  add column if not exists payout_error text,
  add column if not exists payout_fee numeric,
  add column if not exists payout_started_at timestamptz,
  add column if not exists withdraw_idempotency_key text;

alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_payout_state_check;
alter table public.wallet_transactions
  add constraint wallet_transactions_payout_state_check
  check (payout_state is null or payout_state in ('processing', 'manual', 'sent'));

create index if not exists idx_wallet_tx_payout_token
  on public.wallet_transactions (payout_token) where payout_token is not null;
create unique index if not exists uq_wallet_tx_withdraw_idempotency_key
  on public.wallet_transactions (withdraw_idempotency_key) where withdraw_idempotency_key is not null;

alter table public.platform_settings
  add column if not exists auto_withdraw_enabled boolean not null default true,
  add column if not exists auto_withdraw_max_amount numeric not null default 25000,
  add column if not exists auto_withdraw_daily_max numeric not null default 50000;

-- Même signature : les anciennes versions de l'app continuent de fonctionner,
-- et leurs demandes (payout_state NULL) arrivent dans la file de l'Admin.
-- Ajouts : withdrawalId et replayed dans la réponse, clé stockée sur la ligne.
create or replace function public.request_wallet_withdrawal(
  p_idempotency_key text,
  p_amount numeric,
  p_payment_method text,
  p_phone text,
  p_method_label text,
  p_ip text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_wallet_account text;
  v_balance numeric;
  v_transaction_id text;
  v_withdrawal_id uuid;
  v_description text;
  v_existing record;
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

  v_wallet_account := 'user_wallet:' || v_caller::text;

  select wallet_balance into v_balance from public.profiles where id = v_caller for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Profil introuvable.');
  end if;

  if v_balance < p_amount then
    return jsonb_build_object('success', false, 'message', 'Solde insuffisant dans votre portefeuille.');
  end if;

  v_transaction_id := gen_random_uuid()::text;
  v_description := 'Retrait vers ' || coalesce(p_method_label, p_payment_method) || ' (' || p_phone || ')';

  update public.profiles
     set wallet_balance = v_balance - p_amount, updated_at = now()
   where id = v_caller;

  insert into public.double_entry_ledger (id, transaction_id, idempotency_key, account, counterparty, type, amount, currency, description)
  values
    (v_transaction_id || '_dr', v_transaction_id, p_idempotency_key, v_wallet_account, 'mobile_money_payout_pending', 'debit', p_amount, 'FCFA', v_description),
    (v_transaction_id || '_cr', v_transaction_id, p_idempotency_key, 'mobile_money_payout_pending', v_wallet_account, 'credit', p_amount, 'FCFA', v_description);

  insert into public.idempotency_keys (key, transaction_id, user_id, amount, action_type)
  values (p_idempotency_key, v_transaction_id, v_caller, p_amount, 'wallet_withdrawal');

  insert into public.wallet_transactions (user_id, amount, type, description, status, reference, payment_method, withdraw_idempotency_key)
  values (v_caller, -p_amount, 'withdraw', v_description, 'pending', p_phone, p_payment_method, p_idempotency_key)
  returning id into v_withdrawal_id;

  insert into public.audit_logs (user_id, action, details, ip, device, status, idempotency_key)
  values (v_caller, 'wallet_withdrawal',
          v_description || ' | Débit [' || v_wallet_account || '] / Crédit [mobile_money_payout_pending] de ' || p_amount || ' FCFA',
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

revoke all on function public.request_wallet_withdrawal(text, numeric, text, text, text, text) from public, anon;
grant execute on function public.request_wallet_withdrawal(text, numeric, text, text, text, text) to authenticated;
