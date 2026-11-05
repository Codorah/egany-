-- ============================================================================
-- 0034 — Versements mensuels : un vrai mois, plus « 30 jours »
-- ============================================================================
-- execute_payout_disbursement calculait la prochaine date de versement mensuel
-- avec interval '30 days' : la date dérivait d'un jour par mois (le 31 devient
-- le 1er, etc.) alors que les cotisations suivent des mois civils. On passe à
-- interval '1 month' (Postgres gère les fins de mois : 31 janv. -> 28 févr.).
--
-- La fonction étant longue et déjà redéfinie plusieurs fois, on corrige sa
-- définition en place plutôt que d'en recopier une version qui risquerait
-- d'écraser un correctif plus récent.
-- ============================================================================

do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.execute_payout_disbursement(uuid, uuid, uuid, numeric)'::regprocedure)
  into v_def;

  v_new := replace(v_def, 'ELSE interval ''30 days'' END', 'ELSE interval ''1 month'' END');

  if v_new = v_def then
    raise notice 'execute_payout_disbursement : motif non trouvé, rien à corriger (déjà fait ?).';
  else
    execute v_new;
  end if;
end;
$$;
