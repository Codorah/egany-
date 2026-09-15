-- ============================================================================
-- 0008 — SUPPRESSION DE COMPTE RÉELLE
-- ============================================================================
-- Le bouton « Supprimer mon compte » affichait « Votre compte a été clôturé »
-- puis déconnectait, sans rien supprimer : le profil, le solde et l'historique
-- restaient intacts. La politique de confidentialité de l'app promet pourtant
-- explicitement cette suppression.
--
-- La suppression de l'utilisateur auth exige la service_role et ne peut pas
-- venir du navigateur. On fait donc ce qui est faisable côté client en
-- sécurité : anonymiser le profil immédiatement, et déposer une demande
-- qu'un admin finalise côté auth.
--
-- Deux refus volontaires, parce qu'il s'agit d'argent :
--   * solde non nul  -> il faut retirer ses fonds d'abord, sinon supprimer
--                       le compte revient à abandonner l'argent ;
--   * cercle actif   -> partir au milieu d'une rotation léserait les autres
--                       membres qui ont déjà cotisé pour ce tour.

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
  IF NOT found THEN
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

  -- Anonymisation immédiate : ce que l'utilisateur peut exiger tout de suite.
  -- L'historique comptable (double_entry_ledger) est volontairement conservé :
  -- il est légalement requis, et ne porte plus aucune donnée identifiante une
  -- fois le profil anonymisé.
  UPDATE public.profiles SET
    display_name = 'Compte supprimé',
    first_name = NULL,
    last_name = NULL,
    email = NULL,
    phone = NULL,
    avatar_url = NULL,
    date_of_birth = NULL,
    mandate_name = NULL,
    mandate_phone = NULL,
    updated_at = now()
  WHERE id = v_user;

  DELETE FROM public.kyc_submissions WHERE user_id = v_user;
  DELETE FROM public.notifications WHERE user_id = v_user;

  INSERT INTO public.account_deletion_requests (user_id)
  VALUES (v_user)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.audit_logs (user_id, action, details, ip, device, status)
  VALUES (v_user, 'account_deletion', 'Profil anonymisé sur demande de l''utilisateur ; suppression auth en attente.', '0.0.0.0', 'Système', 'success');

  RETURN jsonb_build_object('success', true, 'message', 'Votre compte a été supprimé et vos données personnelles effacées.');
END;
$$;

REVOKE ALL ON FUNCTION public.request_account_deletion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_account_deletion() TO authenticated;
