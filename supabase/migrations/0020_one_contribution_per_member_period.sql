-- ============================================================================
-- 0020 — Une seule cotisation par membre, par cercle et par période
-- ============================================================================
-- Constaté le 15 oct. 2026 : un membre du cercle « Commerce & Marché » avait
-- DEUX cotisations « Octobre 2026 » — l'une payée en espèces, l'autre créée
-- 3 secondes plus tard, puis passée « en retard » par le prélèvement
-- automatique faute de solde. Résultat à l'écran : un membre à jour affiché
-- en retard, et une cotisation due qui n'existe pas.
--
-- Cause : ContributionsManager insère une nouvelle ligne à chaque appui
-- (« Enregistrer un paiement », « Créer l'appel de cotisation ») sans
-- regarder si la période existe déjà, et rien en base ne l'interdisait.
-- Le client est corrigé (il met à jour la ligne existante) ; cette
-- contrainte garantit que cela ne peut plus arriver, même par double appui.
-- ============================================================================

-- 1. Nettoyage des doublons qui ne portent AUCUN argent : pas de débit
--    (debited_at, idempotency_key), pas de pénalité réglée, pas « payée ».
--    On garde, par (cercle, membre, période), la ligne payée si elle existe,
--    sinon la plus ancienne.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY group_id, user_id, period
           ORDER BY (status = 'paid') DESC, created_at ASC
         ) AS rn
  FROM public.contributions
  WHERE period IS NOT NULL
)
DELETE FROM public.contributions c
USING ranked r
WHERE c.id = r.id
  AND r.rn > 1
  AND c.status <> 'paid'
  AND c.debited_at IS NULL
  AND c.idempotency_key IS NULL
  AND coalesce(c.penalty_status, 'none') <> 'paid';

-- 2. La règle, en base. Si cette instruction échoue, c'est qu'il reste un
--    doublon qui porte de l'argent : il faut l'examiner à la main, pas le
--    supprimer automatiquement.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_contribution_member_period
  ON public.contributions (group_id, user_id, period)
  WHERE period IS NOT NULL;
