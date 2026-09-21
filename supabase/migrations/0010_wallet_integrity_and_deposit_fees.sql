-- ============================================================================
-- 0010 — INTÉGRITÉ DU PORTEFEUILLE ET FRAIS DE DÉPÔT
-- ============================================================================
-- Trois corrections indépendantes, regroupées parce qu'elles concernent toutes
-- le même circuit : l'argent qui entre et sort du portefeuille.
--
--   1. wallet_transactions était en `for all` pour le propriétaire. Une
--      utilisatrice pouvait donc insérer elle-même une demande de retrait
--      `pending` de n'importe quel montant SANS que son portefeuille soit
--      débité — la ligne apparaissait telle quelle dans la file admin
--      (fetchPendingWithdrawals), et l'administrateur envoyait de l'argent
--      qui n'avait jamais été réservé. Elle pouvait aussi repasser une
--      demande déjà traitée en `pending` pour se la faire payer deux fois.
--
--   2. Le retrait se faisait en deux appels client successifs (débit par
--      execute_financial_transaction, PUIS insert de la ligne). Si le second
--      échouait, l'utilisatrice était débitée sans qu'aucune demande ne soit
--      visible : l'argent disparaissait. request_wallet_withdrawal fait les
--      deux dans la même transaction Postgres.
--
--   3. useAuth s'abonne aux UPDATE de `profiles` pour rafraîchir le solde à
--      l'écran, mais aucune migration n'avait ajouté la table à la
--      publication `supabase_realtime` : le canal ne recevait jamais rien et
--      le solde affiché restait figé jusqu'au rechargement de la page.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Frais de dépôt du prestataire de paiement, refacturés à l'utilisatrice
-- ----------------------------------------------------------------------------
-- Paydunya prélève une commission sur chaque encaissement. Le principe retenu
-- est que ces frais s'AJOUTENT au montant voulu au lieu d'être retenus dessus :
-- qui veut 1000 F sur son portefeuille paie 1025 F et reçoit bien 1000 F.
--
-- Les valeurs ci-dessous sont une prévision, pas la grille réelle du
-- prestataire — d'où le paramétrage en base plutôt qu'en dur dans le code :
-- le jour où la vraie grille est connue, seuls ces champs changent.
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS deposit_fee_percent numeric NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS deposit_fee_fixed numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_fee_min numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_fee_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.platform_settings.deposit_fee_percent IS
  'Part proportionnelle des frais de dépôt, en pourcentage du montant net voulu (2.5 = 2,5 %).';
COMMENT ON COLUMN public.platform_settings.deposit_fee_fixed IS
  'Part fixe des frais de dépôt, en FCFA, ajoutée par transaction.';
COMMENT ON COLUMN public.platform_settings.deposit_fee_min IS
  'Plancher : si pourcentage + fixe tombe sous cette valeur, c''est elle qui s''applique.';
COMMENT ON COLUMN public.platform_settings.deposit_fee_enabled IS
  'false = aucun frais ajouté, l''utilisatrice paie exactement le montant voulu.';


-- ----------------------------------------------------------------------------
-- 2. wallet_transactions : fin de l'écriture client directe
-- ----------------------------------------------------------------------------
-- La lecture reste ouverte au propriétaire (c'est son historique). L'écriture
-- passe désormais exclusivement par des fonctions SECURITY DEFINER, qui sont
-- les seules à pouvoir garantir qu'une ligne de retrait correspond bien à un
-- débit réel. Les administrateurs gardent l'écriture : ils traitent la file.
DROP POLICY IF EXISTS "wallet_tx_owner_or_admin" ON public.wallet_transactions;

CREATE POLICY "wallet_tx_select_owner_or_admin" ON public.wallet_transactions
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "wallet_tx_insert_admin_only" ON public.wallet_transactions
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "wallet_tx_update_admin_only" ON public.wallet_transactions
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "wallet_tx_delete_admin_only" ON public.wallet_transactions
  FOR DELETE USING (public.is_admin());


-- ----------------------------------------------------------------------------
-- 3. Demande de retrait atomique
-- ----------------------------------------------------------------------------
-- Reprend la logique de execute_financial_transaction pour le débit (garde de
-- solde, partie double, idempotence, audit) et y ajoute, dans la MÊME
-- transaction, la ligne `pending` que verra l'administrateur. Soit les deux
-- existent, soit aucun des deux.
--
-- Paydunya n'expose que l'encaissement, pas le décaissement automatique : le
-- retrait reste donc un geste manuel de l'administrateur. L'argent est
-- seulement réservé ici, et rendu si la demande est marquée en échec.
CREATE OR REPLACE FUNCTION public.request_wallet_withdrawal(
  p_idempotency_key text,
  p_amount numeric,
  p_payment_method text,
  p_phone text,
  p_method_label text,
  p_ip text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_wallet_account text;
  v_balance numeric;
  v_transaction_id text;
  v_description text;
  v_existing record;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Vous devez être connectée pour demander un retrait.');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le montant doit être strictement supérieur à zéro.');
  END IF;

  IF coalesce(trim(p_phone), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le numéro bénéficiaire est obligatoire.');
  END IF;

  -- Idempotence : un double envoi (bouton tapé deux fois, réseau qui rejoue)
  -- ne doit jamais débiter deux fois.
  SELECT * INTO v_existing FROM public.idempotency_keys WHERE key = p_idempotency_key;
  IF found THEN
    RETURN jsonb_build_object('success', true, 'message', 'Demande déjà enregistrée.', 'transactionId', v_existing.transaction_id);
  END IF;

  v_wallet_account := 'user_wallet:' || v_caller::text;

  SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = v_caller FOR UPDATE;
  IF NOT found THEN
    RETURN jsonb_build_object('success', false, 'message', 'Profil introuvable.');
  END IF;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'message', 'Solde insuffisant dans votre portefeuille.');
  END IF;

  v_transaction_id := gen_random_uuid()::text;
  v_description := 'Retrait vers ' || coalesce(p_method_label, p_payment_method) || ' (' || p_phone || ')';

  UPDATE public.profiles
     SET wallet_balance = v_balance - p_amount, updated_at = now()
   WHERE id = v_caller;

  INSERT INTO public.double_entry_ledger (id, transaction_id, idempotency_key, account, counterparty, type, amount, currency, description)
  VALUES
    (v_transaction_id || '_dr', v_transaction_id, p_idempotency_key, v_wallet_account, 'mobile_money_payout_pending', 'debit', p_amount, 'FCFA', v_description),
    (v_transaction_id || '_cr', v_transaction_id, p_idempotency_key, 'mobile_money_payout_pending', v_wallet_account, 'credit', p_amount, 'FCFA', v_description);

  INSERT INTO public.idempotency_keys (key, transaction_id, user_id, amount, action_type)
  VALUES (p_idempotency_key, v_transaction_id, v_caller, p_amount, 'wallet_withdrawal');

  -- Le cœur de la correction : cette ligne naît avec le débit, jamais après.
  -- Montant NÉGATIF : l'historique affiche un montant signé (TransactionItem
  -- colore et préfixe selon le signe), et un retrait sort de l'argent. Les
  -- lignes de retrait étaient jusqu'ici insérées en positif, donc affichées
  -- « +10 000 » en vert comme une entrée d'argent.
  INSERT INTO public.wallet_transactions (user_id, amount, type, description, status, reference, payment_method)
  VALUES (v_caller, -p_amount, 'withdraw', v_description, 'pending', p_phone, p_payment_method);

  INSERT INTO public.audit_logs (user_id, action, details, ip, device, status, idempotency_key)
  VALUES (v_caller, 'wallet_withdrawal',
          v_description || ' | Débit [' || v_wallet_account || '] / Crédit [mobile_money_payout_pending] de ' || p_amount || ' FCFA',
          coalesce(p_ip, 'non disponible'), 'Application', 'success', p_idempotency_key);

  RETURN jsonb_build_object('success', true, 'message', 'Demande de retrait enregistrée.', 'transactionId', v_transaction_id);
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('success', false, 'message', sqlerrm);
END;
$$;

REVOKE ALL ON FUNCTION public.request_wallet_withdrawal(text, numeric, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_wallet_withdrawal(text, numeric, text, text, text, text) TO authenticated;


-- ----------------------------------------------------------------------------
-- 4. Temps réel : sans ça, le solde affiché ne bouge jamais
-- ----------------------------------------------------------------------------
-- `profiles` porte wallet_balance (useAuth) ; `wallet_transactions` porte
-- l'historique ; `notifications` alimente la cloche. REPLICA IDENTITY FULL est
-- nécessaire pour que payload.new contienne toutes les colonnes et non les
-- seules clés — mapProfileRow a besoin de la ligne entière.
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.wallet_transactions REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles', 'wallet_transactions', 'notifications'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$$;


-- ----------------------------------------------------------------------------
-- 5. L'historique est écrit par la transaction elle-même
-- ----------------------------------------------------------------------------
-- Conséquence directe du point 2 : maintenant que le client ne peut plus
-- écrire dans wallet_transactions, les lignes d'historique que useWalletDebitor
-- et le webhook inséraient après coup ne passeraient plus. Plutôt que de leur
-- rendre ce droit, c'est execute_financial_transaction qui écrit la ligne —
-- dans la même transaction que le mouvement d'argent.
--
-- Bénéfice au passage : l'historique ne peut plus diverger du grand livre.
-- Auparavant, un insert client échoué laissait un mouvement d'argent sans
-- trace visible pour l'utilisatrice.
--
-- Le montant stocké est SIGNÉ (négatif quand l'argent sort du portefeuille) :
-- c'est ce qu'attend TransactionItem, qui colore et préfixe selon le signe.
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
  v_is_admin boolean := false;
  v_credits_wallet boolean;
  v_debits_wallet boolean;
  v_history_type text;
  v_history_amount numeric;
begin
  v_is_service := (v_jwt_role = 'service_role');
  v_wallet_account := 'user_wallet:' || p_user_id::text;
  v_credits_wallet := (p_credit_account = v_wallet_account);
  v_debits_wallet := (p_debit_account = v_wallet_account);

  -- ---------- 0. Autorisation (inchangé depuis 0005) ----------
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

  -- ---------- 6 bis. Historique visible par l'utilisatrice (NOUVEAU) ----------
  -- Seuls les mouvements qui touchent réellement le portefeuille méritent une
  -- ligne : une écriture entre deux comptes internes n'a rien à y faire.
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

REVOKE ALL ON FUNCTION public.execute_financial_transaction(text, uuid, numeric, text, text, text, text, text, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_financial_transaction(text, uuid, numeric, text, text, text, text, text, uuid, uuid, text) TO authenticated, service_role;
