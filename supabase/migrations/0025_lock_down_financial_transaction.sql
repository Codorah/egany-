-- ============================================================================
-- 0025 — execute_financial_transaction : plus de cotisation payée gratuitement
-- ============================================================================
-- Trouvé le 16 oct. 2026 en relisant les fonctions appelables par l'app.
--
-- 1. FAILLE — n'importe quel compte connecté pouvait appeler la fonction
--    directement et :
--      - marquer SA cotisation « payée » sans payer : il suffisait de
--        déclarer un débit sur un compte qui n'est pas son portefeuille
--        (ex. 'external_cash:…') et de passer l'id de la cotisation ;
--        rien ne vérifiait non plus que le montant couvrait la cotisation
--        (1 F suffisait), ni qu'elle lui appartenait ;
--      - gonfler son « épargne totale » (total_saved) d'un montant
--        arbitraire, sans un franc de mouvement réel. Or total_saved fixe le
--        plafond du microcrédit (2 × l'épargne).
--
-- 2. PANNE — la fonction refusait tout crédit de portefeuille demandé par un
--    compte non admin, y compris quand c'est withdraw_from_vault (fonction
--    serveur qui a déjà tout vérifié) qui le demande : retirer de l'argent de
--    « Ma Banque » était impossible.
--
-- 3. PANNE — la tâche planifiée process_due_contributions tourne sans
--    utilisateur connecté : la fonction répondait « Vous devez être
--    connectée » et le prélèvement automatique côté serveur échouait
--    toujours (seul celui fait par l'application, à l'ouverture, passait).
--
-- Nouvelle règle :
--   - appel par le serveur (clé service) : inchangé ;
--   - tâche planifiée (aucun jeton) et fonctions Ma Banque (marqueur
--     eganye.trusted_caller) : ces appels font leurs propres contrôles, on
--     les laisse faire — c'est ce qui répare Ma Banque et la tâche planifiée ;
--   - appel DIRECT depuis l'application, non admin : on ne débite que SON
--     portefeuille ; une cotisation n'est soldée que si elle appartient à la
--     bonne personne et que le montant la couvre ; seule l'organisatrice du
--     cercle peut enregistrer un paiement en espèces, et seulement pour une
--     cotisation de son cercle.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.execute_financial_transaction(
  p_idempotency_key text,
  p_user_id uuid,
  p_amount numeric,
  p_currency text,
  p_description text,
  p_action_type text,
  p_debit_account text,
  p_credit_account text,
  p_contribution_id uuid DEFAULT NULL,
  p_group_id uuid DEFAULT NULL,
  p_ip text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
  v_is_direct boolean;
  v_is_admin boolean := false;
  v_credits_wallet boolean;
  v_debits_wallet boolean;
  v_cash_by_organizer boolean := false;
  v_contribution record;
  v_history_type text;
  v_history_amount numeric;
begin
  v_is_service := (v_jwt_role = 'service_role');
  -- Appel venu directement de l'application, par opposition à :
  --   - la tâche planifiée / l'éditeur SQL : aucune requête HTTP, donc aucun
  --     jeton (request.jwt.claims vide) ;
  --   - une fonction serveur de confiance (Ma Banque) qui a fait ses propres
  --     contrôles et pose le marqueur eganye.trusted_caller le temps de son
  --     appel. L'application ne peut pas poser ce marqueur : elle n'appelle
  --     que des fonctions du schéma public, jamais set_config.
  -- (current_user ne peut pas servir : dans une fonction SECURITY DEFINER, il
  -- vaut toujours le propriétaire de la fonction.)
  v_is_direct := v_jwt_role <> ''
                 and coalesce(current_setting('eganye.trusted_caller', true), 'off') <> 'on';
  v_wallet_account := 'user_wallet:' || p_user_id::text;
  v_credits_wallet := (p_credit_account = v_wallet_account);
  v_debits_wallet := (p_debit_account = v_wallet_account);

  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('success', false, 'message', 'Le montant doit être strictement supérieur à zéro.');
  end if;

  -- ---------- 0. Autorisation des appels directs ----------
  if v_is_direct and not v_is_service then
    if v_caller is null then
      return jsonb_build_object('success', false, 'message', 'Vous devez être connectée pour effectuer cette opération.');
    end if;

    select (role = 'admin') into v_is_admin from public.profiles where id = v_caller;
    v_is_admin := coalesce(v_is_admin, false);

    if p_action_type = 'wallet_recharge' then
      return jsonb_build_object('success', false, 'message', 'Une recharge doit être confirmée par le prestataire de paiement.');
    end if;

    if not v_is_admin then
      -- Seule exception au « on ne débite que son portefeuille » : l'argent
      -- remis en espèces à l'organisatrice, qu'elle enregistre pour un membre
      -- de SON cercle, sur une cotisation précise.
      v_cash_by_organizer :=
        p_action_type = 'contribution_payment'
        and p_debit_account = 'external_cash:' || p_user_id::text
        and p_credit_account = 'tontine_group:' || coalesce(p_group_id::text, '')
        and p_contribution_id is not null
        and public.is_group_creator(p_group_id);

      if p_user_id <> v_caller and not v_cash_by_organizer then
        return jsonb_build_object('success', false, 'message', 'Opération non autorisée sur le compte d''une autre personne.');
      end if;

      if v_credits_wallet then
        return jsonb_build_object('success', false, 'message', 'Le crédit d''un portefeuille ne peut pas être demandé depuis l''application.');
      end if;

      if not v_debits_wallet and not v_cash_by_organizer then
        return jsonb_build_object('success', false, 'message', 'Seul votre portefeuille peut être débité.');
      end if;

      -- Une cotisation ne se solde que si elle est bien celle de la personne,
      -- dans ce cercle, et que le montant la couvre.
      if p_contribution_id is not null then
        select * into v_contribution from public.contributions
        where id = p_contribution_id and group_id = p_group_id and user_id = p_user_id
        for update;
        if not found then
          return jsonb_build_object('success', false, 'message', 'Cotisation introuvable pour cette personne et ce cercle.');
        end if;
        if p_amount < v_contribution.amount
             + case when v_contribution.penalty_status = 'pending' then coalesce(v_contribution.penalty_applied, 0) else 0 end then
          return jsonb_build_object('success', false, 'message', 'Le montant ne couvre pas la cotisation.');
        end if;
        -- Prélèvement du portefeuille : jamais sur une cotisation déjà payée.
        -- (Espèces : l'organisatrice marque la ligne payée juste avant
        -- d'inscrire l'écriture, d'où l'exception.)
        if v_contribution.status = 'paid' and not v_cash_by_organizer then
          return jsonb_build_object('success', false, 'message', 'Cette cotisation est déjà payée.');
        end if;
      end if;
    end if;
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
  if v_debits_wallet then
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

  -- ---------- 6 bis. Historique visible ----------
  if v_debits_wallet or v_credits_wallet then
    v_history_amount := case when v_debits_wallet then -p_amount else p_amount end;
    v_history_type := case
      when p_action_type = 'wallet_recharge' then 'recharge'
      when p_action_type = 'contribution_payment' then 'contribution_debit'
      when p_action_type = 'payout_disbursement' then 'payout_credit'
      when v_credits_wallet then 'payout_credit'
      else 'payout_deduction'
    end;

    insert into public.wallet_transactions (user_id, amount, type, description, status, reference, payment_method)
    values (
      p_user_id, v_history_amount, v_history_type, p_description, 'completed', v_transaction_id,
      case when p_action_type = 'wallet_recharge' then 'paydunya' else 'wallet' end
    );
  end if;

  -- ---------- 7. Audit ----------
  insert into public.audit_logs (user_id, action, details, ip, device, status, idempotency_key)
  values (
    p_user_id, p_action_type,
    p_description || ' | Double-entrée : Débit [' || p_debit_account || '] / Crédit [' || p_credit_account || '] de ' || p_amount || ' ' || p_currency
      || ' | Appelant : ' || case when v_is_service then 'service'
                                  when not v_is_direct then 'fonction serveur'
                                  when v_is_admin then 'admin ' || v_caller::text
                                  else v_caller::text end,
    coalesce(p_ip, 'non disponible'),
    case when v_is_service then 'Serveur (service role)' when not v_is_direct then 'Serveur' else 'Application' end,
    'success', p_idempotency_key
  );

  -- ---------- 8. Cotisation liée ----------
  if p_contribution_id is not null and p_group_id is not null then
    update public.contributions set
      status = 'paid',
      payment_method = case when v_cash_by_organizer then 'cash' else 'wallet' end,
      debited_at = case when v_cash_by_organizer then debited_at else now() end,
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

REVOKE ALL ON FUNCTION public.execute_financial_transaction(text, uuid, numeric, text, text, text, text, text, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_financial_transaction(text, uuid, numeric, text, text, text, text, text, uuid, uuid, text) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- Ma Banque : dépôt et retrait posent le marqueur de confiance le temps de
-- leur appel au grand livre (reprend 0016 à l'identique, plus ces 2 lignes).
-- ----------------------------------------------------------------------------
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

  PERFORM set_config('eganye.trusted_caller', 'on', true);
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
  PERFORM set_config('eganye.trusted_caller', 'off', true);

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

  PERFORM set_config('eganye.trusted_caller', 'on', true);
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
  PERFORM set_config('eganye.trusted_caller', 'off', true);

  IF NOT (v_ledger_result->>'success')::boolean THEN
    RETURN jsonb_build_object('success', false, 'message', v_ledger_result->>'message');
  END IF;

  UPDATE public.personal_vaults SET balance = balance - p_amount WHERE id = p_vault_id;

  RETURN jsonb_build_object('success', true, 'message', 'Retrait effectué.');
END;
$$;

REVOKE ALL ON FUNCTION public.deposit_to_vault(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.withdraw_from_vault(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deposit_to_vault(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_from_vault(uuid, numeric, text) TO authenticated;
