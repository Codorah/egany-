-- ============================================================================
-- 0021 — Un cercle privé est réellement privé
-- ============================================================================
-- Avant : les policies "groups_select_all" et "group_members_select_all"
-- laissaient TOUT compte connecté lire TOUS les cercles et TOUTES les
-- adhésions, cercles privés compris. Concrètement, n'importe qui pouvait :
--   - lister les cercles privés, leurs montants, leurs membres et l'ordre de
--     passage ;
--   - lire le code d'invitation d'un cercle privé, et donc demander à le
--     rejoindre sans y avoir été invité.
--
-- Après :
--   - un cercle public reste visible de tous (c'est la recherche) ;
--   - un cercle privé n'est visible que de sa créatrice, de ses membres, de
--     la personne qui a demandé à le rejoindre, et des admins ;
--   - rejoindre par code passe par find_group_by_join_code, qui ne renvoie
--     QUE le cercle correspondant au code exact fourni.
-- ============================================================================

-- Toute adhésion, quel que soit son statut (la personne en attente doit
-- continuer de voir le cercle qu'elle a demandé). SECURITY DEFINER : lit
-- group_members sans repasser par ses propres policies (pas de récursion).
CREATE OR REPLACE FUNCTION public.has_group_membership(p_group_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members WHERE group_id = p_group_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_public_group(p_group_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.groups WHERE id = p_group_id AND NOT coalesce(is_private, false));
$$;

REVOKE ALL ON FUNCTION public.has_group_membership(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_public_group(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_group_membership(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_public_group(uuid) TO authenticated;


DROP POLICY IF EXISTS "groups_select_all" ON public.groups;
DROP POLICY IF EXISTS "groups_select_visible" ON public.groups;
CREATE POLICY "groups_select_visible" ON public.groups
  FOR SELECT USING (
    NOT coalesce(is_private, false)
    OR creator_id = auth.uid()
    OR public.has_group_membership(id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "group_members_select_all" ON public.group_members;
DROP POLICY IF EXISTS "group_members_select_visible" ON public.group_members;
CREATE POLICY "group_members_select_visible" ON public.group_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_group_member(group_id)
    OR public.is_group_creator(group_id)
    OR public.is_public_group(group_id)
    OR public.is_admin()
  );


-- Rejoindre par code : le code est le secret. On ne renvoie que le cercle
-- dont le code correspond exactement, jamais une liste.
CREATE OR REPLACE FUNCTION public.find_group_by_join_code(p_code text)
RETURNS SETOF public.groups
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.groups
  WHERE auth.uid() IS NOT NULL
    AND p_code IS NOT NULL
    AND char_length(trim(p_code)) >= 4
    AND upper(join_code) = upper(trim(p_code))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_group_by_join_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_group_by_join_code(text) TO authenticated;
