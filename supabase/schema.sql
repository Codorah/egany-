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
  p_group_id uuid DEFAULT NULL
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
BEGIN
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

  v_wallet_account := 'user_wallet:' || p_user_id::text;
  v_new_balance := v_balance;

  IF p_debit_account = v_wallet_account THEN
    IF v_balance < p_amount THEN
      RETURN jsonb_build_object('success', false, 'message', 'Solde insuffisant dans votre portefeuille.');
    END IF;
    v_new_balance := v_balance - p_amount;
  ELSIF p_credit_account = v_wallet_account THEN
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
  VALUES (p_user_id, p_action_type, p_description || ' | Débit [' || p_debit_account || '] / Crédit [' || p_credit_account || '] de ' || p_amount || ' ' || p_currency, '197.221.34.8', 'Serveur Supabase', 'success', p_idempotency_key);

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
  VALUES (p_user_id, p_action_type, 'ÉCHEC : ' || p_description || ' | Erreur: ' || sqlerrm, '197.221.34.8', 'Serveur Supabase', 'failure', p_idempotency_key);
  RETURN jsonb_build_object('success', false, 'message', sqlerrm);
END;
$$;

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

  UPDATE public.groups SET current_payout_index = v_next_index, next_payout_date = v_next_date, updated_at = now()
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

-- Attribution de la position dans la rotation
CREATE OR REPLACE FUNCTION public.assign_next_payout_position(p_group_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_next_position integer;
BEGIN
  SELECT count(*) INTO v_next_position FROM public.group_members
  WHERE group_id = p_group_id AND status = 'active' AND payout_position IS NOT NULL;

  UPDATE public.group_members SET status = 'active', payout_position = v_next_position
  WHERE group_id = p_group_id AND user_id = p_user_id;
END;
$$;

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

