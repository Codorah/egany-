-- ============================================================================
-- 0019 — Microcrédit : du simple montant au vrai dossier de projet
-- ============================================================================
-- Parcours voulu par le propriétaire (15 oct. 2026) :
--   1. la personne dépose un dossier : son projet, à quoi servira l'argent,
--      le montant, la durée souhaitée, une vidéo (envoyée ou en lien) ;
--      1 000 FCFA de frais de dossier sont débités à ce moment-là, NON
--      remboursables, même si le dossier est refusé ;
--   2. l'équipe étudie : refus motivé, ou OFFRE (montant, taux d'intérêt en %,
--      nombre de mois) ;
--   3. l'emprunteur accepte l'offre : l'argent est versé sur son portefeuille
--      et l'échéancier mensuel est créé — jamais avant son accord, puisque
--      l'offre fixe un coût qu'il doit voir et accepter ;
--   4. il rembourse par mensualités ; chaque échéance arrivée est prélevée
--      automatiquement si le portefeuille le permet, sinon elle passe en retard.
--
-- Aucun crédit n'était en cours au moment de cette migration (la seule
-- demande de crédit existante était refusée) : l'ancien circuit
-- approve_marketplace_credit / repay_marketplace_credit est retiré au lieu
-- d'être maintenu en parallèle.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Réglage : montant des frais de dossier
-- ----------------------------------------------------------------------------
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS credit_application_fee numeric NOT NULL DEFAULT 1000
    CHECK (credit_application_fee >= 0);

COMMENT ON COLUMN public.platform_settings.credit_application_fee IS
  'Frais de dossier microcrédit (FCFA), débités au dépôt, non remboursables.';


-- ----------------------------------------------------------------------------
-- 2. Le dossier
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.marketplace_services(id),

  -- Ce que dépose l'emprunteur
  project_title text NOT NULL CHECK (char_length(project_title) BETWEEN 3 AND 120),
  project_description text NOT NULL CHECK (char_length(project_description) BETWEEN 20 AND 4000),
  requested_amount numeric NOT NULL CHECK (requested_amount > 0),
  requested_months integer NOT NULL CHECK (requested_months BETWEEN 1 AND 24),
  video_path text,
  video_url text,

  -- Frais de dossier
  application_fee numeric NOT NULL,
  fee_idempotency_key text NOT NULL UNIQUE,

  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'offered', 'rejected', 'declined', 'active', 'repaid')),

  -- Ce que décide l'équipe
  offered_amount numeric CHECK (offered_amount > 0),
  interest_rate numeric CHECK (interest_rate >= 0 AND interest_rate <= 100),
  duration_months integer CHECK (duration_months BETWEEN 1 AND 24),
  total_due numeric,
  rejection_reason text,
  admin_notes text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  offered_at timestamptz,

  -- Vie du crédit
  accepted_at timestamptz,
  disbursed_at timestamptz,
  repaid_amount numeric NOT NULL DEFAULT 0,
  repaid_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_applications_user ON public.credit_applications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_applications_status ON public.credit_applications(status, created_at);

-- Un seul dossier ouvert à la fois par personne : on ne cumule pas les
-- demandes ni les crédits.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_credit_application_open_per_user
  ON public.credit_applications(user_id)
  WHERE status IN ('submitted', 'offered', 'active');


-- ----------------------------------------------------------------------------
-- 3. L'échéancier
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.credit_applications(id) ON DELETE CASCADE,
  number integer NOT NULL CHECK (number >= 1),
  due_date date NOT NULL,
  amount_due numeric NOT NULL CHECK (amount_due > 0),
  amount_paid numeric NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'late', 'paid')),
  paid_at timestamptz,
  UNIQUE (application_id, number)
);

CREATE INDEX IF NOT EXISTS idx_credit_installments_due ON public.credit_installments(status, due_date);


-- ----------------------------------------------------------------------------
-- 4. Accès : lecture seule côté application, toute écriture passe par les
--    fonctions ci-dessous (argent en jeu).
-- ----------------------------------------------------------------------------
ALTER TABLE public.credit_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_installments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credit_applications_select_own_or_admin" ON public.credit_applications;
CREATE POLICY "credit_applications_select_own_or_admin" ON public.credit_applications
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "credit_installments_select_own_or_admin" ON public.credit_installments;
CREATE POLICY "credit_installments_select_own_or_admin" ON public.credit_installments
  FOR SELECT USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.credit_applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    )
  );

-- Les demandes de crédit ne passent plus par marketplace_requests : sans ce
-- verrou, un insert client direct contournerait les frais de dossier.
DROP POLICY IF EXISTS "marketplace_requests_insert_self" ON public.marketplace_requests;
CREATE POLICY "marketplace_requests_insert_self" ON public.marketplace_requests
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND approved_amount IS NULL
    AND repaid_amount = 0
    AND NOT EXISTS (
      SELECT 1 FROM public.marketplace_services s
      WHERE s.id = service_id AND s.category = 'credit'
    )
  );


-- ----------------------------------------------------------------------------
-- 5. Vidéos de présentation : espace privé, 50 Mo, formats vidéo seulement.
--    Chaque personne n'écrit que dans son dossier ; seule elle et l'équipe
--    peuvent regarder.
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('credit-videos', 'credit-videos', false, 52428800,
        ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-matroska'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "credit_videos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "credit_videos_select_own_or_admin" ON storage.objects;

CREATE POLICY "credit_videos_insert_own" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'credit-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "credit_videos_select_own_or_admin" ON storage.objects FOR SELECT
  USING (bucket_id = 'credit-videos' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));


-- ----------------------------------------------------------------------------
-- 6. Mouvement d'argent interne au crédit
-- ----------------------------------------------------------------------------
-- execute_financial_transaction refuse, à juste titre, qu'une session non
-- admin CRÉDITE un portefeuille. Or c'est l'emprunteur qui, en acceptant
-- l'offre, déclenche le versement. Ce helper fait le même travail (solde
-- verrouillé, partie double, idempotence, historique, audit) mais n'est
-- appelable par PERSONNE directement : seulement depuis les fonctions de
-- crédit ci-dessous, qui font chacune leurs propres contrôles d'accès.
CREATE OR REPLACE FUNCTION public._credit_wallet_move(
  p_idempotency_key text,
  p_user_id uuid,
  p_amount numeric,
  p_direction text,          -- 'debit' : sort du portefeuille ; 'credit' : y entre
  p_counter_account text,
  p_description text,
  p_action_type text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_wallet text := 'user_wallet:' || p_user_id::text;
  v_tx text;
  v_debit_account text;
  v_credit_account text;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le montant doit être supérieur à zéro.');
  END IF;
  IF p_direction NOT IN ('debit', 'credit') THEN
    RAISE EXCEPTION 'Sens de mouvement invalide : %', p_direction;
  END IF;

  IF EXISTS (SELECT 1 FROM public.idempotency_keys WHERE key = p_idempotency_key) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Opération déjà effectuée.', 'replayed', true);
  END IF;

  SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Compte introuvable.');
  END IF;

  IF p_direction = 'debit' THEN
    IF v_balance < p_amount THEN
      RETURN jsonb_build_object('success', false, 'message', 'Solde insuffisant dans votre portefeuille.');
    END IF;
    v_debit_account := v_wallet;
    v_credit_account := p_counter_account;
  ELSE
    v_debit_account := p_counter_account;
    v_credit_account := v_wallet;
  END IF;

  v_tx := gen_random_uuid()::text;

  UPDATE public.profiles
     SET wallet_balance = wallet_balance + CASE WHEN p_direction = 'debit' THEN -p_amount ELSE p_amount END,
         updated_at = now()
   WHERE id = p_user_id;

  INSERT INTO public.double_entry_ledger (id, transaction_id, idempotency_key, account, counterparty, type, amount, currency, description)
  VALUES
    (v_tx || '_dr', v_tx, p_idempotency_key, v_debit_account, v_credit_account, 'debit', p_amount, 'FCFA', p_description),
    (v_tx || '_cr', v_tx, p_idempotency_key, v_credit_account, v_debit_account, 'credit', p_amount, 'FCFA', p_description);

  INSERT INTO public.idempotency_keys (key, transaction_id, user_id, amount, action_type)
  VALUES (p_idempotency_key, v_tx, p_user_id, p_amount, p_action_type);

  INSERT INTO public.wallet_transactions (user_id, amount, type, description, status, reference, payment_method)
  VALUES (
    p_user_id,
    CASE WHEN p_direction = 'debit' THEN -p_amount ELSE p_amount END,
    CASE WHEN p_direction = 'debit' THEN 'payout_deduction' ELSE 'payout_credit' END,
    p_description, 'completed', v_tx, 'wallet'
  );

  INSERT INTO public.audit_logs (user_id, action, details, ip, device, status, idempotency_key)
  VALUES (p_user_id, p_action_type,
          p_description || ' | Débit [' || v_debit_account || '] / Crédit [' || v_credit_account || '] de ' || p_amount || ' FCFA'
            || ' | Appelant : ' || coalesce(auth.uid()::text, 'système'),
          'non disponible', 'Application', 'success', p_idempotency_key);

  RETURN jsonb_build_object('success', true, 'transactionId', v_tx);
END;
$$;

REVOKE ALL ON FUNCTION public._credit_wallet_move(text, uuid, numeric, text, text, text, text) FROM PUBLIC, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 7. Dépôt du dossier (emprunteur) — frais débités dans la même transaction
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_credit_application(
  p_service_id uuid,
  p_project_title text,
  p_project_description text,
  p_requested_amount numeric,
  p_requested_months integer,
  p_video_path text,
  p_video_url text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_service record;
  v_profile record;
  v_fee numeric;
  v_platform_wallet uuid;
  v_cap numeric;
  v_move jsonb;
  v_app_id uuid;
  v_existing uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Vous devez être connecté·e.');
  END IF;
  IF p_idempotency_key IS NULL OR char_length(p_idempotency_key) < 8 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Requête invalide.');
  END IF;

  -- Rejeu réseau du même envoi : on renvoie le dossier déjà créé.
  SELECT id INTO v_existing FROM public.credit_applications WHERE fee_idempotency_key = p_idempotency_key AND user_id = v_uid;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'message', 'Votre dossier a bien été déposé.', 'applicationId', v_existing);
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
    RETURN jsonb_build_object('success', false, 'message', 'Vous avez déjà un dossier de crédit en cours.');
  END IF;

  IF p_project_title IS NULL OR char_length(trim(p_project_title)) < 3 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Donnez un nom à votre projet.');
  END IF;
  IF p_project_description IS NULL OR char_length(trim(p_project_description)) < 20 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Expliquez votre projet en quelques phrases (20 caractères minimum).');
  END IF;
  IF p_requested_months IS NULL OR p_requested_months < 1 OR p_requested_months > 24 THEN
    RETURN jsonb_build_object('success', false, 'message', 'La durée doit être comprise entre 1 et 24 mois.');
  END IF;

  -- Même plafond indicatif que l'écran : 2 × l'épargne versée, 5 000 minimum.
  v_cap := greatest(5000, round(coalesce(v_profile.total_saved, 0) * 2));
  IF p_requested_amount IS NULL OR p_requested_amount <= 0 OR p_requested_amount > v_cap THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le montant doit être compris entre 1 et ' || v_cap || ' FCFA.');
  END IF;

  -- La vidéo envoyée doit être dans le dossier de la personne ; un lien doit
  -- être une vraie adresse web.
  IF p_video_path IS NOT NULL AND split_part(p_video_path, '/', 1) <> v_uid::text THEN
    RETURN jsonb_build_object('success', false, 'message', 'Vidéo invalide.');
  END IF;
  IF p_video_url IS NOT NULL AND p_video_url !~* '^https://[^\s]+$' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le lien de la vidéo doit commencer par https://');
  END IF;

  SELECT credit_application_fee, platform_wallet_id INTO v_fee, v_platform_wallet
  FROM public.platform_settings WHERE id = 1;
  v_fee := coalesce(v_fee, 1000);

  IF v_fee > 0 THEN
    v_move := public._credit_wallet_move(
      'credit_fee_' || p_idempotency_key, v_uid, v_fee, 'debit',
      CASE WHEN v_platform_wallet IS NOT NULL THEN 'platform_wallet:' || v_platform_wallet ELSE 'platform_revenue' END,
      'Frais de dossier microcrédit — ' || trim(p_project_title),
      'credit_application_fee'
    );
    IF NOT (v_move->>'success')::boolean THEN
      RETURN jsonb_build_object('success', false, 'message',
        CASE WHEN v_move->>'message' LIKE 'Solde insuffisant%'
          THEN 'Il faut ' || v_fee || ' FCFA sur votre portefeuille pour les frais de dossier. Rechargez puis réessayez.'
          ELSE v_move->>'message' END);
    END IF;

    IF v_platform_wallet IS NOT NULL THEN
      UPDATE public.profiles SET wallet_balance = wallet_balance + v_fee, updated_at = now() WHERE id = v_platform_wallet;
      INSERT INTO public.wallet_transactions (user_id, amount, type, description, status, reference, payment_method)
      VALUES (v_platform_wallet, v_fee, 'payout_credit', 'Frais de dossier microcrédit reçus', 'completed', 'credit_fee_' || p_idempotency_key, 'wallet');
    END IF;
  END IF;

  INSERT INTO public.credit_applications (
    user_id, service_id, project_title, project_description, requested_amount, requested_months,
    video_path, video_url, application_fee, fee_idempotency_key
  ) VALUES (
    v_uid, p_service_id, trim(p_project_title), trim(p_project_description), p_requested_amount, p_requested_months,
    nullif(trim(p_video_path), ''), nullif(trim(p_video_url), ''), v_fee, p_idempotency_key
  ) RETURNING id INTO v_app_id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_uid, 'Dossier de crédit déposé',
          'Votre dossier « ' || trim(p_project_title) || ' » est entre les mains de notre équipe. Vous serez prévenu·e de sa décision.',
          'system');

  RETURN jsonb_build_object('success', true, 'message', 'Votre dossier a bien été déposé.', 'applicationId', v_app_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_credit_application(uuid, text, text, numeric, integer, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_credit_application(uuid, text, text, numeric, integer, text, text, text) TO authenticated;


-- ----------------------------------------------------------------------------
-- 8. Décision de l'équipe : offre ou refus
-- ----------------------------------------------------------------------------
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
  IF p_interest_rate IS NULL OR p_interest_rate < 0 OR p_interest_rate > 100 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le taux doit être compris entre 0 et 100 %.');
  END IF;
  IF p_duration_months IS NULL OR p_duration_months < 1 OR p_duration_months > 24 THEN
    RETURN jsonb_build_object('success', false, 'message', 'La durée doit être comprise entre 1 et 24 mois.');
  END IF;

  SELECT * INTO v_app FROM public.credit_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Dossier introuvable.');
  END IF;
  IF v_app.status <> 'submitted' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce dossier a déjà été traité.');
  END IF;

  -- Intérêt simple sur le montant prêté, arrondi au franc : c'est le total
  -- affiché à l'emprunteur, au franc près, avant qu'il n'accepte.
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

REVOKE ALL ON FUNCTION public.make_credit_offer(uuid, numeric, numeric, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.make_credit_offer(uuid, numeric, numeric, integer, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.reject_credit_application(p_application_id uuid, p_reason text)
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

  SELECT * INTO v_app FROM public.credit_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Dossier introuvable.');
  END IF;
  IF v_app.status <> 'submitted' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce dossier a déjà été traité.');
  END IF;

  UPDATE public.credit_applications SET
    status = 'rejected', rejection_reason = trim(p_reason),
    reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE id = p_application_id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_app.user_id, 'Votre dossier de crédit n''a pas été retenu',
          '« ' || v_app.project_title || ' » : ' || trim(p_reason), 'system');

  RETURN jsonb_build_object('success', true, 'message', 'Dossier refusé.');
END;
$$;

REVOKE ALL ON FUNCTION public.reject_credit_application(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_credit_application(uuid, text) TO authenticated;


-- ----------------------------------------------------------------------------
-- 9. Réponse de l'emprunteur à l'offre
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_credit_offer(p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_app record;
  v_move jsonb;
  v_base numeric;
  v_i integer;
BEGIN
  SELECT * INTO v_app FROM public.credit_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND OR v_app.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Dossier introuvable.');
  END IF;
  IF v_app.status = 'active' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Crédit déjà versé.');
  END IF;
  IF v_app.status <> 'offered' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Aucune offre en attente sur ce dossier.');
  END IF;

  -- Clé dérivée du dossier : un double appui ne verse jamais deux fois.
  v_move := public._credit_wallet_move(
    'credit_disbursement_' || v_app.id::text, v_app.user_id, v_app.offered_amount, 'credit',
    'credit_fund:' || v_app.service_id::text,
    'Versement crédit — ' || v_app.project_title,
    'credit_disbursement'
  );
  IF NOT (v_move->>'success')::boolean THEN
    RAISE EXCEPTION '%', v_move->>'message';
  END IF;

  -- Mensualités égales ; la dernière absorbe l'arrondi pour que la somme
  -- tombe exactement sur total_due.
  v_base := floor(v_app.total_due / v_app.duration_months);
  FOR v_i IN 1..v_app.duration_months LOOP
    INSERT INTO public.credit_installments (application_id, number, due_date, amount_due)
    VALUES (
      v_app.id, v_i, (current_date + make_interval(months => v_i))::date,
      CASE WHEN v_i = v_app.duration_months THEN v_app.total_due - v_base * (v_app.duration_months - 1) ELSE v_base END
    );
  END LOOP;

  UPDATE public.credit_applications SET
    status = 'active', accepted_at = now(), disbursed_at = now(), updated_at = now()
  WHERE id = v_app.id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_app.user_id, 'Crédit versé sur votre portefeuille',
          v_app.offered_amount || ' FCFA pour « ' || v_app.project_title || ' ». Première échéance le '
            || to_char(current_date + interval '1 month', 'DD/MM/YYYY') || '.',
          'system');

  RETURN jsonb_build_object('success', true, 'message', 'Le crédit a été versé sur votre portefeuille.');
END;
$$;

REVOKE ALL ON FUNCTION public.accept_credit_offer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_credit_offer(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.decline_credit_offer(p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.credit_applications SET status = 'declined', updated_at = now()
  WHERE id = p_application_id AND user_id = auth.uid() AND status = 'offered';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Aucune offre en attente sur ce dossier.');
  END IF;
  RETURN jsonb_build_object('success', true, 'message', 'Offre refusée. Vous pourrez déposer un nouveau dossier.');
END;
$$;

REVOKE ALL ON FUNCTION public.decline_credit_offer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_credit_offer(uuid) TO authenticated;


-- ----------------------------------------------------------------------------
-- 10. Remboursement
-- ----------------------------------------------------------------------------
-- Cœur commun au remboursement volontaire et au prélèvement automatique :
-- débite le portefeuille puis impute la somme sur les échéances, de la plus
-- ancienne à la plus récente. Non exposé directement.
CREATE OR REPLACE FUNCTION public._apply_credit_repayment(
  p_application_id uuid,
  p_amount numeric,
  p_idempotency_key text,
  p_label text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_app record;
  v_remaining numeric;
  v_left numeric;
  v_inst record;
  v_part numeric;
  v_move jsonb;
BEGIN
  SELECT * INTO v_app FROM public.credit_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND OR v_app.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Aucun crédit en cours sur ce dossier.');
  END IF;

  v_remaining := v_app.total_due - v_app.repaid_amount;
  IF p_amount <= 0 OR p_amount > v_remaining THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le montant doit être compris entre 1 et ' || v_remaining || ' FCFA.');
  END IF;

  v_move := public._credit_wallet_move(
    p_idempotency_key, v_app.user_id, p_amount, 'debit',
    'credit_fund:' || v_app.service_id::text,
    p_label || ' — ' || v_app.project_title,
    'credit_repayment'
  );
  IF NOT (v_move->>'success')::boolean THEN
    RETURN v_move;
  END IF;
  IF coalesce((v_move->>'replayed')::boolean, false) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Remboursement déjà enregistré.', 'remaining', v_remaining);
  END IF;

  v_left := p_amount;
  FOR v_inst IN
    SELECT * FROM public.credit_installments
    WHERE application_id = p_application_id AND status <> 'paid'
    ORDER BY number
    FOR UPDATE
  LOOP
    EXIT WHEN v_left <= 0;
    v_part := least(v_left, v_inst.amount_due - v_inst.amount_paid);
    UPDATE public.credit_installments SET
      amount_paid = amount_paid + v_part,
      status = CASE WHEN amount_paid + v_part >= amount_due THEN 'paid' ELSE status END,
      paid_at = CASE WHEN amount_paid + v_part >= amount_due THEN now() ELSE paid_at END
    WHERE id = v_inst.id;
    v_left := v_left - v_part;
  END LOOP;

  UPDATE public.credit_applications SET
    repaid_amount = repaid_amount + p_amount,
    status = CASE WHEN repaid_amount + p_amount >= total_due THEN 'repaid' ELSE status END,
    repaid_at = CASE WHEN repaid_amount + p_amount >= total_due THEN now() ELSE repaid_at END,
    updated_at = now()
  WHERE id = p_application_id;

  IF v_remaining - p_amount <= 0 THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (v_app.user_id, 'Crédit entièrement remboursé',
            'Bravo ! « ' || v_app.project_title || ' » est soldé. Vous pouvez déposer un nouveau dossier.', 'system');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Remboursement enregistré.', 'remaining', v_remaining - p_amount);
END;
$$;

REVOKE ALL ON FUNCTION public._apply_credit_repayment(uuid, numeric, text, text) FROM PUBLIC, anon, authenticated;


CREATE OR REPLACE FUNCTION public.repay_credit(p_application_id uuid, p_amount numeric, p_idempotency_key text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.credit_applications WHERE id = p_application_id AND user_id = auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Dossier introuvable.');
  END IF;
  IF p_idempotency_key IS NULL OR char_length(p_idempotency_key) < 8 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Requête invalide.');
  END IF;
  RETURN public._apply_credit_repayment(p_application_id, p_amount, 'credit_repay_' || p_idempotency_key, 'Remboursement crédit');
END;
$$;

REVOKE ALL ON FUNCTION public.repay_credit(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repay_credit(uuid, numeric, text) TO authenticated;


-- ----------------------------------------------------------------------------
-- 11. Prélèvement automatique des échéances arrivées (toutes les heures)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_due_credit_installments()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inst record;
  v_balance numeric;
  v_due numeric;
  v_result jsonb;
  v_count integer := 0;
BEGIN
  FOR v_inst IN
    SELECT i.*, a.user_id, a.project_title
    FROM public.credit_installments i
    JOIN public.credit_applications a ON a.id = i.application_id
    WHERE a.status = 'active' AND i.status <> 'paid' AND i.due_date <= current_date
    ORDER BY i.due_date, i.number
  LOOP
    v_due := v_inst.amount_due - v_inst.amount_paid;
    SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = v_inst.user_id;

    IF coalesce(v_balance, 0) >= v_due THEN
      -- Clé par échéance et par montant restant : un même reliquat n'est
      -- jamais prélevé deux fois, même si le cron repasse.
      v_result := public._apply_credit_repayment(
        v_inst.application_id, v_due,
        'credit_auto_' || v_inst.id::text || '_' || v_inst.amount_paid::text,
        'Mensualité ' || v_inst.number || ' prélevée'
      );
      IF (v_result->>'success')::boolean THEN
        v_count := v_count + 1;
      END IF;
    ELSIF v_inst.status = 'pending' THEN
      UPDATE public.credit_installments SET status = 'late' WHERE id = v_inst.id;
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (v_inst.user_id, 'Mensualité de crédit en retard',
              'La mensualité ' || v_inst.number || ' de « ' || v_inst.project_title || ' » (' || v_due
                || ' FCFA) n''a pas pu être prélevée : rechargez votre portefeuille.', 'system');
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.process_due_credit_installments() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-due-credit-installments') THEN
    PERFORM cron.unschedule('process-due-credit-installments');
  END IF;
  PERFORM cron.schedule('process-due-credit-installments', '7 * * * *', 'SELECT public.process_due_credit_installments();');
END;
$$;


-- ----------------------------------------------------------------------------
-- 12. Retrait de l'ancien circuit de crédit (aucun crédit en cours)
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.approve_marketplace_credit(uuid, numeric, date, text);
DROP FUNCTION IF EXISTS public.repay_marketplace_credit(uuid, numeric, text);
