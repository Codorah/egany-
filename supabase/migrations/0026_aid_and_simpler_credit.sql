-- ============================================================================
-- 0026 — « Coup de pouce » (aide non remboursable) et microcrédit simplifié
-- ============================================================================
-- Décision du propriétaire (20 oct. 2026) :
--   * MICROCRÉDIT : plus de vidéo ni de frais de dossier. La personne décrit
--     son projet, le montant et la durée ; l'équipe fait une offre ou refuse.
--     Durée minimum 3 mois (Google Play interdit les prêts personnels à
--     rembourser en 60 jours ou moins) et taux plafonné à 24 %.
--   * COUP DE POUCE : nouvelle aide gratuite. La personne indique le montant
--     voulu, explique son activité en vidéo (obligatoire) et paie les frais
--     d'étude (1 000 FCFA, non remboursables). L'équipe étudie le dossier et
--     verse l'aide (rien à rembourser), ou refuse avec un motif.
--   * Suppression de compte (0008 jamais appliquée, et cassée : elle mettait
--     email à NULL alors que la colonne est obligatoire).
--
-- Aucun dossier de crédit n'existe au moment de cette migration.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Microcrédit sans vidéo ni frais
-- ----------------------------------------------------------------------------
ALTER TABLE public.credit_applications ALTER COLUMN application_fee SET DEFAULT 0;

ALTER TABLE public.credit_applications DROP CONSTRAINT IF EXISTS credit_applications_requested_months_check;
ALTER TABLE public.credit_applications ADD CONSTRAINT credit_applications_requested_months_check
  CHECK (requested_months BETWEEN 3 AND 24);
ALTER TABLE public.credit_applications DROP CONSTRAINT IF EXISTS credit_applications_duration_months_check;
ALTER TABLE public.credit_applications ADD CONSTRAINT credit_applications_duration_months_check
  CHECK (duration_months BETWEEN 3 AND 24);
ALTER TABLE public.credit_applications DROP CONSTRAINT IF EXISTS credit_applications_interest_rate_check;
ALTER TABLE public.credit_applications ADD CONSTRAINT credit_applications_interest_rate_check
  CHECK (interest_rate >= 0 AND interest_rate <= 24);

DROP FUNCTION IF EXISTS public.submit_credit_application(uuid, text, text, numeric, integer, text, text, text);

CREATE OR REPLACE FUNCTION public.submit_credit_application(
  p_service_id uuid,
  p_project_title text,
  p_project_description text,
  p_requested_amount numeric,
  p_requested_months integer,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_service record;
  v_profile record;
  v_cap numeric;
  v_app_id uuid;
  v_existing uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Vous devez être connecté·e.');
  END IF;
  IF p_idempotency_key IS NULL OR char_length(p_idempotency_key) < 8 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Requête invalide.');
  END IF;

  SELECT id INTO v_existing FROM public.credit_applications WHERE fee_idempotency_key = p_idempotency_key AND user_id = v_uid;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'message', 'Votre demande a bien été envoyée.', 'applicationId', v_existing);
  END IF;

  SELECT * INTO v_service FROM public.marketplace_services WHERE id = p_service_id AND is_active;
  IF NOT FOUND OR v_service.category <> 'credit' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce service de crédit n''est pas disponible.');
  END IF;

  SELECT reputation_score, total_saved INTO v_profile FROM public.profiles WHERE id = v_uid;
  IF v_service.min_reputation_score IS NOT NULL AND coalesce(v_profile.reputation_score, 0) < v_service.min_reputation_score THEN
    RETURN jsonb_build_object('success', false, 'message',
      'Ce crédit demande un score de réputation d''au moins ' || v_service.min_reputation_score || '.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.credit_applications WHERE user_id = v_uid AND status IN ('submitted', 'offered', 'active')) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Vous avez déjà une demande de crédit en cours.');
  END IF;

  IF p_project_title IS NULL OR char_length(trim(p_project_title)) < 3 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Donnez un nom à votre projet.');
  END IF;
  IF p_project_description IS NULL OR char_length(trim(p_project_description)) < 20 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Expliquez votre projet en quelques phrases (20 caractères minimum).');
  END IF;
  IF p_requested_months IS NULL OR p_requested_months < 3 OR p_requested_months > 24 THEN
    RETURN jsonb_build_object('success', false, 'message', 'La durée doit être comprise entre 3 et 24 mois.');
  END IF;

  v_cap := greatest(5000, round(coalesce(v_profile.total_saved, 0) * 2));
  IF p_requested_amount IS NULL OR p_requested_amount <= 0 OR p_requested_amount > v_cap THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le montant doit être compris entre 1 et ' || v_cap || ' FCFA.');
  END IF;

  INSERT INTO public.credit_applications (
    user_id, service_id, project_title, project_description, requested_amount, requested_months,
    application_fee, fee_idempotency_key
  ) VALUES (
    v_uid, p_service_id, trim(p_project_title), trim(p_project_description), round(p_requested_amount), p_requested_months,
    0, p_idempotency_key
  ) RETURNING id INTO v_app_id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_uid, 'Demande de crédit envoyée',
          'Votre demande « ' || trim(p_project_title) || ' » est entre les mains de notre équipe. Vous serez prévenu·e de sa décision.',
          'system');

  RETURN jsonb_build_object('success', true, 'message', 'Votre demande a bien été envoyée.', 'applicationId', v_app_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_credit_application(uuid, text, text, numeric, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_credit_application(uuid, text, text, numeric, integer, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.make_credit_offer(
  p_application_id uuid,
  p_offered_amount numeric,
  p_interest_rate numeric,
  p_duration_months integer,
  p_admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_app record;
  v_total numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Non autorisé.');
  END IF;
  IF p_offered_amount IS NULL OR p_offered_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le montant offert doit être supérieur à zéro.');
  END IF;
  IF p_interest_rate IS NULL OR p_interest_rate < 0 OR p_interest_rate > 24 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le taux doit être compris entre 0 et 24 %.');
  END IF;
  IF p_duration_months IS NULL OR p_duration_months < 3 OR p_duration_months > 24 THEN
    RETURN jsonb_build_object('success', false, 'message', 'La durée doit être comprise entre 3 et 24 mois.');
  END IF;

  SELECT * INTO v_app FROM public.credit_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Dossier introuvable.');
  END IF;
  IF v_app.status <> 'submitted' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce dossier a déjà été traité.');
  END IF;

  v_total := round(p_offered_amount) + round(round(p_offered_amount) * p_interest_rate / 100);

  UPDATE public.credit_applications SET
    status = 'offered',
    offered_amount = round(p_offered_amount),
    interest_rate = p_interest_rate,
    duration_months = p_duration_months,
    total_due = v_total,
    admin_notes = p_admin_notes,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    offered_at = now(),
    updated_at = now()
  WHERE id = p_application_id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_app.user_id, 'Une offre de crédit vous attend',
          'Pour « ' || v_app.project_title || ' » : ' || round(p_offered_amount) || ' FCFA, à rembourser ' || v_total
            || ' FCFA en ' || p_duration_months || ' mois. Ouvrez Services annexes pour l''accepter ou la refuser.',
          'system');

  RETURN jsonb_build_object('success', true, 'message', 'Offre envoyée.', 'totalDue', v_total);
END;
$$;


-- ----------------------------------------------------------------------------
-- 2. Coup de pouce : réglage, table, accès
-- ----------------------------------------------------------------------------
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS aid_application_fee numeric NOT NULL DEFAULT 1000
    CHECK (aid_application_fee >= 0);

COMMENT ON COLUMN public.platform_settings.aid_application_fee IS
  'Frais d''étude d''un dossier « Coup de pouce » (FCFA), débités au dépôt, non remboursables.';

CREATE TABLE IF NOT EXISTS public.aid_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  project_title text NOT NULL CHECK (char_length(project_title) BETWEEN 3 AND 120),
  project_description text NOT NULL CHECK (char_length(project_description) BETWEEN 20 AND 4000),
  requested_amount numeric NOT NULL CHECK (requested_amount > 0 AND requested_amount <= 100000000),
  video_path text,
  video_url text,
  CHECK (video_path IS NOT NULL OR video_url IS NOT NULL),

  application_fee numeric NOT NULL,
  fee_idempotency_key text NOT NULL UNIQUE,

  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'granted', 'rejected')),
  granted_amount numeric CHECK (granted_amount > 0),
  rejection_reason text,
  admin_notes text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  disbursed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aid_applications_user ON public.aid_applications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aid_applications_status ON public.aid_applications(status, created_at);

-- Un seul dossier à l'étude à la fois par personne.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_aid_application_open_per_user
  ON public.aid_applications(user_id) WHERE status = 'submitted';

ALTER TABLE public.aid_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aid_applications_select_own_or_admin" ON public.aid_applications;
CREATE POLICY "aid_applications_select_own_or_admin" ON public.aid_applications
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

-- Les vidéos vont dans l'espace privé déjà créé par 0019 (dossier = uid).
-- On renomme seulement l'intention : c'est désormais l'espace des vidéos d'aide.
COMMENT ON TABLE public.aid_applications IS
  'Dossiers « Coup de pouce » : aide non remboursable, vidéo obligatoire (bucket credit-videos), frais d''étude au dépôt.';


-- ----------------------------------------------------------------------------
-- 3. Dépôt d'un dossier Coup de pouce — frais débités dans la même transaction
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_aid_application(
  p_project_title text,
  p_project_description text,
  p_requested_amount numeric,
  p_video_path text,
  p_video_url text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_fee numeric;
  v_platform_wallet uuid;
  v_move jsonb;
  v_app_id uuid;
  v_existing uuid;
  v_path text := nullif(trim(p_video_path), '');
  v_url text := nullif(trim(p_video_url), '');
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Vous devez être connecté·e.');
  END IF;
  IF p_idempotency_key IS NULL OR char_length(p_idempotency_key) < 8 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Requête invalide.');
  END IF;

  SELECT id INTO v_existing FROM public.aid_applications WHERE fee_idempotency_key = p_idempotency_key AND user_id = v_uid;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'message', 'Votre dossier a bien été déposé.', 'applicationId', v_existing);
  END IF;

  IF EXISTS (SELECT 1 FROM public.aid_applications WHERE user_id = v_uid AND status = 'submitted') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Vous avez déjà un dossier Coup de pouce à l''étude.');
  END IF;

  IF p_project_title IS NULL OR char_length(trim(p_project_title)) < 3 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Donnez un nom à votre activité.');
  END IF;
  IF p_project_description IS NULL OR char_length(trim(p_project_description)) < 20 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Expliquez en quelques phrases ce que vous ferez de l''aide (20 caractères minimum).');
  END IF;
  IF p_requested_amount IS NULL OR p_requested_amount <= 0 OR p_requested_amount > 100000000 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Indiquez le montant dont vous avez besoin.');
  END IF;

  IF v_path IS NULL AND v_url IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'La vidéo est obligatoire : filmez-vous ou collez un lien.');
  END IF;
  IF v_path IS NOT NULL AND split_part(v_path, '/', 1) <> v_uid::text THEN
    RETURN jsonb_build_object('success', false, 'message', 'Vidéo invalide.');
  END IF;
  IF v_url IS NOT NULL AND v_url !~* '^https://[^\s]+$' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le lien de la vidéo doit commencer par https://');
  END IF;

  SELECT aid_application_fee, platform_wallet_id INTO v_fee, v_platform_wallet
  FROM public.platform_settings WHERE id = 1;
  v_fee := coalesce(v_fee, 1000);

  IF v_fee > 0 THEN
    v_move := public._credit_wallet_move(
      'aid_fee_' || p_idempotency_key, v_uid, v_fee, 'debit',
      CASE WHEN v_platform_wallet IS NOT NULL THEN 'platform_wallet:' || v_platform_wallet ELSE 'platform_revenue' END,
      'Frais d''étude Coup de pouce — ' || trim(p_project_title),
      'aid_application_fee'
    );
    IF NOT (v_move->>'success')::boolean THEN
      RETURN jsonb_build_object('success', false, 'message',
        CASE WHEN v_move->>'message' LIKE 'Solde insuffisant%'
          THEN 'Il faut ' || v_fee || ' FCFA sur votre portefeuille pour les frais d''étude. Rechargez puis réessayez.'
          ELSE v_move->>'message' END);
    END IF;

    IF v_platform_wallet IS NOT NULL THEN
      UPDATE public.profiles SET wallet_balance = wallet_balance + v_fee, updated_at = now() WHERE id = v_platform_wallet;
      INSERT INTO public.wallet_transactions (user_id, amount, type, description, status, reference, payment_method)
      VALUES (v_platform_wallet, v_fee, 'payout_credit', 'Frais d''étude Coup de pouce reçus', 'completed', 'aid_fee_' || p_idempotency_key, 'wallet');
    END IF;
  END IF;

  INSERT INTO public.aid_applications (
    user_id, project_title, project_description, requested_amount, video_path, video_url,
    application_fee, fee_idempotency_key
  ) VALUES (
    v_uid, trim(p_project_title), trim(p_project_description), round(p_requested_amount), v_path, v_url,
    v_fee, p_idempotency_key
  ) RETURNING id INTO v_app_id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_uid, 'Dossier Coup de pouce déposé',
          'Votre dossier « ' || trim(p_project_title) || ' » est entre les mains de notre équipe. Vous serez prévenu·e de sa décision.',
          'system');

  RETURN jsonb_build_object('success', true, 'message', 'Votre dossier a bien été déposé.', 'applicationId', v_app_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_aid_application(text, text, numeric, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_aid_application(text, text, numeric, text, text, text) TO authenticated;


-- ----------------------------------------------------------------------------
-- 4. Décision de l'équipe : verser l'aide, ou refuser
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_aid_application(
  p_application_id uuid,
  p_amount numeric,
  p_admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_app record;
  v_amount numeric := round(p_amount);
  v_move jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Non autorisé.');
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le montant de l''aide doit être supérieur à zéro.');
  END IF;

  SELECT * INTO v_app FROM public.aid_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Dossier introuvable.');
  END IF;
  IF v_app.status <> 'submitted' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce dossier a déjà été traité.');
  END IF;

  -- Clé dérivée du dossier : un double appui ne verse jamais deux fois.
  v_move := public._credit_wallet_move(
    'aid_grant_' || v_app.id::text, v_app.user_id, v_amount, 'credit',
    'aid_fund',
    'Coup de pouce eganyé — ' || v_app.project_title,
    'aid_grant'
  );
  IF NOT (v_move->>'success')::boolean THEN
    RAISE EXCEPTION '%', v_move->>'message';
  END IF;

  UPDATE public.aid_applications SET
    status = 'granted', granted_amount = v_amount, admin_notes = nullif(trim(p_admin_notes), ''),
    reviewed_by = auth.uid(), reviewed_at = now(), disbursed_at = now(), updated_at = now()
  WHERE id = v_app.id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_app.user_id, 'Votre Coup de pouce est arrivé',
          v_amount || ' FCFA ont été versés sur votre portefeuille pour « ' || v_app.project_title
            || ' ». C''est une aide : vous n''avez rien à rembourser.',
          'system');

  RETURN jsonb_build_object('success', true, 'message', 'Aide versée.');
END;
$$;

REVOKE ALL ON FUNCTION public.grant_aid_application(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_aid_application(uuid, numeric, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.reject_aid_application(p_application_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_app record;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Non autorisé.');
  END IF;
  IF p_reason IS NULL OR char_length(trim(p_reason)) < 5 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Expliquez le motif du refus à la personne.');
  END IF;

  SELECT * INTO v_app FROM public.aid_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Dossier introuvable.');
  END IF;
  IF v_app.status <> 'submitted' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce dossier a déjà été traité.');
  END IF;

  UPDATE public.aid_applications SET
    status = 'rejected', rejection_reason = trim(p_reason),
    reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE id = p_application_id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_app.user_id, 'Votre dossier Coup de pouce n''a pas été retenu',
          '« ' || v_app.project_title || ' » : ' || trim(p_reason), 'system');

  RETURN jsonb_build_object('success', true, 'message', 'Dossier refusé.');
END;
$$;

REVOKE ALL ON FUNCTION public.reject_aid_application(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_aid_application(uuid, text) TO authenticated;


-- ----------------------------------------------------------------------------
-- 5. Suppression de compte (remplace 0008, jamais appliquée et cassée)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  UNIQUE (user_id)
);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adr_select_own_or_admin" ON public.account_deletion_requests;
CREATE POLICY "adr_select_own_or_admin" ON public.account_deletion_requests
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_balance numeric;
  v_active_groups integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Session expirée.');
  END IF;

  SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = v_user;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Profil introuvable.');
  END IF;

  IF coalesce(v_balance, 0) > 0 THEN
    RETURN jsonb_build_object('success', false, 'message',
      'Retirez d''abord votre solde de ' || v_balance || ' FCFA : supprimer le compte maintenant reviendrait à abandonner cet argent.');
  END IF;

  SELECT count(*) INTO v_active_groups
  FROM public.group_members gm
  JOIN public.groups g ON g.id = gm.group_id
  WHERE gm.user_id = v_user AND gm.status = 'active' AND g.status = 'active';
  IF v_active_groups > 0 THEN
    RETURN jsonb_build_object('success', false, 'message',
      'Vous participez encore à ' || v_active_groups || ' cercle(s) actif(s). Quittez-les ou attendez la fin de la rotation avant de supprimer votre compte.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.credit_applications WHERE user_id = v_user AND status = 'active') THEN
    RETURN jsonb_build_object('success', false, 'message',
      'Vous avez un crédit en cours : remboursez-le avant de supprimer votre compte.');
  END IF;

  -- Les demandes encore à l'étude sont abandonnées : rien ne sera versé sur
  -- un compte supprimé.
  UPDATE public.credit_applications SET status = 'declined', updated_at = now()
  WHERE user_id = v_user AND status IN ('submitted', 'offered');
  UPDATE public.aid_applications SET status = 'rejected', rejection_reason = 'Compte supprimé', updated_at = now()
  WHERE user_id = v_user AND status = 'submitted';

  -- email est obligatoire : on le remplace par une adresse qui ne mène nulle part.
  UPDATE public.profiles SET
    display_name = 'Compte supprimé',
    first_name = NULL,
    last_name = NULL,
    email = 'supprime+' || v_user::text || '@eganye.invalid',
    phone = NULL,
    avatar_url = NULL,
    avatar_config = NULL,
    date_of_birth = NULL,
    mandate_name = NULL,
    mandate_phone = NULL,
    fcm_token = NULL,
    updated_at = now()
  WHERE id = v_user;

  DELETE FROM public.kyc_submissions WHERE user_id = v_user;
  DELETE FROM public.notifications WHERE user_id = v_user;

  INSERT INTO public.account_deletion_requests (user_id)
  VALUES (v_user)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.audit_logs (user_id, action, details, ip, device, status)
  VALUES (v_user, 'account_deletion', 'Profil anonymisé sur demande de l''utilisateur ; suppression auth en attente.',
          'non disponible', 'Application', 'success');

  RETURN jsonb_build_object('success', true, 'message', 'Votre compte a été supprimé et vos données personnelles effacées.');
END;
$$;

REVOKE ALL ON FUNCTION public.request_account_deletion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_account_deletion() TO authenticated;
