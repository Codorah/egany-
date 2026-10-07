-- ============================================================================
-- eganyé — Schéma complet Master Supabase PostgreSQL
-- ============================================================================
-- Ce fichier regroupe l'intégralité de la structure de base de données,
-- de la sécurité (RLS), des déclencheurs (triggers) et des fonctions financières.
--
-- Pour exécuter : Supabase Dashboard -> SQL Editor -> Coller ce fichier -> Run
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- Profils utilisateurs (miroir de auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL,
  avatar_config jsonb,
  reputation_score integer NOT NULL DEFAULT 75,
  total_saved numeric NOT NULL DEFAULT 0,
  groups_joined integer NOT NULL DEFAULT 0,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  wallet_balance numeric NOT NULL DEFAULT 0,
  language text,
  theme text,
  security_pin_hash text,
  pin_failed_attempts integer NOT NULL DEFAULT 0,
  pin_locked_until timestamptz,
  biometrics_enabled boolean NOT NULL DEFAULT false,
  fcm_token text,
  push_enabled boolean NOT NULL DEFAULT false,
  email_notifications_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Cercles d'épargne (Tontines)
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  creator_id uuid NOT NULL REFERENCES public.profiles(id),
  contribution_amount numeric NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'bi-weekly', 'monthly')),
  start_date date NOT NULL,
  end_date date,
  next_payout_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'completed', 'pending')),
  current_payout_index integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'FCFA',
  join_code text UNIQUE,
  is_private boolean NOT NULL DEFAULT false,
  max_members integer,
  rules text,
  last_reminder_period text,
  distribution_method text DEFAULT 'sequential' CHECK (distribution_method IN ('sequential', 'draw', 'auction')),
  penalty_rate numeric,
  penalty_type text CHECK (penalty_type IN ('percentage', 'fixed')),
  penalty_amount numeric,
  grace_period integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Membres des groupes
CREATE TABLE IF NOT EXISTS public.group_members (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'treasurer', 'secretary')),
  payout_position integer,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- Cotisations
CREATE TABLE IF NOT EXISTS public.contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  user_name text,
  user_email text,
  amount numeric NOT NULL,
  date timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('paid', 'pending', 'late', 'pending_approval')),
  period text,
  proof_reference text,
  proof_submitted_at timestamptz,
  penalty_applied numeric,
  penalty_status text DEFAULT 'none' CHECK (penalty_status IN ('none', 'pending', 'paid')),
  notified_insufficient boolean NOT NULL DEFAULT false,
  payment_method text,
  debited_at timestamptz,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Chat de groupe
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id),
  user_name text NOT NULL,
  user_photo text,
  content text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Documents de groupe
CREATE TABLE IF NOT EXISTS public.group_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES public.profiles(id),
  uploader_name text,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'autre' CHECK (category IN ('statuts', 'contrat', 'pv', 'justificatif', 'autre')),
  storage_path text NOT NULL,
  size bigint,
  content_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN ('reminder', 'payout', 'system', 'chat')),
  read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Transactions portefeuille
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('recharge', 'contribution_debit', 'payout_credit', 'payout_deduction', 'withdraw')),
  description text,
  date timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('completed', 'failed', 'pending')),
  reference text,
  payment_method text
);

-- Payouts
CREATE TABLE IF NOT EXISTS public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  amount numeric NOT NULL,
  discount_amount numeric DEFAULT 0,
  currency text DEFAULT 'FCFA',
  cycle integer,
  transaction_id text,
  date timestamptz NOT NULL DEFAULT now()
);

-- Grand livre comptable en partie double
CREATE TABLE IF NOT EXISTS public.double_entry_ledger (
  id text PRIMARY KEY,
  transaction_id text NOT NULL,
  idempotency_key text NOT NULL,
  account text NOT NULL,
  counterparty text NOT NULL,
  type text NOT NULL CHECK (type IN ('debit', 'credit')),
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'FCFA',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Journaux d'audit
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  details text,
  ip text,
  device text,
  timestamp timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('success', 'failure')),
  idempotency_key text
);

-- Clés d'idempotence
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key text PRIMARY KEY,
  transaction_id text,
  user_id uuid,
  amount numeric,
  action_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Rapports de réconciliation
CREATE TABLE IF NOT EXISTS public.reconciliation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  total_users_checked integer,
  total_ledger_entries_checked integer,
  total_discrepancies numeric,
  status text,
  executed_by text
);

CREATE TABLE IF NOT EXISTS public.reconciliation_report_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reconciliation_reports(id) ON DELETE CASCADE,
  user_id uuid,
  display_name text,
  current_balance numeric,
  calculated_balance numeric,
  discrepancy numeric,
  status text
);

-- Tickets de support
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  user_name text,
  user_email text,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index d'optimisation
CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.group_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_contributions_group ON public.contributions(group_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_contributions_user ON public.contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_group ON public.messages(group_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON public.wallet_transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_account ON public.double_entry_ledger(account);
CREATE INDEX IF NOT EXISTS idx_groups_join_code ON public.groups(join_code);

-- ============================================================================
-- 2. FONCTIONS D'AIDE ET RLS SECURITY
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = auth.uid() AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_creator(p_group_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups WHERE id = p_group_id AND creator_id = auth.uid()
  );
$$;

-- Trigger d'auto-création de profil à l'inscription auth.users
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    CASE WHEN new.email IN ('codorah@hotmail.com', 'diditanael@gmail.com') THEN 'admin' ELSE 'user' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Protection contre la modification directe du rôle utilisateur
CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF new.role <> old.role AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Seul un administrateur peut modifier un rôle.';
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_role_change ON public.profiles;
CREATE TRIGGER trg_prevent_self_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_change();

-- Protection du hachage de code PIN
CREATE OR REPLACE FUNCTION public.prevent_direct_pin_hash_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF new.security_pin_hash IS DISTINCT FROM old.security_pin_hash
     AND COALESCE(current_setting('eganye.allow_pin_hash_write', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'Le code PIN ne peut être modifié que via set_user_pin().';
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_pin_hash_change ON public.profiles;
CREATE TRIGGER trg_prevent_direct_pin_hash_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_pin_hash_change();

-- ============================================================================
-- 3. ACTIVATION ET POLITIQUES RLS
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.double_entry_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_report_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Clean existing policies to avoid conflict
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;

CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "profiles_delete_admin" ON public.profiles FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "groups_select_all" ON public.groups;
DROP POLICY IF EXISTS "groups_insert_self_as_creator" ON public.groups;
DROP POLICY IF EXISTS "groups_update_creator_member_or_admin" ON public.groups;
DROP POLICY IF EXISTS "groups_delete_creator_or_admin" ON public.groups;

CREATE POLICY "groups_select_all" ON public.groups FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "groups_insert_self_as_creator" ON public.groups FOR INSERT WITH CHECK (creator_id = auth.uid());
CREATE POLICY "groups_update_creator_member_or_admin" ON public.groups FOR UPDATE USING (creator_id = auth.uid() OR public.is_group_member(id) OR public.is_admin());
CREATE POLICY "groups_delete_creator_or_admin" ON public.groups FOR DELETE USING (creator_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "group_members_select_all" ON public.group_members;
DROP POLICY IF EXISTS "group_members_insert_self" ON public.group_members;
DROP POLICY IF EXISTS "group_members_update_creator_or_admin" ON public.group_members;
DROP POLICY IF EXISTS "group_members_delete_self_creator_or_admin" ON public.group_members;

CREATE POLICY "group_members_select_all" ON public.group_members FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "group_members_insert_self" ON public.group_members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "group_members_update_creator_or_admin" ON public.group_members FOR UPDATE USING (public.is_group_creator(group_id) OR public.is_admin());
CREATE POLICY "group_members_delete_self_creator_or_admin" ON public.group_members FOR DELETE USING (user_id = auth.uid() OR public.is_group_creator(group_id) OR public.is_admin());

DROP POLICY IF EXISTS "contributions_all_group_member_or_admin" ON public.contributions;
CREATE POLICY "contributions_all_group_member_or_admin" ON public.contributions FOR ALL USING (public.is_group_member(group_id) OR public.is_admin()) WITH CHECK (public.is_group_member(group_id) OR public.is_admin());

DROP POLICY IF EXISTS "messages_select_group_member_or_admin" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_self_attributed" ON public.messages;
DROP POLICY IF EXISTS "messages_update_delete_admin" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_admin" ON public.messages;

CREATE POLICY "messages_select_group_member_or_admin" ON public.messages FOR SELECT USING (public.is_group_member(group_id) OR public.is_admin());
CREATE POLICY "messages_insert_self_attributed" ON public.messages FOR INSERT WITH CHECK ((user_id = auth.uid() AND public.is_group_member(group_id) AND is_system = false));
CREATE POLICY "messages_update_delete_admin" ON public.messages FOR UPDATE USING (public.is_admin());
CREATE POLICY "messages_delete_admin" ON public.messages FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "group_documents_select_member_or_admin" ON public.group_documents;
DROP POLICY IF EXISTS "group_documents_insert_self_attributed" ON public.group_documents;
DROP POLICY IF EXISTS "group_documents_delete_member_or_admin" ON public.group_documents;

CREATE POLICY "group_documents_select_member_or_admin" ON public.group_documents FOR SELECT USING (public.is_group_member(group_id) OR public.is_admin());
CREATE POLICY "group_documents_insert_self_attributed" ON public.group_documents FOR INSERT WITH CHECK (uploader_id = auth.uid() AND public.is_group_member(group_id));
CREATE POLICY "group_documents_delete_member_or_admin" ON public.group_documents FOR DELETE USING (public.is_group_member(group_id) OR public.is_admin());

DROP POLICY IF EXISTS "notifications_select_owner_or_admin" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_authenticated" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_owner_or_admin" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_owner_or_admin" ON public.notifications;

CREATE POLICY "notifications_select_owner_or_admin" ON public.notifications FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "notifications_insert_authenticated" ON public.notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "notifications_update_owner_or_admin" ON public.notifications FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "notifications_delete_owner_or_admin" ON public.notifications FOR DELETE USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "wallet_tx_owner_or_admin" ON public.wallet_transactions;
CREATE POLICY "wallet_tx_owner_or_admin" ON public.wallet_transactions FOR ALL USING (user_id = auth.uid() OR public.is_admin()) WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "payouts_select_group_member_or_admin" ON public.payouts;
CREATE POLICY "payouts_select_group_member_or_admin" ON public.payouts FOR SELECT USING (public.is_group_member(group_id) OR public.is_admin());

DROP POLICY IF EXISTS "ledger_select_admin_only" ON public.double_entry_ledger;
CREATE POLICY "ledger_select_admin_only" ON public.double_entry_ledger FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "audit_logs_select_admin_only" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin_only" ON public.audit_logs FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "audit_logs_insert_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_admin" ON public.audit_logs FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "reconciliation_reports_admin_only" ON public.reconciliation_reports;
CREATE POLICY "reconciliation_reports_admin_only" ON public.reconciliation_reports FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "reconciliation_lines_admin_only" ON public.reconciliation_report_lines;
CREATE POLICY "reconciliation_lines_admin_only" ON public.reconciliation_report_lines FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "support_tickets_owner_or_admin_select" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_insert_self" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_update_owner_or_admin" ON public.support_tickets;

CREATE POLICY "support_tickets_owner_or_admin_select" ON public.support_tickets FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "support_tickets_insert_self" ON public.support_tickets FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "support_tickets_update_owner_or_admin" ON public.support_tickets FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());

-- Storage Buckets & Security Policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-documents', 'group-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "group_documents_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "group_documents_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "group_documents_storage_delete" ON storage.objects;

CREATE POLICY "group_documents_storage_select" ON storage.objects FOR SELECT USING (bucket_id = 'group-documents' AND (public.is_group_member((storage.foldername(name))[1]::uuid) OR public.is_admin()));
CREATE POLICY "group_documents_storage_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'group-documents' AND public.is_group_member((storage.foldername(name))[1]::uuid));
CREATE POLICY "group_documents_storage_delete" ON storage.objects FOR DELETE USING (bucket_id = 'group-documents' AND (public.is_group_member((storage.foldername(name))[1]::uuid) OR public.is_admin()));

-- ============================================================================
-- 4. FONCTIONS RPC (FINANCES & TRANSACTIONNEL)
-- ============================================================================

-- Sécurité : ce SECURITY DEFINER a longtemps été exécutable sans aucune
-- vérification de l'appelant (n'importe quel utilisateur — même anonyme,
-- la fonction était accordée à `anon` — pouvait créditer n'importe quel
-- portefeuille). Voir supabase/migrations/0005_harden_financial_transaction.sql.
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
DECLARE
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
BEGIN
  v_is_service := (v_jwt_role = 'service_role');
  v_wallet_account := 'user_wallet:' || p_user_id::text;
  v_credits_wallet := (p_credit_account = v_wallet_account);

  -- Un client ne peut agir que sur son propre compte, ne peut jamais créditer
  -- un portefeuille (sauf admin, pour les remboursements), et une recharge ne
  -- peut venir que du serveur (webhook du prestataire de paiement).
  IF NOT v_is_service THEN
    IF v_caller IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Vous devez être connectée pour effectuer cette opération.');
    END IF;

    SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = v_caller;
    v_is_admin := coalesce(v_is_admin, false);

    IF p_user_id <> v_caller AND NOT v_is_admin THEN
      RETURN jsonb_build_object('success', false, 'message', 'Opération non autorisée sur le compte d''une autre personne.');
    END IF;

    IF p_action_type = 'wallet_recharge' THEN
      RETURN jsonb_build_object('success', false, 'message', 'Une recharge doit être confirmée par le prestataire de paiement.');
    END IF;

    IF v_credits_wallet AND NOT v_is_admin THEN
      RETURN jsonb_build_object('success', false, 'message', 'Le crédit d''un portefeuille ne peut pas être demandé depuis l''application.');
    END IF;
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le montant doit être strictement supérieur à zéro.');
  END IF;

  SELECT * INTO v_existing FROM public.idempotency_keys WHERE key = p_idempotency_key;
  IF found THEN
    RETURN jsonb_build_object('success', true, 'message', 'Transaction déjà exécutée (Idempotent).', 'transactionId', v_existing.transaction_id);
  END IF;

  SELECT wallet_balance, total_saved INTO v_balance, v_total_saved
  FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT found THEN
    RETURN jsonb_build_object('success', false, 'message', 'L''utilisateur spécifié n''existe pas.');
  END IF;

  v_new_balance := v_balance;

  IF p_debit_account = v_wallet_account THEN
    IF v_balance < p_amount THEN
      RETURN jsonb_build_object('success', false, 'message', 'Solde insuffisant dans votre portefeuille.');
    END IF;
    v_new_balance := v_balance - p_amount;
  ELSIF v_credits_wallet THEN
    v_new_balance := v_balance + p_amount;
  END IF;

  v_transaction_id := gen_random_uuid()::text;

  UPDATE public.profiles SET
    wallet_balance = v_new_balance,
    total_saved = CASE WHEN p_action_type = 'contribution_payment' THEN v_total_saved + p_amount ELSE v_total_saved END,
    updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.double_entry_ledger (id, transaction_id, idempotency_key, account, counterparty, type, amount, currency, description)
  VALUES
    (v_transaction_id || '_dr', v_transaction_id, p_idempotency_key, p_debit_account, p_credit_account, 'debit', p_amount, p_currency, p_description),
    (v_transaction_id || '_cr', v_transaction_id, p_idempotency_key, p_credit_account, p_debit_account, 'credit', p_amount, p_currency, p_description);

  INSERT INTO public.idempotency_keys (key, transaction_id, user_id, amount, action_type)
  VALUES (p_idempotency_key, v_transaction_id, p_user_id, p_amount, p_action_type);

  INSERT INTO public.audit_logs (user_id, action, details, ip, device, status, idempotency_key)
  VALUES (
    p_user_id, p_action_type,
    p_description || ' | Débit [' || p_debit_account || '] / Crédit [' || p_credit_account || '] de ' || p_amount || ' ' || p_currency
      || ' | Appelant : ' || CASE WHEN v_is_service THEN 'service' WHEN v_is_admin THEN 'admin ' || v_caller::text ELSE v_caller::text END,
    COALESCE(p_ip, 'Non disponible'),
    CASE WHEN v_is_service THEN 'Serveur (service role)' ELSE 'Application' END,
    'success', p_idempotency_key
  );

  IF p_contribution_id IS NOT NULL AND p_group_id IS NOT NULL THEN
    UPDATE public.contributions SET
      status = 'paid',
      payment_method = 'wallet',
      debited_at = now(),
      idempotency_key = p_idempotency_key,
      updated_at = now()
    WHERE id = p_contribution_id AND group_id = p_group_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Transaction financière approuvée et enregistrée.', 'transactionId', v_transaction_id);
EXCEPTION WHEN others THEN
  INSERT INTO public.audit_logs (user_id, action, details, ip, device, status, idempotency_key)
  VALUES (p_user_id, p_action_type, 'ÉCHEC : ' || p_description || ' | Erreur: ' || sqlerrm, COALESCE(p_ip, 'Non disponible'), 'Serveur Supabase', 'failure', p_idempotency_key);
  RETURN jsonb_build_object('success', false, 'message', sqlerrm);
END;
$$;

REVOKE ALL ON FUNCTION public.execute_financial_transaction(text, uuid, numeric, text, text, text, text, text, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_financial_transaction(text, uuid, numeric, text, text, text, text, text, uuid, uuid, text) TO authenticated, service_role;

-- Verification du PIN utilisateur
CREATE OR REPLACE FUNCTION public.verify_user_pin(p_user_id uuid, p_entered_pin text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_locked_until timestamptz;
  v_attempts integer;
  v_max_attempts constant integer := 5;
  v_lockout_minutes constant integer := 15;
BEGIN
  SELECT security_pin_hash, pin_locked_until, pin_failed_attempts
  INTO v_hash, v_locked_until, v_attempts
  FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT found THEN
    RETURN jsonb_build_object('ok', false, 'locked', false, 'message', 'Utilisateur introuvable.');
  END IF;

  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RETURN jsonb_build_object(
      'ok', false, 'locked', true, 'lockedUntil', v_locked_until,
      'message', 'Trop de tentatives échouées. Réessayez après ' || to_char(v_locked_until, 'HH24:MI') || '.'
    );
  END IF;

  IF v_hash IS NULL THEN
    v_hash := crypt('0000', gen_salt('bf'));
  END IF;

  IF crypt(p_entered_pin, v_hash) = v_hash THEN
    UPDATE public.profiles SET pin_failed_attempts = 0, pin_locked_until = null WHERE id = p_user_id;
    RETURN jsonb_build_object('ok', true, 'locked', false, 'message', 'Code PIN valide.');
  END IF;

  v_attempts := COALESCE(v_attempts, 0) + 1;

  IF v_attempts >= v_max_attempts THEN
    UPDATE public.profiles SET pin_failed_attempts = 0, pin_locked_until = now() + (v_lockout_minutes || ' minutes')::interval
    WHERE id = p_user_id;
    
    INSERT INTO public.audit_logs (user_id, action, details, ip, device, status)
    VALUES (p_user_id, 'withdrawal_pin_locked', 'Trop de tentatives de code PIN incorrectes.', '197.234.34.82', 'Navigateur', 'failure');

    RETURN jsonb_build_object('ok', false, 'locked', true, 'remainingAttempts', 0, 'message', 'Trop de tentatives incorrectes. Les retraits sont bloqués pendant 15 minutes.');
  END IF;

  UPDATE public.profiles SET pin_failed_attempts = v_attempts WHERE id = p_user_id;

  INSERT INTO public.audit_logs (user_id, action, details, ip, device, status)
  VALUES (p_user_id, 'withdrawal_failed_pin', 'Tentative de retrait avec PIN erroné.', '197.234.34.82', 'Navigateur', 'failure');

  RETURN jsonb_build_object(
    'ok', false, 'locked', false, 'remainingAttempts', v_max_attempts - v_attempts,
    'message', 'Code PIN incorrect. ' || (v_max_attempts - v_attempts) || ' tentative(s) restante(s).'
  );
END;
$$;

-- Modification sécurisée du PIN utilisateur
CREATE OR REPLACE FUNCTION public.set_user_pin(p_user_id uuid, p_new_pin text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Non autorisé.';
  END IF;

  IF p_new_pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'Le code PIN doit comporter exactement 4 chiffres.';
  END IF;

  PERFORM set_config('eganye.allow_pin_hash_write', 'on', true);

  UPDATE public.profiles
  SET security_pin_hash = crypt(p_new_pin, gen_salt('bf')),
      pin_failed_attempts = 0,
      pin_locked_until = null
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_pin(uuid, text) TO authenticated;

-- Execution des décaissements (payouts) de tontine
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
BEGIN
  -- Réservé à la créatrice du cercle ou à un admin : sans ce garde-fou,
  -- n'importe qui pouvait décaisser le pot complet d'un cercle vers le
  -- portefeuille de son choix (argent créé de toutes pièces, hors ledger).
  IF NOT (public.is_group_creator(p_group_id) OR public.is_admin()) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Non autorisé.');
  END IF;

  -- L'attribution dans le journal d'audit ne peut pas venir du client :
  -- on l'ancre sur l'appelant réellement authentifié.
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

  v_beneficiary_payout := v_total_pot - p_discount_amount;
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
      VALUES (v_member.user_id, '🎉 Intérêts d''enchère reçus !', 'Vous avez reçu un bonus de ' || v_discount_share || ' ' || v_group.currency || ' redistribué suite à l''enchère remportée par ' || v_beneficiary_name || '.', 'payout', '/group/' || p_group_id);
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
  VALUES (p_beneficiary_id, '💰 Fonds de tontine reçus !', 'Félicitations ! Vous avez reçu votre payout de ' || v_beneficiary_payout || ' ' || v_group.currency || ' pour le cycle ' || (v_group.current_payout_index + 1) || '.', 'payout', '/group/' || p_group_id);

  INSERT INTO public.audit_logs (user_id, action, details, ip, device, status, idempotency_key)
  VALUES (p_admin_user_id, 'payout_disbursement', 'Décaissement de tontine pour le groupe [' || v_group.name || '] : ' || v_beneficiary_name || ' reçoit ' || v_beneficiary_payout || ' ' || v_group.currency || ' (Rabais: ' || p_discount_amount || ')', '197.221.34.8', 'Système Tontine', 'success', v_idempotency_key);

  INSERT INTO public.messages (group_id, user_id, user_name, is_system, content)
  VALUES (p_group_id, null, 'Système Tontine', true, CASE WHEN p_discount_amount > 0
    THEN '🎉 Félicitations à ' || v_beneficiary_name || ' qui remporte l''enchère et encaisse un payout net de ' || v_beneficiary_payout || ' ' || v_group.currency || ' ! Un rabais de ' || p_discount_amount || ' ' || v_group.currency || ' a été redistribué équitablement entre les autres membres.'
    ELSE '🎉 Félicitations à ' || v_beneficiary_name || ' qui encaisse un payout complet de ' || v_beneficiary_payout || ' ' || v_group.currency || ' pour ce cycle !' END);

  INSERT INTO public.idempotency_keys (key, transaction_id, user_id, amount, action_type)
  VALUES (v_idempotency_key, v_transaction_id, p_beneficiary_id, v_beneficiary_payout, 'payout_disbursement');

  RETURN jsonb_build_object('success', true, 'message', 'Décaissement de ' || v_beneficiary_payout || ' ' || v_group.currency || ' exécuté avec succès.', 'transactionId', v_transaction_id);
EXCEPTION WHEN others THEN
  INSERT INTO public.audit_logs (user_id, action, details, ip, device, status)
  VALUES (p_admin_user_id, 'payout_disbursement', 'ÉCHEC : ' || sqlerrm, '197.221.34.8', 'Système Tontine', 'failure');
  RETURN jsonb_build_object('success', false, 'message', sqlerrm);
END;
$$;

REVOKE ALL ON FUNCTION public.execute_payout_disbursement(uuid, uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_payout_disbursement(uuid, uuid, uuid, numeric) TO authenticated, service_role;

-- Attribution de la position dans la rotation
CREATE OR REPLACE FUNCTION public.assign_next_payout_position(p_group_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_next_position integer;
BEGIN
  -- Réservé à la créatrice du cercle ou à un admin : cette fonction rigeait
  -- autrement l'ordre de rotation des payouts de n'importe quel cercle.
  IF NOT (public.is_group_creator(p_group_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Non autorisé.';
  END IF;

  SELECT count(*) INTO v_next_position FROM public.group_members
  WHERE group_id = p_group_id AND status = 'active' AND payout_position IS NOT NULL;

  UPDATE public.group_members SET status = 'active', payout_position = v_next_position
  WHERE group_id = p_group_id AND user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_next_payout_position(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_next_payout_position(uuid, uuid) TO authenticated, service_role;

-- ============================================================================
-- MIGRATION COMPLÉMENTAIRE DE STRUCTURE (Abonnements, KYC, Mandataire)
-- ============================================================================

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS kyc_level integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS kyc_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS mandate_name text,
  ADD COLUMN IF NOT EXISTS mandate_phone text,
  ADD COLUMN IF NOT EXISTS mandate_permissions text[] DEFAULT ARRAY['view_contributions', 'receive_reminders'],
  ADD COLUMN IF NOT EXISTS subscription_plan text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;

-- ============================================================================
-- 5. TRAITEMENT SERVEUR DES COTISATIONS DUES (pénalités & prélèvement auto)
-- ============================================================================
-- Équivalent serveur de src/hooks/useWalletDebitor.ts : auparavant, le
-- prélèvement automatique et la pénalité de retard d'un membre ne
-- s'exécutaient que si CE membre avait lui-même l'app ouverte. pg_cron
-- exécute désormais cette même logique pour tout le monde, périodiquement.

CREATE OR REPLACE FUNCTION public.process_due_contributions()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cont record;
  v_member_name text;
  v_current_balance numeric;
  v_pending_penalty numeric;
  v_total_due numeric;
  v_days_late integer;
  v_penalty_amount numeric;
  v_grace integer;
  v_ledger_result jsonb;
  v_penalty_note text;
BEGIN
  FOR v_cont IN
    SELECT c.*, g.name AS group_name, g.currency AS group_currency,
           g.grace_period, g.penalty_type, g.penalty_rate,
           g.penalty_amount AS group_penalty_amount
    FROM public.contributions c
    JOIN public.groups g ON g.id = c.group_id
    WHERE g.status = 'active' AND c.status IN ('pending', 'late')
  LOOP
    SELECT display_name, wallet_balance INTO v_member_name, v_current_balance
    FROM public.profiles WHERE id = v_cont.user_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_pending_penalty := CASE WHEN v_cont.penalty_status = 'pending' THEN COALESCE(v_cont.penalty_applied, 0) ELSE 0 END;
    v_total_due := v_cont.amount + v_pending_penalty;

    IF v_current_balance >= v_total_due THEN
      v_penalty_note := CASE WHEN v_pending_penalty > 0
        THEN ' (dont ' || v_pending_penalty || ' ' || v_cont.group_currency || ' de pénalité de retard)'
        ELSE '' END;

      v_ledger_result := public.execute_financial_transaction(
        p_idempotency_key := 'debit_' || v_cont.id::text,
        p_user_id := v_cont.user_id,
        p_amount := v_total_due,
        p_currency := v_cont.group_currency,
        p_description := 'Cotisation automatique - ' || v_cont.group_name || ' (' || COALESCE(v_cont.period, 'Période') || ')' || v_penalty_note,
        p_action_type := 'contribution_payment',
        p_debit_account := 'user_wallet:' || v_cont.user_id,
        p_credit_account := 'tontine_group:' || v_cont.group_id,
        p_contribution_id := v_cont.id,
        p_group_id := v_cont.group_id
      );

      IF (v_ledger_result->>'success')::boolean THEN
        IF v_pending_penalty > 0 THEN
          UPDATE public.contributions SET penalty_status = 'paid' WHERE id = v_cont.id;
        END IF;

        INSERT INTO public.wallet_transactions (user_id, amount, type, description, status, payment_method, reference)
        VALUES (v_cont.user_id, -v_total_due, 'contribution_debit',
          'Cotisation automatique - ' || v_cont.group_name || ' (' || COALESCE(v_cont.period, 'Période') || ')' || v_penalty_note,
          'completed', 'wallet', COALESCE(v_ledger_result->>'transactionId', v_cont.id::text));

        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (v_cont.user_id, 'Cotisation prélevée - ' || v_cont.group_name,
          'Votre cotisation de ' || v_total_due || ' ' || v_cont.group_currency || ' a été prélevée de votre portefeuille pour la période ' || COALESCE(v_cont.period, '') || v_penalty_note || '.',
          'payout', '/group/' || v_cont.group_id);

        INSERT INTO public.messages (group_id, user_id, user_name, is_system, content)
        VALUES (v_cont.group_id, NULL, 'Système Tontine', true,
          '📢 ' || v_member_name || ' a réglé sa cotisation de ' || v_total_due || ' ' || v_cont.group_currency || ' pour la période ' || COALESCE(v_cont.period, '') || ' par prélèvement automatique !');
      END IF;

    ELSIF NOT v_cont.notified_insufficient THEN
      v_grace := COALESCE(v_cont.grace_period, 0);
      v_days_late := GREATEST(0, (CURRENT_DATE - v_cont.date::date));

      IF v_days_late <= v_grace THEN
        v_penalty_amount := 0;
      ELSIF v_cont.penalty_type = 'percentage' THEN
        v_penalty_amount := GREATEST(0, ROUND(v_cont.amount * (COALESCE(v_cont.penalty_rate, 0) / 100) * v_days_late));
      ELSE
        v_penalty_amount := GREATEST(0, COALESCE(v_cont.group_penalty_amount, 0));
      END IF;

      UPDATE public.contributions SET
        status = 'late',
        notified_insufficient = true,
        penalty_applied = CASE WHEN v_penalty_amount > 0 THEN v_penalty_amount ELSE penalty_applied END,
        penalty_status = CASE WHEN v_penalty_amount > 0 THEN 'pending' ELSE penalty_status END
      WHERE id = v_cont.id;

      v_penalty_note := CASE WHEN v_penalty_amount > 0
        THEN ' Une pénalité de retard de ' || v_penalty_amount || ' ' || v_cont.group_currency || ' a été appliquée.'
        ELSE '' END;

      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (v_cont.user_id, '⚠️ Solde Insuffisant - ' || v_cont.group_name,
        'Le prélèvement de ' || v_cont.amount || ' ' || v_cont.group_currency || ' a échoué car le solde de votre portefeuille est insuffisant (' || v_current_balance || ' ' || v_cont.group_currency || ').' || ' Veuillez recharger.' || v_penalty_note,
        'reminder', '/profile');

      INSERT INTO public.messages (group_id, user_id, user_name, is_system, content)
      VALUES (v_cont.group_id, NULL, 'Système Tontine', true,
        '⚠️ Alerte : Le prélèvement automatique de ' || v_cont.amount || ' ' || v_cont.group_currency || ' de ' || v_member_name || ' a échoué (solde de portefeuille insuffisant).' || v_penalty_note);
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_due_contributions() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('process-due-contributions');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule('process-due-contributions', '*/15 * * * *', $$SELECT public.process_due_contributions();$$);

-- ============================================================================
-- 6. VÉRIFICATION D'IDENTITÉ (KYC) — upload + validation manuelle par un admin
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  id_number text,
  document_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_submissions_user ON public.kyc_submissions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_status ON public.kyc_submissions(status);

ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kyc_submissions_select_own_or_admin" ON public.kyc_submissions;
DROP POLICY IF EXISTS "kyc_submissions_insert_self" ON public.kyc_submissions;
DROP POLICY IF EXISTS "kyc_submissions_update_admin_only" ON public.kyc_submissions;

CREATE POLICY "kyc_submissions_select_own_or_admin" ON public.kyc_submissions FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "kyc_submissions_insert_self" ON public.kyc_submissions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "kyc_submissions_update_admin_only" ON public.kyc_submissions FOR UPDATE USING (public.is_admin());

-- Helper mirroring is_admin()/is_group_member() style, used to gate group
-- creation/joining below.
CREATE OR REPLACE FUNCTION public.is_kyc_verified()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND kyc_level >= 2
  );
$$;

-- Admin-only review action: approves/rejects a submission and, on approval,
-- promotes the profile's kyc_level so is_kyc_verified() unlocks.
CREATE OR REPLACE FUNCTION public.review_kyc_submission(
  p_submission_id uuid,
  p_approve boolean,
  p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub record;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Non autorisé.');
  END IF;

  SELECT * INTO v_sub FROM public.kyc_submissions WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Soumission introuvable.');
  END IF;

  IF p_approve THEN
    UPDATE public.kyc_submissions SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = NULL
    WHERE id = p_submission_id;

    UPDATE public.profiles SET kyc_level = GREATEST(kyc_level, 2), kyc_verified_at = now()
    WHERE id = v_sub.user_id;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (v_sub.user_id, '✅ Identité vérifiée', 'Votre pièce d''identité a été validée. Vous pouvez maintenant créer ou rejoindre des cercles de tontine.', 'system');
  ELSE
    UPDATE public.kyc_submissions SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = p_rejection_reason
    WHERE id = p_submission_id;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (v_sub.user_id, '❌ Vérification refusée', COALESCE('Votre vérification d''identité a été refusée : ' || p_rejection_reason, 'Votre vérification d''identité a été refusée.'), 'system');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Soumission traitée.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_kyc_submission(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_kyc_submission(uuid, boolean, text) TO authenticated;

-- Gate group creation/joining behind KYC verification.
DROP POLICY IF EXISTS "groups_insert_self_as_creator" ON public.groups;
CREATE POLICY "groups_insert_self_as_creator" ON public.groups FOR INSERT WITH CHECK (creator_id = auth.uid() AND public.is_kyc_verified());

DROP POLICY IF EXISTS "group_members_insert_self" ON public.group_members;
CREATE POLICY "group_members_insert_self" ON public.group_members FOR INSERT WITH CHECK (user_id = auth.uid() AND public.is_kyc_verified());

-- Private storage bucket for uploaded ID documents.
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "kyc_documents_storage_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "kyc_documents_storage_select_own_or_admin" ON storage.objects;

CREATE POLICY "kyc_documents_storage_insert_own" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "kyc_documents_storage_select_own_or_admin" ON storage.objects FOR SELECT USING (bucket_id = 'kyc-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));

-- ============================================================================
-- 7. IDENTITÉ DÉCLARATIVE DU PROFIL (Prénom, Nom, Date de naissance)
-- ============================================================================
-- Ces champs existaient dans l'UI (Profile.tsx, onglet "Informations
-- personnelles") avec des valeurs d'exemple codées en dur, sans jamais avoir
-- de colonne réelle derrière ni être sauvegardés.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS phone text;

-- ============================================================================
-- 9. VRAI AVATAR (photo ou illustration) — remplace le flux base64 cassé
-- ============================================================================
-- L'ancien flux "Téléverser une photo" ne faisait que lire le fichier côté
-- client (FileReader.readAsDataURL) sans jamais le persister réellement : la
-- data URI finissait dans avatar_config (jsonb), puis mapProfileRow la
-- ré-encapsulait avec JSON.stringify(...), ajoutant un guillemet de tête qui
-- cassait le test `startsWith('http')` de CustomAvatar — la photo ne
-- s'affichait donc plus jamais après un rechargement. avatar_config est
-- laissé tel quel (non supprimé, plus utilisé).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Notification channel preferences (SMS via Africa's Talking, WhatsApp via
-- Twilio) — push_enabled/email_notifications_enabled already existed.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sms_notifications_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_notifications_enabled boolean NOT NULL DEFAULT false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_storage_select_public" ON storage.objects;
DROP POLICY IF EXISTS "avatars_storage_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_storage_update_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_storage_delete_own" ON storage.objects;

CREATE POLICY "avatars_storage_select_public" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_storage_insert_own" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_storage_update_own" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_storage_delete_own" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- 8. TIRAGE AU SORT PERSISTÉ (mode "draw")
-- ============================================================================
-- Auparavant purement client (useState + Math.random() dans GroupDetails.tsx) :
-- perdu au rechargement de page, et un admin pouvait retirer indéfiniment
-- jusqu'à obtenir un résultat qui l'arrange. Le tirage est désormais persisté
-- et ne peut plus être refait tant que le cycle courant n'a pas été distribué.

ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS drawn_beneficiary_id uuid REFERENCES public.profiles(id);

CREATE OR REPLACE FUNCTION public.draw_payout_beneficiary(p_group_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_group record;
  v_picked uuid;
BEGIN
  SELECT * INTO v_group FROM public.groups WHERE id = p_group_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Le cercle n''existe pas.';
  END IF;

  IF NOT (public.is_group_creator(p_group_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Non autorisé.';
  END IF;

  IF v_group.drawn_beneficiary_id IS NOT NULL THEN
    RETURN v_group.drawn_beneficiary_id;
  END IF;

  SELECT user_id INTO v_picked
  FROM public.group_members
  WHERE group_id = p_group_id AND status = 'active' AND payout_position >= v_group.current_payout_index
  ORDER BY random()
  LIMIT 1;

  IF v_picked IS NULL THEN
    RAISE EXCEPTION 'Aucun membre éligible pour le tirage.';
  END IF;

  UPDATE public.groups SET drawn_beneficiary_id = v_picked WHERE id = p_group_id;
  RETURN v_picked;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.draw_payout_beneficiary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.draw_payout_beneficiary(uuid) TO authenticated;

-- ============================================================================
-- 10. MARKETPLACE — catalogue réel + demandes persistées (remplace le mockup)
-- ============================================================================
-- Marketplace.tsx était un pur mockup : tableau de services codé en dur,
-- handleAction() ne faisait qu'un `setTimeout` de 1.5s puis un toast — aucune
-- demande n'était jamais enregistrée, alors que le texte promettait "notre
-- partenaire vous contactera sous 24h".

CREATE TABLE IF NOT EXISTS public.marketplace_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL UNIQUE,
  description text NOT NULL,
  provider text NOT NULL,
  category text NOT NULL CHECK (category IN ('assurance', 'credit', 'equipement')),
  icon_name text NOT NULL,
  color_class text NOT NULL DEFAULT 'bg-brand',
  requirements text[],
  min_reputation_score integer,
  action_label text NOT NULL DEFAULT 'Faire une demande',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketplace_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.marketplace_services(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'approved', 'rejected')),
  admin_notes text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Uniquement pour les services category='credit' (ex: Micro-crédit Agricole) —
  -- restent NULL pour assurance/équipement.
  requested_amount numeric,
  approved_amount numeric,
  repaid_amount numeric NOT NULL DEFAULT 0,
  repayment_deadline date,
  disbursed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_marketplace_requests_user ON public.marketplace_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_requests_status ON public.marketplace_requests(status);

ALTER TABLE public.marketplace_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketplace_services_select" ON public.marketplace_services;
DROP POLICY IF EXISTS "marketplace_services_admin_write" ON public.marketplace_services;
DROP POLICY IF EXISTS "marketplace_requests_select_own_or_admin" ON public.marketplace_requests;
DROP POLICY IF EXISTS "marketplace_requests_insert_self" ON public.marketplace_requests;
DROP POLICY IF EXISTS "marketplace_requests_update_admin_only" ON public.marketplace_requests;

CREATE POLICY "marketplace_services_select" ON public.marketplace_services FOR SELECT USING (is_active = true OR public.is_admin());
CREATE POLICY "marketplace_services_admin_write" ON public.marketplace_services FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "marketplace_requests_select_own_or_admin" ON public.marketplace_requests FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "marketplace_requests_insert_self" ON public.marketplace_requests FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "marketplace_requests_update_admin_only" ON public.marketplace_requests FOR UPDATE USING (public.is_admin());

INSERT INTO public.marketplace_services (title, description, provider, category, icon_name, color_class, requirements, min_reputation_score, action_label)
VALUES
  ('Assurance Santé Tontine', 'Couverture médicale de base pour vous et votre famille. Payez mensuellement avec le solde de votre portefeuille.', 'Partenaire INAM / Assurances', 'assurance', 'ShieldPlus', 'bg-blue-500', ARRAY['Score de réputation 70+ (Tier A minimum)', 'Solde wallet: 2000 FCFA/mois'], 70, 'Souscrire à l''assurance'),
  ('Micro-crédit Agricole', 'Financez vos semences et intrants pour la saison. Remboursement adossé à vos rentrées de tontine.', 'Fonds d''Appui Agricole', 'credit', 'Tractor', 'bg-green-600', ARRAY['Score de réputation 70+ (Tier A ou S)', 'Avoir terminé 1 cycle de tontine'], 70, 'Demander le crédit'),
  ('Kit Solaire PAYGO', 'Équipez-vous en panneaux solaires. Le paiement fractionné est prélevé automatiquement sur vos tours de tontine.', 'EnergieTogo / Bboxx', 'equipement', 'Zap', 'bg-amber-500', ARRAY['Validation du gestionnaire du groupe'], NULL, 'Commander le kit'),
  ('Épargne Retraite', 'Convertissez une partie de vos gains de tontine en une épargne retraite bloquée à fort rendement (7%/an).', 'Caisse de Retraite', 'assurance', 'TrendingUp', 'bg-purple-500', NULL, NULL, 'Ouvrir un compte retraite')
ON CONFLICT (title) DO NOTHING;

-- ============================================================================
-- 11. PARAMÈTRES DE LA PLATEFORME (mode maintenance, inscriptions)
-- ============================================================================
-- Les interrupteurs "Mode maintenance" / "Autoriser les inscriptions" dans
-- AdminDashboard ne faisaient auparavant que changer un useState local + un
-- toast — rien n'était persisté ni jamais vérifié ailleurs dans l'app. Table
-- singleton (une seule ligne, id=1) lue par tout le monde (y compris anon,
-- car Onboarding doit vérifier allow_signups avant même la connexion) et
-- modifiable uniquement par un admin.

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  maintenance_mode boolean NOT NULL DEFAULT false,
  allow_signups boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

INSERT INTO public.platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings_select_all" ON public.platform_settings;
DROP POLICY IF EXISTS "platform_settings_update_admin_only" ON public.platform_settings;

CREATE POLICY "platform_settings_select_all" ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "platform_settings_update_admin_only" ON public.platform_settings FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================================
-- 12. MARKETPLACE — CRÉDIT RÉEL (décaissement + remboursements multiples)
-- ============================================================================
-- L'approbation d'une demande "Micro-crédit Agricole" (category='credit')
-- ne faisait auparavant qu'envoyer une notification — aucun argent ne
-- bougeait, alors que le texte du service annonce un vrai crédit. Le
-- décaissement passe par execute_financial_transaction (même registre
-- comptable double-entrée que le reste de l'app) et le remboursement peut
-- se faire en plusieurs fois (repaid_amount s'incrémente à chaque appel).

CREATE OR REPLACE FUNCTION public.approve_marketplace_credit(
  p_request_id uuid,
  p_approved_amount numeric,
  p_repayment_deadline date,
  p_admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_req record;
  v_service record;
  v_ledger_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Non autorisé.');
  END IF;

  IF p_approved_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le montant approuvé doit être supérieur à zéro.');
  END IF;

  SELECT * INTO v_req FROM public.marketplace_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Demande introuvable.');
  END IF;
  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cette demande a déjà été traitée.');
  END IF;

  SELECT * INTO v_service FROM public.marketplace_services WHERE id = v_req.service_id;
  IF NOT FOUND OR v_service.category <> 'credit' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce service n''est pas un service de crédit.');
  END IF;

  UPDATE public.marketplace_requests SET
    status = 'approved',
    approved_amount = p_approved_amount,
    repayment_deadline = p_repayment_deadline,
    admin_notes = p_admin_notes,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    disbursed_at = now()
  WHERE id = p_request_id;

  v_ledger_result := public.execute_financial_transaction(
    p_idempotency_key := 'credit_disbursement_' || p_request_id::text,
    p_user_id := v_req.user_id,
    p_amount := p_approved_amount,
    p_currency := 'FCFA',
    p_description := 'Décaissement crédit — ' || v_service.title,
    p_action_type := 'admin_adjustment',
    p_debit_account := 'marketplace_credit:' || v_req.service_id::text,
    p_credit_account := 'user_wallet:' || v_req.user_id::text
  );

  IF NOT (v_ledger_result->>'success')::boolean THEN
    RAISE EXCEPTION '%', v_ledger_result->>'message';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    v_req.user_id,
    'Crédit approuvé et décaissé !',
    'Votre crédit "' || v_service.title || '" de ' || p_approved_amount || ' FCFA a été approuvé et versé sur votre portefeuille. À rembourser avant le ' || to_char(p_repayment_deadline, 'DD/MM/YYYY') || '.',
    'system'
  );

  RETURN jsonb_build_object('success', true, 'message', 'Crédit approuvé et décaissé.');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', sqlerrm);
END;
$$;

-- L'ancienne clé d'idempotence incluait extract(epoch from now()), donc
-- chaque appel — y compris un rejeu réseau de la même tentative — obtenait
-- une clé différente et repassait la garde d'idempotence : un remboursement
-- pouvait être débité deux fois. Le client fournit maintenant une clé stable
-- par tentative (même schéma que le retrait dans Profile.tsx).
DROP FUNCTION IF EXISTS public.repay_marketplace_credit(uuid, numeric);

CREATE OR REPLACE FUNCTION public.repay_marketplace_credit(
  p_request_id uuid,
  p_amount numeric,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_req record;
  v_remaining numeric;
  v_ledger_result jsonb;
  v_key text;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le montant doit être supérieur à zéro.');
  END IF;

  SELECT * INTO v_req FROM public.marketplace_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Crédit introuvable.');
  END IF;
  -- auth.uid() IS NULL pour un appel anonyme : sans ce cas explicite,
  -- `v_req.user_id <> NULL` vaut NULL (donc "faux" pour un IF), et le
  -- contrôle d'autorisation ci-dessous était silencieusement contourné.
  IF auth.uid() IS NULL OR v_req.user_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Non autorisé.');
  END IF;
  IF v_req.status <> 'approved' OR v_req.approved_amount IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce crédit n''est pas actif.');
  END IF;

  v_remaining := v_req.approved_amount - v_req.repaid_amount;
  IF p_amount > v_remaining THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce montant dépasse le solde restant dû (' || v_remaining || ' FCFA).');
  END IF;

  v_key := COALESCE(p_idempotency_key, 'credit_repayment_' || p_request_id::text || '_' || gen_random_uuid()::text);

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

  IF NOT (v_ledger_result->>'success')::boolean THEN
    RETURN jsonb_build_object('success', false, 'message', v_ledger_result->>'message');
  END IF;

  UPDATE public.marketplace_requests SET repaid_amount = repaid_amount + p_amount WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'message', 'Remboursement enregistré.', 'remainingBalance', v_remaining - p_amount);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', sqlerrm);
END;
$$;

REVOKE ALL ON FUNCTION public.repay_marketplace_credit(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repay_marketplace_credit(uuid, numeric, text) TO authenticated, service_role;

-- ============================================================================
-- 13. MA BANQUE — tirelires personnelles bloquées, avec délai réel
-- ============================================================================
-- L'idée : un membre dépose de l'argent dans une "banque" avec un délai
-- (ex: 1 mois) ; l'argent est réellement bloqué jusqu'à l'échéance, contre
-- l'habitude de "casser sa tirelire" avant terme. Accès payant par palier
-- (nombre de banques simultanées), distinct de tout abonnement du site.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bank_tier text NOT NULL DEFAULT 'none' CHECK (bank_tier IN ('none', 'starter', 'growth', 'unlimited')),
  ADD COLUMN IF NOT EXISTS bank_subscription_expires_at timestamptz;

CREATE TABLE IF NOT EXISTS public.personal_vaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  balance numeric NOT NULL DEFAULT 0,
  lock_days integer NOT NULL CHECK (lock_days > 0),
  unlock_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personal_vaults_user ON public.personal_vaults(user_id, created_at DESC);

ALTER TABLE public.personal_vaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "personal_vaults_owner_or_admin" ON public.personal_vaults;
CREATE POLICY "personal_vaults_owner_or_admin" ON public.personal_vaults FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
-- Pas de policy INSERT/UPDATE/DELETE directe : tout passe par les RPC
-- ci-dessous (SECURITY DEFINER) pour garantir le respect du plafond
-- d'abonnement et le blocage réel des fonds pendant le délai.

CREATE OR REPLACE FUNCTION public.bank_tier_max_vaults(p_tier text)
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_tier
    WHEN 'starter' THEN 5
    WHEN 'growth' THEN 20
    WHEN 'unlimited' THEN 999
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.bank_tier_price(p_tier text)
RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_tier
    WHEN 'starter' THEN 1000
    WHEN 'growth' THEN 2500
    WHEN 'unlimited' THEN 5000
    ELSE 0
  END;
$$;

-- Souscription (ou renouvellement) : débite le portefeuille pour de vrai,
-- passe par le même registre comptable double-entrée que le reste de l'app.
CREATE OR REPLACE FUNCTION public.subscribe_bank_tier(p_tier text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_price numeric;
  v_ledger_result jsonb;
BEGIN
  IF p_tier NOT IN ('starter', 'growth', 'unlimited') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Palier invalide.');
  END IF;

  v_price := public.bank_tier_price(p_tier);

  v_ledger_result := public.execute_financial_transaction(
    p_idempotency_key := 'bank_sub_' || auth.uid()::text || '_' || to_char(now(), 'YYYYMMDD') || '_' || p_tier,
    p_user_id := auth.uid(),
    p_amount := v_price,
    p_currency := 'FCFA',
    p_description := 'Abonnement Ma Banque — palier ' || p_tier,
    p_action_type := 'bank_subscription',
    p_debit_account := 'user_wallet:' || auth.uid()::text,
    p_credit_account := 'eganye_platform_revenue'
  );

  IF NOT (v_ledger_result->>'success')::boolean THEN
    RETURN jsonb_build_object('success', false, 'message', v_ledger_result->>'message');
  END IF;

  UPDATE public.profiles SET
    bank_tier = p_tier,
    bank_subscription_expires_at = GREATEST(COALESCE(bank_subscription_expires_at, now()), now()) + interval '1 month'
  WHERE id = auth.uid();

  RETURN jsonb_build_object('success', true, 'message', 'Abonnement Ma Banque activé.');
END;
$$;

CREATE OR REPLACE FUNCTION public.create_personal_vault(
  p_name text,
  p_description text,
  p_lock_days integer
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_vault_count integer;
  v_max integer;
  v_new_vault_id uuid;
BEGIN
  IF p_lock_days IS NULL OR p_lock_days <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le délai doit être supérieur à zéro jour.');
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le nom de la banque est requis.');
  END IF;

  SELECT bank_tier, bank_subscription_expires_at INTO v_profile FROM public.profiles WHERE id = auth.uid();

  IF v_profile.bank_tier = 'none' OR v_profile.bank_subscription_expires_at IS NULL OR v_profile.bank_subscription_expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Abonnement Ma Banque inactif ou expiré. Souscrivez d''abord un palier.');
  END IF;

  SELECT count(*) INTO v_vault_count FROM public.personal_vaults WHERE user_id = auth.uid();
  v_max := public.bank_tier_max_vaults(v_profile.bank_tier);

  IF v_vault_count >= v_max THEN
    RETURN jsonb_build_object('success', false, 'message', 'Plafond de banques atteint pour votre palier (' || v_max || ').');
  END IF;

  INSERT INTO public.personal_vaults (user_id, name, description, lock_days, unlock_at)
  VALUES (auth.uid(), trim(p_name), NULLIF(trim(coalesce(p_description, '')), ''), p_lock_days, now() + (p_lock_days || ' days')::interval)
  RETURNING id INTO v_new_vault_id;

  RETURN jsonb_build_object('success', true, 'message', 'Banque créée.', 'vaultId', v_new_vault_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.deposit_to_vault(
  p_vault_id uuid,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_vault record;
  v_ledger_result jsonb;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le montant doit être supérieur à zéro.');
  END IF;

  SELECT * INTO v_vault FROM public.personal_vaults WHERE id = p_vault_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Banque introuvable.');
  END IF;

  v_ledger_result := public.execute_financial_transaction(
    p_idempotency_key := 'vault_deposit_' || p_vault_id::text || '_' || extract(epoch from now())::text,
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
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_vault record;
  v_ledger_result jsonb;
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

  v_ledger_result := public.execute_financial_transaction(
    p_idempotency_key := 'vault_withdraw_' || p_vault_id::text || '_' || extract(epoch from now())::text,
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

CREATE OR REPLACE FUNCTION public.relock_vault(
  p_vault_id uuid,
  p_lock_days integer
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_vault record;
BEGIN
  IF p_lock_days IS NULL OR p_lock_days <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le délai doit être supérieur à zéro jour.');
  END IF;

  SELECT * INTO v_vault FROM public.personal_vaults WHERE id = p_vault_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Banque introuvable.');
  END IF;

  UPDATE public.personal_vaults SET lock_days = p_lock_days, unlock_at = now() + (p_lock_days || ' days')::interval
  WHERE id = p_vault_id;

  RETURN jsonb_build_object('success', true, 'message', 'Banque re-bloquée.');
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_empty_vault(p_vault_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_vault record;
BEGIN
  SELECT * INTO v_vault FROM public.personal_vaults WHERE id = p_vault_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Banque introuvable.');
  END IF;
  IF v_vault.balance > 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Videz la banque avant de la supprimer.');
  END IF;

  DELETE FROM public.personal_vaults WHERE id = p_vault_id;
  RETURN jsonb_build_object('success', true, 'message', 'Banque supprimée.');
END;
$$;


-- ============================================================================
-- MIGRATIONS 0011-0014 — durcissement de sécurité (appliqué après le socle
-- ci-dessus). Repris tel qu'appliqué en production pour que ce fichier,
-- rejoué sur une base neuve, produise exactement le même état final.
-- Voir supabase/migrations/0011_*.sql à 0014_*.sql pour le contexte de
-- chaque correctif.
-- ============================================================================

-- ============================================================================
-- 0011 — COLONNES PRIVILÉGIÉES, COTISATIONS ET NOTIFICATIONS
-- ============================================================================
-- Revue de sécurité de la plateforme. Trois failles exploitables en une
-- requête depuis n'importe quel compte connecté.
--
--   1. LA PLUS GRAVE — `profiles_update_self_or_admin` autorise une
--      utilisatrice à modifier sa propre ligne, sans aucune restriction de
--      colonne. Or `wallet_balance` est une colonne de cette table :
--
--          supabase.from('profiles')
--            .update({ wallet_balance: 99999999 })
--            .eq('id', <son propre id>)
--
--      Tout le durcissement des migrations 0005 et 0010 sur
--      execute_financial_transaction ne servait donc à rien : il gardait la
--      porte pendant que la fenêtre restait ouverte. La migration 0004 avait
--      déjà identifié ce risque pour security_pin_hash et posé un déclencheur
--      dédié — mais uniquement pour cette colonne-là.
--
--      Même mécanisme pour `kyc_level` : les policies d'insertion de groupes
--      exigent is_kyc_verified(), qu'il suffisait de s'auto-attribuer pour
--      contourner la vérification d'identité.
--
--   2. Sur `contributions`, la policy était en ALL pour tout membre du
--      cercle. N'importe quel membre pouvait donc marquer sa propre
--      cotisation `paid` sans payer, ou modifier celles des autres.
--
--   3. `notifications_insert_authenticated` ne vérifiait que le fait d'être
--      connecté, pas le destinataire : on pouvait écrire une notification
--      dans l'application de n'importe qui. Dans un produit d'argent, c'est
--      un canal d'hameçonnage prêt à l'emploi (« votre compte est bloqué,
--      appelez ce numéro »), avec l'autorité visuelle de l'application.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Colonnes privilégiées de `profiles`
-- ----------------------------------------------------------------------------
-- On garde la policy telle quelle (l'utilisatrice doit pouvoir changer son
-- nom, sa langue, son avatar…) et on interdit au niveau du déclencheur les
-- seules colonnes qui donnent de l'argent, des droits ou un statut.
--
-- Comment distinguer une écriture légitime ? Par le rôle effectif, et non
-- par un drapeau applicatif : les fonctions qui déplacent l'argent sont en
-- SECURITY DEFINER et appartiennent à `postgres`, donc `current_user` y vaut
-- 'postgres' ; le webhook du prestataire écrit en 'service_role' ; une
-- requête PostgREST venue du navigateur, elle, s'exécute toujours en
-- 'authenticated'. C'est un signal que l'appelant ne peut pas falsifier, et
-- il évite de réécrire les trois fonctions d'argent pour y poser un drapeau.
-- SECURITY INVOKER, et non DEFINER : une fonction DEFINER s'exécute sous
-- l'identité de son propriétaire, si bien que `current_user` y vaudrait
-- toujours 'postgres' — y compris pour une écriture venue du navigateur. La
-- garde ci-dessous serait alors vraie en permanence et ne bloquerait rien.
-- (Erreur commise puis corrigée : le test d'intrusion l'a révélée.)
create or replace function public.prevent_privileged_profile_changes()
returns trigger
language plpgsql security invoker set search_path = public
as $$
declare
  v_allowed boolean := current_user not in ('authenticated', 'anon');
begin
  -- Un administrateur ajuste légitimement un solde ou une réputation depuis
  -- le panneau d'administration ; la traçabilité de ce geste est traitée
  -- séparément (voir la revue : ces écritures ne passent pas par le grand
  -- livre et échappent donc à la réconciliation).
  if v_allowed or public.is_admin() then
    return new;
  end if;

  if new.wallet_balance is distinct from old.wallet_balance
     or new.total_saved is distinct from old.total_saved
     or new.reputation_score is distinct from old.reputation_score
     or new.groups_joined is distinct from old.groups_joined
     or new.kyc_level is distinct from old.kyc_level
     or new.kyc_verified_at is distinct from old.kyc_verified_at
     or new.bank_tier is distinct from old.bank_tier
     or new.bank_subscription_expires_at is distinct from old.bank_subscription_expires_at
     or new.subscription_plan is distinct from old.subscription_plan
     or new.subscription_expires_at is distinct from old.subscription_expires_at
     -- Sans ces deux-là, le verrouillage après échecs de PIN se remet à zéro
     -- d'une requête : la protection contre l'essai systématique des 10 000
     -- combinaisons à quatre chiffres n'existerait plus.
     or new.pin_failed_attempts is distinct from old.pin_failed_attempts
     or new.pin_locked_until is distinct from old.pin_locked_until
  then
    raise exception 'Ces informations ne peuvent pas être modifiées directement.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_privileged_profile_changes on public.profiles;
create trigger trg_prevent_privileged_profile_changes
  before update on public.profiles
  for each row execute function public.prevent_privileged_profile_changes();


-- ----------------------------------------------------------------------------
-- 2. Le hachage du PIN n'est plus lisible par les autres
-- ----------------------------------------------------------------------------
-- `profiles_select_all` ouvre la table entière à toute personne connectée,
-- security_pin_hash compris. Un PIN à quatre chiffres n'a que 10 000
-- valeurs possibles : disposer du hachage, c'est disposer du PIN après
-- quelques secondes de calcul hors ligne.
--
-- RLS filtre les lignes, pas les colonnes — d'où ce retrait de privilège au
-- niveau colonne, qui se combine avec la policy existante.
-- Retirer le privilège au niveau TABLE d'abord : Postgres n'autorise pas à
-- soustraire une colonne d'un SELECT accordé sur la table entière. Un simple
-- `revoke select (colonnes)` n'aurait donc eu aucun effet.
--
-- Conséquence côté application : `select('*')` sur profiles échoue désormais,
-- d'où la liste explicite PROFILE_COLUMNS (src/lib/mappers.ts).
--
-- `anon` perd la lecture entièrement : la policy exige déjà
-- auth.role() = 'authenticated', donc ce rôle ne lisait aucune ligne.
revoke select on public.profiles from authenticated, anon;

grant select (
  id, email, display_name, avatar_config, avatar_url,
  reputation_score, total_saved, groups_joined, role, wallet_balance,
  language, theme, biometrics_enabled, push_enabled,
  email_notifications_enabled, sms_notifications_enabled,
  whatsapp_notifications_enabled, created_at, updated_at,
  kyc_level, kyc_verified_at, mandate_name, mandate_phone,
  mandate_permissions, subscription_plan, subscription_expires_at,
  first_name, last_name, date_of_birth, phone,
  bank_tier, bank_subscription_expires_at
) on public.profiles to authenticated;


-- ----------------------------------------------------------------------------
-- 3. Cotisations : on ne se déclare pas payé soi-même
-- ----------------------------------------------------------------------------
drop policy if exists "contributions_all_group_member_or_admin" on public.contributions;

-- Lecture : inchangée, tout membre du cercle voit les cotisations de tous
-- (c'est le principe même d'une tontine — la transparence fait la confiance).
create policy "contributions_select_group_member_or_admin" on public.contributions
  for select using (public.is_group_member(group_id) or public.is_admin());

-- Création et suppression : l'organisatrice du cercle, ou un administrateur.
create policy "contributions_insert_creator_or_admin" on public.contributions
  for insert with check (public.is_group_creator(group_id) or public.is_admin());

create policy "contributions_delete_creator_or_admin" on public.contributions
  for delete using (public.is_group_creator(group_id) or public.is_admin());

-- Modification : l'organisatrice, un administrateur, ou la personne concernée
-- — cette dernière uniquement pour déclarer un paiement en attente de
-- validation (voir le déclencheur ci-dessous).
create policy "contributions_update_owner_creator_or_admin" on public.contributions
  for update using (
    public.is_group_creator(group_id) or public.is_admin() or user_id = auth.uid()
  );

-- SECURITY INVOKER pour la même raison qu'au point 1.
create or replace function public.prevent_self_settling_contribution()
returns trigger
language plpgsql security invoker set search_path = public
as $$
declare
  -- Même raisonnement qu'au point 1 : execute_financial_transaction solde la
  -- cotisation en SECURITY DEFINER, donc en 'postgres'.
  v_allowed boolean := current_user not in ('authenticated', 'anon');
begin
  if v_allowed or public.is_group_creator(new.group_id) or public.is_admin() then
    return new;
  end if;

  -- Déclarer un virement effectué reste possible : c'est `pending_approval`,
  -- qui attend précisément la validation de l'organisatrice. Ce qui est
  -- interdit, c'est de se solder soi-même.
  if (new.status = 'paid' and old.status is distinct from 'paid')
     or (new.penalty_status = 'paid' and old.penalty_status is distinct from 'paid')
  then
    raise exception 'Seule l''organisatrice du cercle peut valider un paiement.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_self_settling_contribution on public.contributions;
create trigger trg_prevent_self_settling_contribution
  before update on public.contributions
  for each row execute function public.prevent_self_settling_contribution();


-- ----------------------------------------------------------------------------
-- 4. Notifications : seulement à soi-même, à ses co-membres, ou en admin
-- ----------------------------------------------------------------------------
-- Les envois légitimes vers autrui passent tous par un cercle partagé :
-- rappel de cotisation, arrivée d'un membre, distribution. Cette fonction
-- décrit exactement ce périmètre.
create or replace function public.shares_group_with(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on b.group_id = a.group_id
    where a.user_id = auth.uid()
      and b.user_id = p_user_id
      and a.status = 'active'
      and b.status = 'active'
  );
$$;

grant execute on function public.shares_group_with(uuid) to authenticated;

drop policy if exists "notifications_insert_authenticated" on public.notifications;
create policy "notifications_insert_self_or_co_member" on public.notifications
  for insert with check (
    user_id = auth.uid() or public.is_admin() or public.shares_group_with(user_id)
  );


-- ----------------------------------------------------------------------------
-- 5. Le prélèvement automatique solde la pénalité côté serveur
-- ----------------------------------------------------------------------------
-- useWalletDebitor marquait `penalty_status = 'paid'` par une requête client
-- juste après le débit — ce que le déclencheur du point 3 refuse désormais,
-- et à raison : cette écriture attestait d'un paiement sans preuve. Elle
-- rejoint donc la transaction qui encaisse réellement l'argent.
create or replace function public.settle_contribution_penalty(p_contribution_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  -- Ne solde que si la cotisation vient d'être payée : la pénalité suit le
  -- sort de la cotisation, elle ne s'efface pas toute seule.
  update public.contributions
     set penalty_status = 'paid', updated_at = now()
   where id = p_contribution_id
     and status = 'paid'
     and penalty_status = 'pending'
     and (user_id = auth.uid() or public.is_group_creator(group_id) or public.is_admin());
end;
$$;

revoke all on function public.settle_contribution_penalty(uuid) from public, anon;
grant execute on function public.settle_contribution_penalty(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 6. Plus de double ligne d'historique sur le prélèvement automatique
-- ----------------------------------------------------------------------------
-- Depuis la migration 0010, execute_financial_transaction écrit elle-même la
-- ligne wallet_transactions. process_due_contributions, qui tourne toutes les
-- quinze minutes, en insérait une seconde juste après : chaque cotisation
-- automatique allait donc apparaître deux fois dans l'historique, et compter
-- double dans les graphiques qui somment cette table.
--
-- Le solde, lui, restait juste — wallet_transactions est un journal
-- d'affichage, pas la source du solde. C'était donc un défaut de lecture, pas
-- de comptabilité, mais il aurait fait douter de chaque relevé.
--
-- Aucun doublon n'existe à ce jour : aucun prélèvement automatique n'a eu lieu
-- entre l'application de 0010 et celle-ci.
CREATE OR REPLACE FUNCTION public.process_due_contributions()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_cont record;
  v_member_name text;
  v_current_balance numeric;
  v_pending_penalty numeric;
  v_total_due numeric;
  v_days_late integer;
  v_penalty_amount numeric;
  v_grace integer;
  v_ledger_result jsonb;
  v_penalty_note text;
BEGIN
  FOR v_cont IN
    SELECT c.*, g.name AS group_name, g.currency AS group_currency,
           g.grace_period, g.penalty_type, g.penalty_rate,
           g.penalty_amount AS group_penalty_amount
    FROM public.contributions c
    JOIN public.groups g ON g.id = c.group_id
    WHERE g.status = 'active' AND c.status IN ('pending', 'late')
  LOOP
    SELECT display_name, wallet_balance INTO v_member_name, v_current_balance
    FROM public.profiles WHERE id = v_cont.user_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_pending_penalty := CASE WHEN v_cont.penalty_status = 'pending' THEN COALESCE(v_cont.penalty_applied, 0) ELSE 0 END;
    v_total_due := v_cont.amount + v_pending_penalty;

    IF v_current_balance >= v_total_due THEN
      v_penalty_note := CASE WHEN v_pending_penalty > 0
        THEN ' (dont ' || v_pending_penalty || ' ' || v_cont.group_currency || ' de pénalité de retard)'
        ELSE '' END;

      v_ledger_result := public.execute_financial_transaction(
        p_idempotency_key := 'debit_' || v_cont.id::text,
        p_user_id := v_cont.user_id,
        p_amount := v_total_due,
        p_currency := v_cont.group_currency,
        p_description := 'Cotisation automatique - ' || v_cont.group_name || ' (' || COALESCE(v_cont.period, 'Période') || ')' || v_penalty_note,
        p_action_type := 'contribution_payment',
        p_debit_account := 'user_wallet:' || v_cont.user_id,
        p_credit_account := 'tontine_group:' || v_cont.group_id,
        p_contribution_id := v_cont.id,
        p_group_id := v_cont.group_id
      );

      IF (v_ledger_result->>'success')::boolean THEN
        IF v_pending_penalty > 0 THEN
          UPDATE public.contributions SET penalty_status = 'paid' WHERE id = v_cont.id;
        END IF;

        -- (L'insertion dans wallet_transactions qui se trouvait ici est
        -- retirée : execute_financial_transaction s'en charge désormais.)

        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (v_cont.user_id, 'Cotisation prélevée - ' || v_cont.group_name,
          'Votre cotisation de ' || v_total_due || ' ' || v_cont.group_currency || ' a été prélevée de votre portefeuille pour la période ' || COALESCE(v_cont.period, '') || v_penalty_note || '.',
          'payout', '/group/' || v_cont.group_id);

        INSERT INTO public.messages (group_id, user_id, user_name, is_system, content)
        VALUES (v_cont.group_id, NULL, 'Système Tontine', true,
          '📢 ' || v_member_name || ' a réglé sa cotisation de ' || v_total_due || ' ' || v_cont.group_currency || ' pour la période ' || COALESCE(v_cont.period, '') || ' par prélèvement automatique !');
      END IF;

    ELSIF NOT v_cont.notified_insufficient THEN
      v_grace := COALESCE(v_cont.grace_period, 0);
      v_days_late := GREATEST(0, (CURRENT_DATE - v_cont.date::date));

      IF v_days_late <= v_grace THEN
        v_penalty_amount := 0;
      ELSIF v_cont.penalty_type = 'percentage' THEN
        v_penalty_amount := GREATEST(0, ROUND(v_cont.amount * (COALESCE(v_cont.penalty_rate, 0) / 100) * v_days_late));
      ELSE
        v_penalty_amount := GREATEST(0, COALESCE(v_cont.group_penalty_amount, 0));
      END IF;

      UPDATE public.contributions SET
        status = 'late',
        notified_insufficient = true,
        penalty_applied = CASE WHEN v_penalty_amount > 0 THEN v_penalty_amount ELSE penalty_applied END,
        penalty_status = CASE WHEN v_penalty_amount > 0 THEN 'pending' ELSE penalty_status END
      WHERE id = v_cont.id;

      v_penalty_note := CASE WHEN v_penalty_amount > 0
        THEN ' Une pénalité de retard de ' || v_penalty_amount || ' ' || v_cont.group_currency || ' a été appliquée.'
        ELSE '' END;

      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (v_cont.user_id, '⚠️ Solde Insuffisant - ' || v_cont.group_name,
        'Le prélèvement de ' || v_cont.amount || ' ' || v_cont.group_currency || ' a échoué car le solde de votre portefeuille est insuffisant (' || v_current_balance || ' ' || v_cont.group_currency || ').' || ' Veuillez recharger.' || v_penalty_note,
        'reminder', '/profile');

      INSERT INTO public.messages (group_id, user_id, user_name, is_system, content)
      VALUES (v_cont.group_id, NULL, 'Système Tontine', true,
        '⚠️ Alerte : Le prélèvement automatique de ' || v_cont.amount || ' ' || v_cont.group_currency || ' de ' || v_member_name || ' a échoué (solde de portefeuille insuffisant).' || v_penalty_note);
    END IF;
  END LOOP;
END;
$fn$;
-- ============================================================================
-- 0012 — QUI PEUT MODIFIER UN CERCLE, ET QUI PEUT VOIR VOS COORDONNÉES
-- ============================================================================
--   1. `groups_update_creator_member_or_admin` accordait l'écriture à TOUT
--      membre actif du cercle, sur la ligne entière. Le commentaire d'origine
--      l'explique : il fallait permettre d'écrire `last_reminder_period`.
--      Mais une policy porte sur la ligne, pas sur une colonne — n'importe
--      quel membre pouvait donc changer le montant de la cotisation, la date
--      du prochain tour, le bénéficiaire tiré, ou clore le cercle.
--
--      L'écriture du jeton de rappel passe désormais par une fonction dédiée
--      qui ne touche que cette colonne.
--
--   2. `profiles_select_all` ouvrait chaque ligne de profil à toute personne
--      connectée : adresse e-mail, téléphone, date de naissance, nom civil de
--      tous les comptes. Dans un produit où des inconnues se retrouvent dans
--      un même cercle, c'est un annuaire de harcèlement — et un fichier de
--      contacts prêt à l'emploi pour qui voudrait démarcher ou arnaquer.
--
--      La table n'est plus lisible que pour soi-même (et les administrateurs).
--      Ce dont l'application a réellement besoin pour afficher une liste de
--      membres — un nom, un avatar, une réputation — passe par une vue qui
--      n'expose que cela.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Le cercle ne se modifie que par son organisatrice
-- ----------------------------------------------------------------------------
drop policy if exists "groups_update_creator_member_or_admin" on public.groups;
drop policy if exists "groups_update_creator_or_admin" on public.groups;

create policy "groups_update_creator_or_admin" on public.groups
  for update using (creator_id = auth.uid() or public.is_admin());

-- Le rappel d'échéance est envoyé par le premier appareil qui constate que la
-- date approche ; le jeton de période sert à ce qu'un seul le fasse. C'est
-- donc bien une écriture de membre — mais limitée à cette colonne.
--
-- Le `where` porte aussi sur la valeur actuelle : deux téléphones qui
-- réveillent l'application en même temps ne peuvent pas réclamer la même
-- période tous les deux. Celui qui perd reçoit `false` et n'envoie rien.
create or replace function public.claim_reminder_period(p_group_id uuid, p_period text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_claimed integer;
begin
  if not public.is_group_member(p_group_id) then
    return false;
  end if;

  update public.groups
     set last_reminder_period = p_period, updated_at = now()
   where id = p_group_id
     and status = 'active'
     and last_reminder_period is distinct from p_period;

  get diagnostics v_claimed = row_count;
  return v_claimed > 0;
end;
$$;

revoke all on function public.claim_reminder_period(uuid, text) from public, anon;
grant execute on function public.claim_reminder_period(uuid, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 2. Les coordonnées ne sortent plus de la base
-- ----------------------------------------------------------------------------
drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "profiles_select_self_or_admin" on public.profiles;

create policy "profiles_select_self_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

-- Ce que l'application montre légitimement d'une autre personne : de quoi la
-- reconnaître dans une liste de membres, et rien de plus. Pas d'adresse, pas
-- de téléphone, pas de date de naissance, pas de nom civil.
--
-- Une vue s'exécute avec les droits de son propriétaire et contourne donc la
-- policy ci-dessus — c'est précisément ce qu'on veut : elle sert de guichet
-- étroit, et c'est le choix des colonnes qui fait la protection.
create or replace view public.member_profiles as
  select id, display_name, avatar_config, avatar_url, reputation_score, kyc_level
  from public.profiles;

revoke all on public.member_profiles from public, anon;
grant select on public.member_profiles to authenticated;

comment on view public.member_profiles is
  'Champs publics d''un profil, pour les listes de membres. La table profiles n''est lisible que par son propriétaire et les administrateurs (0012).';
-- ============================================================================
-- 0013 — ON NE S'INSCRIT PLUS SOI-MÊME COMME MEMBRE ACTIF D'UN CERCLE
-- ============================================================================
-- "group_members_insert_self" (0001, resserrée en KYC par la migration non
-- numérotée de schema.sql ligne 1091) n'a jamais contraint `status` ni
-- `payout_position`. Résultat : une utilisatrice vérifiée KYC pouvait, par un
-- simple insert client, s'ajouter en `active` à un cercle PRIVÉ dont elle n'a
-- jamais reçu le code d'invitation, et choisir elle-même sa `payout_position`
-- — par exemple en copiant `current_payout_index` pour se désigner
-- bénéficiaire du tour en cours.
--
-- Les deux seuls inserts légitimes faits par une utilisatrice sur elle-même
-- sont :
--   1. la demande d'adhésion (`requestToJoinGroup`, src/lib/groups.ts) :
--      status='pending', payout_position=null, validée ensuite par
--      l'organisatrice via assign_next_payout_position (SECURITY DEFINER,
--      déjà restreinte à is_group_creator/is_admin) ;
--   2. l'auto-inscription de la créatrice au moment même de la création du
--      cercle (CreateGroupDialog.tsx) : status='active', payout_position=0,
--      uniquement sur le cercle qu'elle vient de créer.
--
-- Toute autre combinaison (active avec une position, pending avec une
-- position, active sur un cercle dont on n'est pas la créatrice) passait
-- jusqu'ici sans contrôle : elle est désormais refusée par la policy.
-- ============================================================================

drop policy if exists "group_members_insert_self" on public.group_members;

create policy "group_members_insert_self" on public.group_members
  for insert with check (
    user_id = auth.uid()
    and public.is_kyc_verified()
    and (
      (status = 'pending' and payout_position is null)
      or (
        status = 'active'
        and payout_position = 0
        and exists (
          select 1 from public.groups g
          where g.id = group_id and g.creator_id = auth.uid()
        )
      )
    )
  );
-- ============================================================================
-- 0014 — verify_user_pin : on ne devine plus le PIN d'une autre utilisatrice
-- ============================================================================
-- La fonction (SECURITY DEFINER) prenait p_user_id en paramètre libre sans
-- jamais le comparer à auth.uid(), contrairement à set_user_pin qui le fait
-- déjà. N'importe quel compte connecté pouvait donc appeler ce RPC avec
-- l'identifiant d'une autre personne pour :
--   - tenter de deviner son PIN de retrait à 4 chiffres (lent : 5 essais puis
--     verrou de 15 minutes, mais pas nul) ;
--   - ou simplement verrouiller à volonté les retraits de la victime, en
--     épuisant ses tentatives sans même connaître le bon code (déni de
--     service collatéral).
-- ============================================================================

create or replace function public.verify_user_pin(p_user_id uuid, p_entered_pin text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_hash text;
  v_locked_until timestamptz;
  v_attempts integer;
  v_max_attempts constant integer := 5;
  v_lockout_minutes constant integer := 15;
begin
  if auth.uid() is distinct from p_user_id then
    return jsonb_build_object('ok', false, 'locked', false, 'message', 'Non autorisé.');
  end if;

  select security_pin_hash, pin_locked_until, pin_failed_attempts
  into v_hash, v_locked_until, v_attempts
  from public.profiles where id = p_user_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'locked', false, 'message', 'Utilisateur introuvable.');
  end if;

  if v_locked_until is not null and v_locked_until > now() then
    return jsonb_build_object(
      'ok', false, 'locked', true, 'lockedUntil', v_locked_until,
      'message', 'Trop de tentatives échouées. Réessayez après ' || to_char(v_locked_until, 'HH24:MI') || '.'
    );
  end if;

  if v_hash is null then
    v_hash := crypt('0000', gen_salt('bf'));
  end if;

  if crypt(p_entered_pin, v_hash) = v_hash then
    update public.profiles set pin_failed_attempts = 0, pin_locked_until = null where id = p_user_id;
    return jsonb_build_object('ok', true, 'locked', false, 'message', 'Code PIN valide.');
  end if;

  v_attempts := coalesce(v_attempts, 0) + 1;

  if v_attempts >= v_max_attempts then
    update public.profiles set pin_failed_attempts = 0, pin_locked_until = now() + (v_lockout_minutes || ' minutes')::interval
    where id = p_user_id;

    insert into public.audit_logs (user_id, action, details, ip, device, status)
    values (p_user_id, 'withdrawal_pin_locked', 'Trop de tentatives de code PIN incorrectes — retraits bloqués 15 minutes.', '197.234.34.82', 'Navigateur', 'failure');

    return jsonb_build_object('ok', false, 'locked', true, 'remainingAttempts', 0, 'message', 'Trop de tentatives incorrectes. Les retraits sont bloqués pendant 15 minutes.');
  end if;

  update public.profiles set pin_failed_attempts = v_attempts where id = p_user_id;

  insert into public.audit_logs (user_id, action, details, ip, device, status)
  values (p_user_id, 'withdrawal_failed_pin', 'Tentative de retrait avec un code PIN erroné (' || (v_max_attempts - v_attempts) || ' tentative(s) restante(s)).', '197.234.34.82', 'Navigateur', 'failure');

  return jsonb_build_object(
    'ok', false, 'locked', false, 'remainingAttempts', v_max_attempts - v_attempts,
    'message', 'Code PIN incorrect. ' || (v_max_attempts - v_attempts) || ' tentative(s) restante(s).'
  );
end;
$$;

-- ============================================================================
-- MIGRATION 0015 — le decaissement de tontine entre dans l'historique affiche
-- ============================================================================

-- ============================================================================
-- 0015 — Le décaissement de tontine entre enfin dans l'historique affiché
-- ============================================================================
-- execute_payout_disbursement met à jour profiles.wallet_balance et le grand
-- livre (double_entry_ledger), mais n'a jamais écrit dans
-- wallet_transactions — la table que useAuth/Dashboard/MyBank utilisent pour
-- afficher le relevé. Depuis la migration 0010, execute_financial_transaction
-- écrit systématiquement cette ligne pour toute autre opération ; le chemin
-- de décaissement, resté séparé (voir le commentaire de la migration 0001),
-- n'avait pas reçu le même traitement.
--
-- Conséquence concrète : la bénéficiaire d'un tour de tontine voyait son
-- solde augmenter, mais ne retrouvait jamais ce crédit dans son historique de
-- transactions, ni dans les graphiques qui s'appuient sur cette table — pas
-- plus que les membres recevant une part de rabais d'enchère, ni le
-- portefeuille plateforme touchant la commission.
--
-- Le type `payout_credit` existe déjà dans la contrainte CHECK de la table
-- (posée dès 0001) : il n'avait simplement jamais été utilisé.
-- ============================================================================

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

  -- Le pot ne part que vers un membre actif de CE cercle : sans ce contrôle,
  -- l'organisatrice pouvait désigner n'importe quel compte de la plateforme.
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
  -- Seule, une bénéficiaire n'a personne à qui redistribuer le rabais : il
  -- serait retiré du pot sans être crédité nulle part.
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

  INSERT INTO public.wallet_transactions (user_id, amount, type, description, status, reference)
  VALUES (p_beneficiary_id, v_beneficiary_payout, 'payout_credit', v_description, 'completed', v_idempotency_key);

  IF v_fee > 0 THEN
    UPDATE public.profiles SET wallet_balance = wallet_balance + v_fee, updated_at = now()
    WHERE id = v_platform_wallet;

    INSERT INTO public.double_entry_ledger (id, transaction_id, idempotency_key, account, counterparty, type, amount, currency, description)
    VALUES
      (v_transaction_id || '_fee_dr', v_transaction_id, v_idempotency_key, 'tontine_group:' || p_group_id, 'platform_wallet:' || v_platform_wallet, 'debit', v_fee, v_group.currency, 'Commission plateforme (' || v_fee_label || ') sur le pot de ' || v_total_pot || ' ' || v_group.currency),
      (v_transaction_id || '_fee_cr', v_transaction_id, v_idempotency_key, 'platform_wallet:' || v_platform_wallet, 'tontine_group:' || p_group_id, 'credit', v_fee, v_group.currency, 'Commission plateforme (' || v_fee_label || ') sur le pot de ' || v_total_pot || ' ' || v_group.currency);

    INSERT INTO public.wallet_transactions (user_id, amount, type, description, status, reference)
    VALUES (v_platform_wallet, v_fee, 'payout_credit', 'Commission plateforme (' || v_fee_label || ') — cercle ' || v_group.name, 'completed', v_idempotency_key);
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

-- ============================================================================
-- MIGRATION 0016 — cle d'idempotence stable pour deposit/withdraw de coffre
-- ============================================================================

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

-- ============================================================================
-- MIGRATION 0017 — plus d'IP factice dans les logs d'audit
-- ============================================================================

-- ============================================================================
-- 0017 — Plus d'IP factice dans les logs d'audit
-- ============================================================================
-- execute_financial_transaction a été corrigé dès 0005/0010 pour écrire
-- coalesce(p_ip, 'non disponible') plutôt qu'une IP inventée. verify_user_pin
-- et execute_payout_disbursement n'avaient pas reçu le même traitement : ils
-- inséraient encore '197.234.34.82' / 'non disponible' pour CHAQUE tentative ou
-- décaissement, quel que soit l'utilisateur. Un support client ou une
-- enquêtrice qui consulte audit_logs après un incident croirait à une IP
-- réelle et partirait sur une fausse piste.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verify_user_pin(p_user_id uuid, p_entered_pin text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_locked_until timestamptz;
  v_attempts integer;
  v_max_attempts constant integer := 5;
  v_lockout_minutes constant integer := 15;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'locked', false, 'message', 'Non autorisé.');
  END IF;

  SELECT security_pin_hash, pin_locked_until, pin_failed_attempts
  INTO v_hash, v_locked_until, v_attempts
  FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'locked', false, 'message', 'Utilisateur introuvable.');
  END IF;

  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RETURN jsonb_build_object(
      'ok', false, 'locked', true, 'lockedUntil', v_locked_until,
      'message', 'Trop de tentatives échouées. Réessayez après ' || to_char(v_locked_until, 'HH24:MI') || '.'
    );
  END IF;

  IF v_hash IS NULL THEN
    v_hash := crypt('0000', gen_salt('bf'));
  END IF;

  IF crypt(p_entered_pin, v_hash) = v_hash THEN
    UPDATE public.profiles SET pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = p_user_id;
    RETURN jsonb_build_object('ok', true, 'locked', false, 'message', 'Code PIN valide.');
  END IF;

  v_attempts := coalesce(v_attempts, 0) + 1;

  IF v_attempts >= v_max_attempts THEN
    UPDATE public.profiles SET pin_failed_attempts = 0, pin_locked_until = now() + (v_lockout_minutes || ' minutes')::interval
    WHERE id = p_user_id;

    INSERT INTO public.audit_logs (user_id, action, details, ip, device, status)
    VALUES (p_user_id, 'withdrawal_pin_locked', 'Trop de tentatives de code PIN incorrectes — retraits bloqués 15 minutes.', 'non disponible', 'Navigateur', 'failure');

    RETURN jsonb_build_object('ok', false, 'locked', true, 'remainingAttempts', 0, 'message', 'Trop de tentatives incorrectes. Les retraits sont bloqués pendant 15 minutes.');
  END IF;

  UPDATE public.profiles SET pin_failed_attempts = v_attempts WHERE id = p_user_id;

  INSERT INTO public.audit_logs (user_id, action, details, ip, device, status)
  VALUES (p_user_id, 'withdrawal_failed_pin', 'Tentative de retrait avec un code PIN erroné (' || (v_max_attempts - v_attempts) || ' tentative(s) restante(s)).', 'non disponible', 'Navigateur', 'failure');

  RETURN jsonb_build_object(
    'ok', false, 'locked', false, 'remainingAttempts', v_max_attempts - v_attempts,
    'message', 'Code PIN incorrect. ' || (v_max_attempts - v_attempts) || ' tentative(s) restante(s).'
  );
END;
$$;

-- execute_payout_disbursement : même correctif, sur les deux insertions
-- d'audit_logs (succès et échec). Reprend 0015 à l'identique hors l'IP.
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

  -- Le pot ne part que vers un membre actif de CE cercle : sans ce contrôle,
  -- l'organisatrice pouvait désigner n'importe quel compte de la plateforme.
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
  -- Seule, une bénéficiaire n'a personne à qui redistribuer le rabais : il
  -- serait retiré du pot sans être crédité nulle part.
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

  INSERT INTO public.wallet_transactions (user_id, amount, type, description, status, reference)
  VALUES (p_beneficiary_id, v_beneficiary_payout, 'payout_credit', v_description, 'completed', v_idempotency_key);

  IF v_fee > 0 THEN
    UPDATE public.profiles SET wallet_balance = wallet_balance + v_fee, updated_at = now()
    WHERE id = v_platform_wallet;

    INSERT INTO public.double_entry_ledger (id, transaction_id, idempotency_key, account, counterparty, type, amount, currency, description)
    VALUES
      (v_transaction_id || '_fee_dr', v_transaction_id, v_idempotency_key, 'tontine_group:' || p_group_id, 'platform_wallet:' || v_platform_wallet, 'debit', v_fee, v_group.currency, 'Commission plateforme (' || v_fee_label || ') sur le pot de ' || v_total_pot || ' ' || v_group.currency),
      (v_transaction_id || '_fee_cr', v_transaction_id, v_idempotency_key, 'platform_wallet:' || v_platform_wallet, 'tontine_group:' || p_group_id, 'credit', v_fee, v_group.currency, 'Commission plateforme (' || v_fee_label || ') sur le pot de ' || v_total_pot || ' ' || v_group.currency);

    INSERT INTO public.wallet_transactions (user_id, amount, type, description, status, reference)
    VALUES (v_platform_wallet, v_fee, 'payout_credit', 'Commission plateforme (' || v_fee_label || ') — cercle ' || v_group.name, 'completed', v_idempotency_key);
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
