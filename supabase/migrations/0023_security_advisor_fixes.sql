-- ============================================================================
-- 0023 — Correctifs du contrôle de sécurité Supabase (15 oct. 2026)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. member_profiles : lecture seule, et seulement les profils qu'on a le
--    droit de voir  [CRITIQUE]
-- ----------------------------------------------------------------------------
-- La vue (0012) tourne avec les droits de son propriétaire : elle contourne
-- les règles d'accès de `profiles`. 0012 n'avait retiré les droits qu'à
-- `public` et `anon` ; les privilèges par défaut de Supabase avaient donné à
-- `authenticated` INSERT, UPDATE et DELETE. Une vue sur une seule table est
-- modifiable : n'importe quel compte connecté pouvait SUPPRIMER le profil de
-- n'importe qui (et, en cascade, ses données), ou lire tous les profils de la
-- plateforme.
--
-- On garde la vue en SECURITY DEFINER (elle doit lire `profiles`, dont les
-- colonnes sont verrouillées), mais on borne les lignes :
--   - soi-même ;
--   - les personnes avec qui on partage un cercle actif ;
--   - les demandeurs en attente d'un cercle qu'on a créé (pour les accepter) ;
--   - tout le monde pour un admin.
CREATE OR REPLACE FUNCTION public.can_see_member_profile(p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    p_user_id = auth.uid()
    OR public.shares_group_with(p_user_id)
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.group_members m
      JOIN public.groups g ON g.id = m.group_id
      WHERE m.user_id = p_user_id AND g.creator_id = auth.uid()
    )
  );
$$;

REVOKE ALL ON FUNCTION public.can_see_member_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_member_profile(uuid) TO authenticated;

CREATE OR REPLACE VIEW public.member_profiles AS
  SELECT id, display_name, avatar_config, avatar_url, reputation_score, kyc_level
  FROM public.profiles
  WHERE public.can_see_member_profile(id);

REVOKE ALL ON public.member_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.member_profiles TO authenticated;


-- ----------------------------------------------------------------------------
-- 2. Ma Banque : on retire les anciennes versions sans clé d'idempotence
-- ----------------------------------------------------------------------------
-- 0016 a ajouté deposit_to_vault / withdraw_from_vault avec une vraie clé
-- d'idempotence, mais les versions à 2 arguments (clé recalculée à chaque
-- appel, donc un rejeu réseau dépose ou retire deux fois) étaient restées
-- appelables. L'application n'utilise plus que les versions à 3 arguments.
DROP FUNCTION IF EXISTS public.deposit_to_vault(uuid, numeric);
DROP FUNCTION IF EXISTS public.withdraw_from_vault(uuid, numeric);


-- ----------------------------------------------------------------------------
-- 3. Aucune fonction de l'application n'est appelable sans être connecté
-- ----------------------------------------------------------------------------
-- Elles vérifient toutes auth.uid() à l'intérieur, mais rien ne justifie
-- qu'un visiteur anonyme puisse les appeler : on ferme la porte en amont.
-- Les fonctions de déclencheur ne sont jamais appelées directement : on les
-- retire aussi aux comptes connectés.
-- Attention : beaucoup de fonctions n'étaient accessibles aux comptes
-- connectés QUE via PUBLIC (dont celles qu'utilisent les règles d'accès,
-- comme is_admin ou is_group_member). On relit donc le droit actuel de
-- `authenticated` AVANT de retirer PUBLIC, et on le lui redonne
-- explicitement : rien ne change pour les comptes connectés, seul l'accès
-- anonyme disparaît. Les fonctions réservées au serveur (déjà retirées à
-- authenticated) le restent. Même précaution pour service_role.
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig,
           p.prorettype = 'trigger'::regtype AS is_trigger,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_can,
           has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_can
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef
  LOOP
    IF f.auth_can AND NOT f.is_trigger THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
    END IF;
    -- Le serveur (webhook PayDunya, tâches planifiées) garde tous ses droits.
    IF f.service_can THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    IF f.is_trigger THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', f.sig);
    END IF;
  END LOOP;
END;
$$;

-- Les nouvelles fonctions ne seront plus exécutables par anon par défaut.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;


-- ----------------------------------------------------------------------------
-- 4. search_path fixé sur les deux fonctions de tarif Ma Banque
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('bank_tier_price', 'bank_tier_max_vaults')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', f.sig);
  END LOOP;
END;
$$;
