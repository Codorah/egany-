-- ============================================================================
-- 0029 — MODIFIER OU SUPPRIMER SON CERCLE, SANS TOUCHER À L'ARGENT
-- ============================================================================
-- L'organisatrice doit pouvoir corriger un cercle mal configuré (montant,
-- rythme, nombre de places…) ou le supprimer. Mais les policies actuelles
-- lui laissaient déjà tout faire, sans garde-fou :
--
--   * DELETE sur `groups` supprimait EN CASCADE les cotisations et les
--     versements : un cercle où de l'argent avait circulé pouvait disparaître
--     avec tout son historique.
--   * UPDATE portait sur la ligne entière : montant de la cotisation changé
--     après des versements, rang du tour courant, bénéficiaire tiré, code
--     d'invitation, voire créatrice du cercle.
--
-- Règle unique : tant qu'aucun argent n'a circulé (aucune cotisation payée,
-- aucun versement), le cercle se modifie librement ou se supprime. Ensuite,
-- seuls le nom, la description, la confidentialité et les règles changent,
-- et le cercle ne se supprime plus : il se clôture.
--
-- Les fonctions de versement (draw_payout_beneficiary,
-- execute_payout_disbursement, claim_reminder_period) sont SECURITY DEFINER :
-- elles s'exécutent en tant que propriétaire, pas en tant que
-- `authenticated`. Les contrôles ci-dessous ne visent que les écritures
-- directes depuis l'application.
-- ============================================================================

CREATE OR REPLACE FUNCTION public._group_money_moved(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.contributions WHERE group_id = p_group_id AND status = 'paid')
      OR EXISTS (SELECT 1 FROM public.payouts WHERE group_id = p_group_id);
$$;

REVOKE ALL ON FUNCTION public._group_money_moved(uuid) FROM PUBLIC, anon, authenticated;

-- Pour l'écran : savoir s'il faut proposer « Modifier tout » et « Supprimer »,
-- ou seulement le nom et « Clôturer ». Réservé aux personnes du cercle.
CREATE OR REPLACE FUNCTION public.group_money_moved(p_group_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.is_group_creator(p_group_id) OR public.is_group_member(p_group_id) OR public.is_admin()) THEN
    RETURN NULL;
  END IF;
  RETURN public._group_money_moved(p_group_id);
END;
$$;

REVOKE ALL ON FUNCTION public.group_money_moved(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.group_money_moved(uuid) TO authenticated;


-- ----------------------------------------------------------------------------
-- Modification
-- ----------------------------------------------------------------------------
-- SANS security definer, volontairement : `current_user` doit refléter
-- l'appelant. Écriture directe depuis l'app → 'authenticated' ; écriture
-- faite à l'intérieur d'une fonction SECURITY DEFINER → son propriétaire.
CREATE OR REPLACE FUNCTION public._guard_group_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_active integer;
BEGIN
  -- Écritures des fonctions serveur : déjà contrôlées par elles-mêmes.
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  -- Jamais depuis l'application : ce sont les rouages de la rotation.
  IF NEW.creator_id IS DISTINCT FROM OLD.creator_id
     OR NEW.join_code IS DISTINCT FROM OLD.join_code
     OR NEW.current_payout_index IS DISTINCT FROM OLD.current_payout_index
     OR NEW.drawn_beneficiary_id IS DISTINCT FROM OLD.drawn_beneficiary_id
     OR NEW.last_reminder_period IS DISTINCT FROM OLD.last_reminder_period THEN
    RAISE EXCEPTION 'Ce champ du cercle ne peut pas être modifié.' USING ERRCODE = '42501';
  END IF;

  -- Un cercle se clôture, il ne se rouvre pas depuis l'application.
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (NEW.status = 'completed' OR public.is_admin()) THEN
    RAISE EXCEPTION 'Ce changement de statut n''est pas autorisé.' USING ERRCODE = '42501';
  END IF;

  IF NEW.contribution_amount IS DISTINCT FROM OLD.contribution_amount
     OR NEW.frequency IS DISTINCT FROM OLD.frequency
     OR NEW.max_members IS DISTINCT FROM OLD.max_members
     OR NEW.distribution_method IS DISTINCT FROM OLD.distribution_method
     OR NEW.start_date IS DISTINCT FROM OLD.start_date
     OR NEW.next_payout_date IS DISTINCT FROM OLD.next_payout_date
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.penalty_type IS DISTINCT FROM OLD.penalty_type
     OR NEW.penalty_amount IS DISTINCT FROM OLD.penalty_amount
     OR NEW.penalty_rate IS DISTINCT FROM OLD.penalty_rate
     OR NEW.grace_period IS DISTINCT FROM OLD.grace_period THEN

    -- Dans le doute (NULL : appelant étranger au cercle), on refuse.
    IF coalesce(public.group_money_moved(OLD.id), true) THEN
      RAISE EXCEPTION 'Des cotisations ont déjà été versées dans ce cercle : le montant, le rythme et les règles ne peuvent plus changer.'
        USING ERRCODE = 'P0001';
    END IF;

    IF NEW.contribution_amount IS NULL OR NEW.contribution_amount < 500 THEN
      RAISE EXCEPTION 'La cotisation minimale est de 500 FCFA.' USING ERRCODE = 'P0001';
    END IF;

    -- Lisible par la créatrice et les admins (policy group_members_select_visible).
    SELECT count(*) INTO v_active FROM public.group_members WHERE group_id = OLD.id AND status = 'active';
    IF NEW.max_members IS NOT NULL AND (NEW.max_members < greatest(2, v_active) OR NEW.max_members > 100) THEN
      RAISE EXCEPTION 'Le nombre de places doit être compris entre % et 100.', greatest(2, v_active) USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._guard_group_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS groups_guard_update ON public.groups;
CREATE TRIGGER groups_guard_update
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public._guard_group_update();


-- ----------------------------------------------------------------------------
-- Suppression
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._guard_group_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Vaut pour tout le monde, administrateurs compris : la cascade effacerait
  -- l'historique des cotisations et des versements.
  IF public._group_money_moved(OLD.id) THEN
    RAISE EXCEPTION 'Des cotisations ont déjà été versées dans ce cercle : il ne peut plus être supprimé. Vous pouvez le clôturer.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Les autres membres apprennent pourquoi le cercle a disparu de leur liste.
  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT gm.user_id,
         'Cercle supprimé',
         '« ' || OLD.name || ' » a été supprimé par son organisatrice. Aucune cotisation n''avait été versée.',
         'system'
  FROM public.group_members gm
  WHERE gm.group_id = OLD.id AND gm.user_id <> OLD.creator_id;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public._guard_group_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS groups_guard_delete ON public.groups;
CREATE TRIGGER groups_guard_delete
  BEFORE DELETE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public._guard_group_delete();
