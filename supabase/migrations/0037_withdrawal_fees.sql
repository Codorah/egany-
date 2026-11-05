-- ============================================================================
-- 0037 — Frais de retrait, avec la même case que sur les dépôts
-- ============================================================================
-- Cochée (frais en plus) : 1 000 F demandés, 1 000 F reçus, 1 000 F + frais débités.
-- Décochée (frais retenus) : 1 000 F débités, 1 000 F - frais reçus.
--
-- Les frais sont calculés ICI : le navigateur ne fait que les annoncer, et sa
-- valeur (p_expected_fee) sert à vérifier que la personne a bien vu le bon
-- montant. À exécuter après la 0036.
--
-- wallet_transactions.amount reste ce qui a quitté le portefeuille (négatif).
-- payout_amount est ce qu'il faut envoyer ; NULL sur les anciennes lignes, où
-- les deux sont égaux.
-- ============================================================================

alter table public.wallet_transactions
  add column if not exists payout_amount numeric,
  add column if not exists withdraw_fee numeric not null default 0;

alter table public.platform_settings
  add column if not exists withdraw_fee_enabled boolean not null default true,
  add column if not exists withdraw_fee_percent numeric not null default 0,
  add column if not exists withdraw_fee_fixed numeric not null default 0,
  add column if not exists withdraw_fee_min numeric not null default 0;

-- Point de départ : la grille des dépôts. À ajuster dans l'Admin.
update public.platform_settings
   set withdraw_fee_enabled = deposit_fee_enabled,
       withdraw_fee_percent = deposit_fee_percent,
       withdraw_fee_fixed = deposit_fee_fixed,
       withdraw_fee_min = deposit_fee_min
 where id = 1;

-- Un paramètre de plus : on retire l'ancienne version pour qu'il n'y ait pas
-- d'ambiguïté. Les anciennes versions de l'app, qui ne l'envoient pas, restent
-- servies par les valeurs par défaut (frais retenus sur le montant).
drop function if exists public.request_wallet_withdrawal(text, numeric, text, text, text, text);

create or replace function public.request_wallet_withdrawal(
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
  v_caller uuid := auth.uid();
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

revoke all on function public.request_wallet_withdrawal(text, numeric, text, text, text, text, boolean, numeric) from public, anon;
grant execute on function public.request_wallet_withdrawal(text, numeric, text, text, text, text, boolean, numeric) to authenticated;
