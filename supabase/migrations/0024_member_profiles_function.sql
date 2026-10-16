-- ============================================================================
-- 0024 — member_profiles devient une fonction (alerte « Security Definer View »)
-- ============================================================================
-- Depuis 0023, la vue member_profiles est en lecture seule et ne renvoie que
-- les profils autorisés : la faille est fermée. Mais le contrôle de sécurité
-- Supabase classe TOUTE vue SECURITY DEFINER en « Critical », ce qui laisse
-- une alerte rouge permanente — et une alerte qu'on apprend à ignorer finit
-- par masquer la prochaine vraie.
--
-- Même règle, même colonnes, sous forme de fonction : l'application l'appelle
-- via rpc('get_member_profiles') (src/lib/members.ts, qui retombe sur l'ancienne
-- vue si cette migration n'est pas encore passée).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_member_profiles(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  display_name text,
  avatar_config jsonb,
  avatar_url text,
  reputation_score integer,
  kyc_level integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.avatar_config, p.avatar_url, p.reputation_score, p.kyc_level
  FROM public.profiles p
  WHERE p.id = ANY (p_ids)
    AND public.can_see_member_profile(p.id);
$$;

REVOKE ALL ON FUNCTION public.get_member_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_profiles(uuid[]) TO authenticated;

DROP VIEW IF EXISTS public.member_profiles;
