-- ============================================================================
-- 0022 — Quota d'appels au Copilote IA
-- ============================================================================
-- api/ai-assistant n'avait aucune limite : un seul compte (ou un script avec
-- son jeton) pouvait l'appeler en boucle et faire exploser la facture
-- Anthropic d'eganyé. Le quota est tenu en base, pas en mémoire : sur Vercel,
-- chaque appel peut tomber sur une instance différente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_time ON public.ai_usage(user_id, created_at DESC);

-- Aucune policy : la table n'est lisible et écrivable que par la clé service
-- (le serveur), jamais par l'application.
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Vérifie et consomme une unité de quota en une seule opération atomique
-- (verrou par utilisatrice) : deux appels simultanés ne passent pas tous les
-- deux à la dernière place.
CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_user_id uuid, p_per_hour integer, p_per_day integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hour integer;
  v_day integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('ai_quota:' || p_user_id::text, 0));

  SELECT count(*) FILTER (WHERE created_at > now() - interval '1 hour'),
         count(*)
    INTO v_hour, v_day
  FROM public.ai_usage
  WHERE user_id = p_user_id AND created_at > now() - interval '1 day';

  IF v_hour >= p_per_hour THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'hour');
  END IF;
  IF v_day >= p_per_day THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'day');
  END IF;

  INSERT INTO public.ai_usage (user_id) VALUES (p_user_id);

  -- Ménage : on ne garde que les dernières 48 h.
  DELETE FROM public.ai_usage WHERE user_id = p_user_id AND created_at < now() - interval '2 days';

  RETURN jsonb_build_object('allowed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_quota(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(uuid, integer, integer) TO service_role;
