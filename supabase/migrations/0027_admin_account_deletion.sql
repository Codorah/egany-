-- ============================================================================
-- 0027 — SUPPRESSION DE COMPTE LANCÉE PAR UN ADMIN
-- ============================================================================
-- Google Play exige une page web pour demander la suppression sans passer par
-- l'application (eganye.codorah.com/suppression-compte) : la demande arrive
-- par e-mail. L'équipe n'avait aucun moyen de la traiter, puisque
-- request_account_deletion() ne supprime que le compte de l'appelant.
--
-- La logique (refus si solde, cercle actif ou crédit en cours, puis
-- anonymisation) passe dans _delete_account, partagée par :
--   * request_account_deletion()          — la personne, depuis Profil ;
--   * admin_request_account_deletion(uuid) — un admin, pour une demande e-mail.
-- Mêmes contrôles des deux côtés : un admin ne peut pas faire disparaître un
-- compte qui a encore de l'argent ou des engagements envers un cercle.
--
-- La suite est commune : la demande apparaît dans la file « Suppressions de
-- compte à finaliser » de l'admin (api/purge-account-files efface les fichiers
-- et le compte de connexion).

CREATE OR REPLACE FUNCTION public._delete_account(p_user uuid, p_by_admin boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_active_groups integer;
BEGIN
  SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = p_user;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Profil introuvable.');
  END IF;

  IF coalesce(v_balance, 0) > 0 THEN
    RETURN jsonb_build_object('success', false, 'message',
      CASE WHEN p_by_admin
        THEN 'Ce compte a encore un solde de ' || v_balance || ' FCFA : la personne doit le retirer avant la suppression.'
        ELSE 'Retirez d''abord votre solde de ' || v_balance || ' FCFA : supprimer le compte maintenant reviendrait à abandonner cet argent.'
      END);
  END IF;

  SELECT count(*) INTO v_active_groups
  FROM public.group_members gm
  JOIN public.groups g ON g.id = gm.group_id
  WHERE gm.user_id = p_user AND gm.status = 'active' AND g.status = 'active';
  IF v_active_groups > 0 THEN
    RETURN jsonb_build_object('success', false, 'message',
      CASE WHEN p_by_admin
        THEN 'Ce compte participe encore à ' || v_active_groups || ' cercle(s) actif(s) : la personne doit les quitter ou attendre la fin de la rotation.'
        ELSE 'Vous participez encore à ' || v_active_groups || ' cercle(s) actif(s). Quittez-les ou attendez la fin de la rotation avant de supprimer votre compte.'
      END);
  END IF;

  IF EXISTS (SELECT 1 FROM public.credit_applications WHERE user_id = p_user AND status = 'active') THEN
    RETURN jsonb_build_object('success', false, 'message',
      CASE WHEN p_by_admin
        THEN 'Ce compte a un crédit en cours : il doit être remboursé avant la suppression.'
        ELSE 'Vous avez un crédit en cours : remboursez-le avant de supprimer votre compte.'
      END);
  END IF;

  -- Les demandes encore à l'étude sont abandonnées : rien ne sera versé sur
  -- un compte supprimé.
  UPDATE public.credit_applications SET status = 'declined', updated_at = now()
  WHERE user_id = p_user AND status IN ('submitted', 'offered');
  UPDATE public.aid_applications SET status = 'rejected', rejection_reason = 'Compte supprimé', updated_at = now()
  WHERE user_id = p_user AND status = 'submitted';

  -- email est obligatoire : on le remplace par une adresse qui ne mène nulle part.
  UPDATE public.profiles SET
    display_name = 'Compte supprimé',
    first_name = NULL,
    last_name = NULL,
    email = 'supprime+' || p_user::text || '@eganye.invalid',
    phone = NULL,
    avatar_url = NULL,
    avatar_config = NULL,
    date_of_birth = NULL,
    mandate_name = NULL,
    mandate_phone = NULL,
    fcm_token = NULL,
    updated_at = now()
  WHERE id = p_user;

  DELETE FROM public.kyc_submissions WHERE user_id = p_user;
  DELETE FROM public.notifications WHERE user_id = p_user;

  INSERT INTO public.account_deletion_requests (user_id)
  VALUES (p_user)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.audit_logs (user_id, action, details, ip, device, status)
  VALUES (p_user, 'account_deletion',
          CASE WHEN p_by_admin
            THEN 'Profil anonymisé par un admin (' || auth.uid()::text || ') sur demande reçue hors application ; suppression auth en attente.'
            ELSE 'Profil anonymisé sur demande de l''utilisateur ; suppression auth en attente.'
          END,
          'non disponible', CASE WHEN p_by_admin THEN 'Admin' ELSE 'Application' END, 'success');

  RETURN jsonb_build_object('success', true, 'message',
    CASE WHEN p_by_admin
      THEN 'Profil anonymisé. Finalisez la suppression dans la file ci-dessous.'
      ELSE 'Votre compte a été supprimé et vos données personnelles effacées.'
    END);
END;
$$;

-- Fonction interne : jamais appelable directement depuis l'API.
REVOKE ALL ON FUNCTION public._delete_account(uuid, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Session expirée.');
  END IF;
  RETURN public._delete_account(auth.uid(), false);
END;
$$;

REVOKE ALL ON FUNCTION public.request_account_deletion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_account_deletion() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_request_account_deletion(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Réservé aux administrateurs.');
  END IF;
  IF p_user = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Pour fermer votre propre compte, passez par Profil.');
  END IF;
  RETURN public._delete_account(p_user, true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_request_account_deletion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_request_account_deletion(uuid) TO authenticated;
