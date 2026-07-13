-- ============================================================================
-- eganyé — schéma initial Supabase (migration Firebase → Postgres)
-- Portage fidèle du modèle Firestore audité (27 fichiers) + 3 corrections actées :
--   1. Documents de groupe (Storage) restreints aux membres actifs + admin
--      (au lieu de "tout utilisateur connecté" dans storage.rules actuel)
--   2. PIN de retrait haché (pgcrypto) au lieu du texte en clair
--   3. Distribution de payout protégée par idempotency_keys (gap non couvert
--      aujourd'hui, contrairement à recharge/retrait/paiement de cotisation)
--
-- À exécuter dans Supabase Dashboard → SQL Editor (ou `supabase db push` si
-- la CLI est utilisée localement).
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- Miroir de auth.users, peuplé automatiquement par trigger à l'inscription.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  avatar_config jsonb,
  reputation_score integer not null default 75,
  total_saved numeric not null default 0,
  groups_joined integer not null default 0,
  role text not null default 'user' check (role in ('user', 'admin')),
  wallet_balance numeric not null default 0,
  language text,
  theme text,
  security_pin_hash text,
  pin_failed_attempts integer not null default 0,
  pin_locked_until timestamptz,
  biometrics_enabled boolean not null default false,
  fcm_token text,
  push_enabled boolean not null default false,
  email_notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  creator_id uuid not null references public.profiles(id),
  contribution_amount numeric not null,
  frequency text not null check (frequency in ('daily', 'weekly', 'bi-weekly', 'monthly')),
  start_date date not null,
  end_date date,
  next_payout_date date not null,
  status text not null default 'pending' check (status in ('active', 'completed', 'pending')),
  current_payout_index integer not null default 0,
  currency text not null default 'FCFA',
  join_code text unique,
  is_private boolean not null default false,
  max_members integer,
  rules text,
  last_reminder_period text,
  distribution_method text default 'sequential' check (distribution_method in ('sequential', 'draw', 'auction')),
  penalty_rate numeric,
  penalty_type text check (penalty_type in ('percentage', 'fixed')),
  penalty_amount numeric,
  grace_period integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Remplace groups.members[] + pendingMembers[] + memberRoles{} + payoutOrder[]
-- (4 structures parallèles côté Firestore) par une seule table normalisée.
-- payout_position est distinct de l'ordre d'adhésion : les tirages/enchères
-- permutent les positions indépendamment (confirmé par l'audit disbursements.ts).
create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active')),
  role text not null default 'member' check (role in ('member', 'treasurer', 'secretary')),
  payout_position integer,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  user_name text,
  user_email text,
  amount numeric not null,
  date timestamptz not null default now(),
  status text not null default 'pending' check (status in ('paid', 'pending', 'late', 'pending_approval')),
  period text,
  proof_reference text,
  proof_submitted_at timestamptz,
  penalty_applied numeric,
  penalty_status text default 'none' check (penalty_status in ('none', 'pending', 'paid')),
  notified_insufficient boolean not null default false,
  payment_method text,
  debited_at timestamptz,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid references public.profiles(id),
  user_name text not null,
  user_photo text,
  content text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.group_documents (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id),
  uploader_name text,
  name text not null,
  category text not null default 'autre' check (category in ('statuts', 'contrat', 'pv', 'justificatif', 'autre')),
  storage_path text not null,
  size bigint,
  content_type text,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null check (type in ('reminder', 'payout', 'system', 'chat')),
  read boolean not null default false,
  link text,
  created_at timestamptz not null default now()
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null,
  type text not null check (type in ('recharge', 'contribution_debit', 'payout_credit', 'payout_deduction', 'withdraw')),
  description text,
  date timestamptz not null default now(),
  status text not null default 'pending' check (status in ('completed', 'failed', 'pending')),
  reference text,
  payment_method text
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  amount numeric not null,
  discount_amount numeric default 0,
  currency text default 'FCFA',
  cycle integer,
  transaction_id text,
  date timestamptz not null default now()
);

-- id texte (pas uuid) pour garder le pattern d'IDs métier actuel
-- ({transactionId}_dr / _cr / _benef_dr / _share_{memberId}_dr, etc.)
create table public.double_entry_ledger (
  id text primary key,
  transaction_id text not null,
  idempotency_key text not null,
  account text not null,
  counterparty text not null,
  type text not null check (type in ('debit', 'credit')),
  amount numeric not null check (amount > 0),
  currency text not null default 'FCFA',
  description text,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  details text,
  ip text,
  device text,
  timestamp timestamptz not null default now(),
  status text not null check (status in ('success', 'failure')),
  idempotency_key text
);

create table public.idempotency_keys (
  key text primary key,
  transaction_id text,
  user_id uuid,
  amount numeric,
  action_type text,
  created_at timestamptz not null default now()
);

create table public.reconciliation_reports (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null default now(),
  total_users_checked integer,
  total_ledger_entries_checked integer,
  total_discrepancies numeric,
  status text,
  executed_by text
);

-- Remplace le tableau reconciliations[] imbriqué dans le document Firestore
-- (blob JSON non borné) par une vraie table enfant.
create table public.reconciliation_report_lines (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reconciliation_reports(id) on delete cascade,
  user_id uuid,
  display_name text,
  current_balance numeric,
  calculated_balance numeric,
  discrepancy numeric,
  status text
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  user_name text,
  user_email text,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

-- Index utiles aux requêtes identifiées dans l'audit (onSnapshot/getDocs equivalents)
create index idx_group_members_user on public.group_members(user_id, status);
create index idx_contributions_group on public.contributions(group_id, date desc);
create index idx_contributions_user on public.contributions(user_id);
create index idx_messages_group on public.messages(group_id, created_at asc);
create index idx_notifications_user on public.notifications(user_id, created_at desc);
create index idx_wallet_tx_user on public.wallet_transactions(user_id, date desc);
create index idx_ledger_account on public.double_entry_ledger(account);
create index idx_groups_join_code on public.groups(join_code);

-- ============================================================================
-- 2. FONCTIONS D'AIDE POUR LES POLITIQUES RLS
-- ============================================================================
-- SECURITY DEFINER + search_path verrouillé : équivalent des get()/exists()
-- privilégiés utilisés dans firestore.rules (isAdmin(), isGroupMember()),
-- qui doivent pouvoir vérifier des lignes que l'appelant ne peut pas
-- forcément SELECT lui-même sans provoquer de blocage RLS circulaire.

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.is_group_creator(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.groups where id = p_group_id and creator_id = auth.uid()
  );
$$;

-- ============================================================================
-- 3. TRIGGER AUTH → PROFILES
-- ============================================================================
-- Remplace le setDoc explicite d'Onboarding.tsx ET le fallback auto-créateur
-- de useAuth.ts. Applique aussi la règle email bootstrap admin, aujourd'hui
-- dans firestore.rules:33.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    case when new.email = 'diditanael@gmail.com' then 'admin' else 'user' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Empêche un utilisateur non-admin de changer son propre rôle via une UPDATE
-- directe sur profiles (équivalent de la condition
-- "request.resource.data.role == resource.data.role" de firestore.rules:38).
create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.role <> old.role and not public.is_admin() then
    raise exception 'Seul un administrateur peut modifier un rôle.';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_self_role_change
  before update on public.profiles
  for each row execute function public.prevent_self_role_change();

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.contributions enable row level security;
alter table public.messages enable row level security;
alter table public.group_documents enable row level security;
alter table public.notifications enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.payouts enable row level security;
alter table public.double_entry_ledger enable row level security;
alter table public.audit_logs enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.reconciliation_reports enable row level security;
alter table public.reconciliation_report_lines enable row level security;
alter table public.support_tickets enable row level security;

-- profiles : lecture ouverte (listes de membres, chat, recherche admin,
-- comme aujourd'hui) ; création réservée au trigger (pas d'insert client
-- direct nécessaire, mais autorisé pour soi-même en filet de sécurité) ;
-- modification de soi (rôle inchangé, cf. trigger ci-dessus) ou admin.
create policy "profiles_select_all" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles_insert_self" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_self_or_admin" on public.profiles
  for update using (auth.uid() = id or public.is_admin());
create policy "profiles_delete_admin" on public.profiles
  for delete using (public.is_admin());

-- groups : lecture ouverte (recherche de cercles publics, comme aujourd'hui) ;
-- création = soi-même comme créateur ; modification = créateur, membre actif
-- (nécessaire pour last_reminder_period) ou admin ; suppression = créateur/admin.
create policy "groups_select_all" on public.groups
  for select using (auth.role() = 'authenticated');
create policy "groups_insert_self_as_creator" on public.groups
  for insert with check (creator_id = auth.uid());
create policy "groups_update_creator_member_or_admin" on public.groups
  for update using (
    creator_id = auth.uid() or public.is_group_member(id) or public.is_admin()
  );
create policy "groups_delete_creator_or_admin" on public.groups
  for delete using (creator_id = auth.uid() or public.is_admin());

-- group_members : lecture ouverte (listes de membres) ; un utilisateur ne
-- peut s'insérer que lui-même (demande d'adhésion en 'pending', ou 'active'
-- s'il s'agit du créateur au moment de la création du cercle) ; validation/
-- rôle/position réservés au créateur+admin ; suppression par le créateur,
-- l'admin, ou l'intéressé lui-même (quitter le cercle).
create policy "group_members_select_all" on public.group_members
  for select using (auth.role() = 'authenticated');
create policy "group_members_insert_self" on public.group_members
  for insert with check (user_id = auth.uid());
create policy "group_members_update_creator_or_admin" on public.group_members
  for update using (public.is_group_creator(group_id) or public.is_admin());
create policy "group_members_delete_self_creator_or_admin" on public.group_members
  for delete using (
    user_id = auth.uid() or public.is_group_creator(group_id) or public.is_admin()
  );

-- contributions : accès aux membres actifs du cercle + admin, sans
-- restriction à "sa propre" cotisation (identique au comportement Firestore
-- actuel — n'importe quel membre peut gérer les cotisations des autres,
-- cohérent avec le rôle de "gestionnaire" du créateur).
create policy "contributions_all_group_member_or_admin" on public.contributions
  for all using (public.is_group_member(group_id) or public.is_admin())
  with check (public.is_group_member(group_id) or public.is_admin());

-- messages : lecture membres+admin ; écriture membres auto-attribuée
-- (userId == auth.uid()) OU système (is_system=true, écrit uniquement par
-- les fonctions SECURITY DEFINER ci-dessous, jamais par un client direct
-- puisque is_system ne peut être forcé à true que si user_id est NULL).
create policy "messages_select_group_member_or_admin" on public.messages
  for select using (public.is_group_member(group_id) or public.is_admin());
create policy "messages_insert_self_attributed" on public.messages
  for insert with check (
    (user_id = auth.uid() and public.is_group_member(group_id) and is_system = false)
  );
create policy "messages_update_delete_admin" on public.messages
  for update using (public.is_admin());
create policy "messages_delete_admin" on public.messages
  for delete using (public.is_admin());

-- group_documents (table de métadonnées ; la vraie restriction de fichiers
-- vit dans les policies Supabase Storage, section 5 ci-dessous — c'est là
-- que la faille "tout utilisateur connecté" est corrigée).
create policy "group_documents_select_member_or_admin" on public.group_documents
  for select using (public.is_group_member(group_id) or public.is_admin());
create policy "group_documents_insert_self_attributed" on public.group_documents
  for insert with check (uploader_id = auth.uid() and public.is_group_member(group_id));
create policy "group_documents_delete_member_or_admin" on public.group_documents
  for delete using (public.is_group_member(group_id) or public.is_admin());

-- notifications : propriétaire ou admin en lecture/modif/suppression ;
-- création ouverte à tout authentifié (nécessaire : une session membre crée
-- des notifications ciblant d'autres membres — comportement identique à
-- l'actuel notify.ts).
create policy "notifications_select_owner_or_admin" on public.notifications
  for select using (user_id = auth.uid() or public.is_admin());
create policy "notifications_insert_authenticated" on public.notifications
  for insert with check (auth.role() = 'authenticated');
create policy "notifications_update_owner_or_admin" on public.notifications
  for update using (user_id = auth.uid() or public.is_admin());
create policy "notifications_delete_owner_or_admin" on public.notifications
  for delete using (user_id = auth.uid() or public.is_admin());

-- wallet_transactions : propriétaire ou admin (identique à l'actuel).
create policy "wallet_tx_owner_or_admin" on public.wallet_transactions
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- payouts : lecture admin ou membre du cercle concerné ; écriture réservée
-- à la fonction execute_payout_disbursement (SECURITY DEFINER) — pas
-- d'insert client direct.
create policy "payouts_select_group_member_or_admin" on public.payouts
  for select using (public.is_group_member(group_id) or public.is_admin());

-- double_entry_ledger / audit_logs / idempotency_keys : AUCUN accès client
-- direct en écriture (faille corrigée — Firestore autorise aujourd'hui
-- n'importe quel utilisateur connecté). Uniquement lecture admin ; les
-- écritures ne passent que par les fonctions SECURITY DEFINER ci-dessous.
create policy "ledger_select_admin_only" on public.double_entry_ledger
  for select using (public.is_admin());
create policy "audit_logs_select_admin_only" on public.audit_logs
  for select using (public.is_admin());
-- idempotency_keys : aucune policy select/insert pour le client → RLS bloque
-- tout accès direct par défaut (seules les fonctions SECURITY DEFINER, qui
-- s'exécutent avec les droits du propriétaire, peuvent y toucher).

create policy "reconciliation_reports_admin_only" on public.reconciliation_reports
  for all using (public.is_admin()) with check (public.is_admin());
create policy "reconciliation_lines_admin_only" on public.reconciliation_report_lines
  for all using (public.is_admin()) with check (public.is_admin());

create policy "support_tickets_owner_or_admin_select" on public.support_tickets
  for select using (user_id = auth.uid() or public.is_admin());
create policy "support_tickets_insert_self" on public.support_tickets
  for insert with check (user_id = auth.uid());
create policy "support_tickets_update_owner_or_admin" on public.support_tickets
  for update using (user_id = auth.uid() or public.is_admin());

-- ============================================================================
-- 5. STORAGE — bucket documents de groupe
-- ============================================================================
-- Correction actée : restreint aux membres actifs du cercle + admin,
-- contrairement à storage.rules actuel (any signed-in user). Le chemin de
-- fichier attendu est "{group_id}/{timestamp}_{nom}" — on extrait le
-- group_id comme premier segment du chemin (storage.foldername).

insert into storage.buckets (id, name, public)
values ('group-documents', 'group-documents', false)
on conflict (id) do nothing;

create policy "group_documents_storage_select" on storage.objects
  for select using (
    bucket_id = 'group-documents'
    and (
      public.is_group_member((storage.foldername(name))[1]::uuid)
      or public.is_admin()
    )
  );
create policy "group_documents_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'group-documents'
    and public.is_group_member((storage.foldername(name))[1]::uuid)
  );
create policy "group_documents_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'group-documents'
    and (
      public.is_group_member((storage.foldername(name))[1]::uuid)
      or public.is_admin()
    )
  );

-- ============================================================================
-- 6. FONCTIONS TRANSACTIONNELLES (SECURITY DEFINER)
-- ============================================================================
-- Portage fidèle de src/lib/ledger.ts::executeFinancialTransaction. Une
-- fonction Postgres est atomique par défaut (pas d'orchestration manuelle
-- de transaction nécessaire côté client, contrairement à Firestore
-- runTransaction). SECURITY DEFINER = s'exécute avec les droits du
-- propriétaire, contourne RLS — nécessaire car cette fonction écrit dans
-- double_entry_ledger/audit_logs/idempotency_keys, verrouillés en écriture
-- directe (section 4).

create or replace function public.execute_financial_transaction(
  p_idempotency_key text,
  p_user_id uuid,
  p_amount numeric,
  p_currency text,
  p_description text,
  p_action_type text, -- 'wallet_recharge' | 'contribution_payment' | 'wallet_withdrawal' | 'admin_adjustment'
  p_debit_account text,
  p_credit_account text,
  p_contribution_id uuid default null,
  p_group_id uuid default null
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
begin
  if p_amount <= 0 then
    return jsonb_build_object('success', false, 'message', 'Le montant doit être strictement supérieur à zéro.');
  end if;

  -- 1. Vérification d'idempotence stricte
  select * into v_existing from public.idempotency_keys where key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'success', true,
      'message', 'Transaction déjà exécutée (Idempotent).',
      'transactionId', v_existing.transaction_id
    );
  end if;

  -- 2. Lecture du solde courant (verrouillage de ligne pour éviter les races)
  select wallet_balance, total_saved into v_balance, v_total_saved
  from public.profiles where id = p_user_id for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'L''utilisateur spécifié n''existe pas.');
  end if;

  v_wallet_account := 'user_wallet:' || p_user_id::text;
  v_new_balance := v_balance;

  -- 3. Garde de solde suffisant (uniquement si on débite le portefeuille de l'utilisateur)
  if p_debit_account = v_wallet_account then
    if v_balance < p_amount then
      return jsonb_build_object('success', false, 'message', 'Solde insuffisant dans votre portefeuille.');
    end if;
    v_new_balance := v_balance - p_amount;
  elsif p_credit_account = v_wallet_account then
    v_new_balance := v_balance + p_amount;
  end if;

  v_transaction_id := gen_random_uuid()::text;

  -- 4. Mise à jour du profil
  update public.profiles set
    wallet_balance = v_new_balance,
    total_saved = case when p_action_type = 'contribution_payment' then v_total_saved + p_amount else v_total_saved end,
    updated_at = now()
  where id = p_user_id;

  -- 5. Écritures en partie double
  insert into public.double_entry_ledger (id, transaction_id, idempotency_key, account, counterparty, type, amount, currency, description)
  values
    (v_transaction_id || '_dr', v_transaction_id, p_idempotency_key, p_debit_account, p_credit_account, 'debit', p_amount, p_currency, p_description),
    (v_transaction_id || '_cr', v_transaction_id, p_idempotency_key, p_credit_account, p_debit_account, 'credit', p_amount, p_currency, p_description);

  -- 6. Enregistrement de la clé d'idempotence
  insert into public.idempotency_keys (key, transaction_id, user_id, amount, action_type)
  values (p_idempotency_key, v_transaction_id, p_user_id, p_amount, p_action_type);

  -- 7. Log d'audit
  insert into public.audit_logs (user_id, action, details, ip, device, status, idempotency_key)
  values (
    p_user_id, p_action_type,
    p_description || ' | Double-entrée : Débit [' || p_debit_account || '] / Crédit [' || p_credit_account || '] de ' || p_amount || ' ' || p_currency,
    '197.221.34.8', 'Serveur Supabase', 'success', p_idempotency_key
  );

  -- 8. Mise à jour conditionnelle de la cotisation (paiement par portefeuille)
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
  values (p_user_id, p_action_type, 'ÉCHEC : ' || p_description || ' | Erreur: ' || sqlerrm, '197.221.34.8', 'Serveur Supabase', 'failure', p_idempotency_key);
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

-- Portage de src/lib/ledger.ts::verifyUserPin. Le PIN est comparé haché
-- (pgcrypto crypt()) au lieu du texte en clair actuel. Si aucun PIN n'est
-- configuré, '0000' reste la valeur par défaut (comportement identique),
-- mais désormais comparée via son propre hash plutôt qu'en clair.
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
    return jsonb_build_object('ok', false, 'locked', true, 'remainingAttempts', 0, 'message', 'Trop de tentatives incorrectes. Les retraits sont bloqués pendant 15 minutes.');
  end if;

  update public.profiles set pin_failed_attempts = v_attempts where id = p_user_id;
  return jsonb_build_object(
    'ok', false, 'locked', false, 'remainingAttempts', v_max_attempts - v_attempts,
    'message', 'Code PIN incorrect. ' || (v_max_attempts - v_attempts) || ' tentative(s) restante(s).'
  );
end;
$$;

-- Portage de src/lib/disbursements.ts::executePayoutDisbursement. Ajoute une
-- vraie protection d'idempotence (gap confirmé par l'audit : la version
-- Firestore actuelle calcule une clé mais ne la vérifie/enregistre jamais,
-- exposant à un double-paiement en cas de double-clic).
create or replace function public.execute_payout_disbursement(
  p_group_id uuid,
  p_beneficiary_id uuid,
  p_admin_user_id uuid,
  p_discount_amount numeric default 0
)
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
    return jsonb_build_object('success', false, 'message', 'Le montant du rabais (enchère) est invalide.');
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

  -- Crédit du bénéficiaire
  update public.profiles set wallet_balance = wallet_balance + v_beneficiary_payout, updated_at = now()
  where id = p_beneficiary_id;

  insert into public.double_entry_ledger (id, transaction_id, idempotency_key, account, counterparty, type, amount, currency, description)
  values
    (v_transaction_id || '_benef_dr', v_transaction_id, v_idempotency_key, 'tontine_group:' || p_group_id, 'user_wallet:' || p_beneficiary_id, 'debit', v_beneficiary_payout, v_group.currency, v_description),
    (v_transaction_id || '_benef_cr', v_transaction_id, v_idempotency_key, 'user_wallet:' || p_beneficiary_id, 'tontine_group:' || p_group_id, 'credit', v_beneficiary_payout, v_group.currency, v_description);

  -- Restourne d'enchère aux autres membres actifs
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

  -- Avance du cycle + permutation de position (le bénéficiaire prend le
  -- créneau "current_payout_index" s'il n'y était pas déjà)
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

  update public.groups set current_payout_index = v_next_index, next_payout_date = v_next_date, updated_at = now()
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

-- Assigne la prochaine position de rotation disponible à un membre qui
-- passe de 'pending' à 'active' (utilisé lors de la validation d'adhésion,
-- lot 3). Sans ça, payout_position resterait NULL pour les membres qui
-- rejoignent après la création du cercle.
create or replace function public.assign_next_payout_position(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_next_position integer;
begin
  select count(*) into v_next_position from public.group_members
  where group_id = p_group_id and status = 'active' and payout_position is not null;

  update public.group_members set status = 'active', payout_position = v_next_position
  where group_id = p_group_id and user_id = p_user_id;
end;
$$;
