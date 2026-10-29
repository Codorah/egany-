-- ============================================================================
-- 0030 — SERVICES ANNEXES : TEXTES COMPATIBLES AVEC LE DOSSIER BCEAO
-- ============================================================================
-- Les services restent ouverts aux demandes. On corrige seulement ce qu'ils
-- affichent, en base (titre, partenaire, description, conditions) :
--
--   * Aucun nom d'entreprise (INAM, EnergieTogo / Bboxx…) : citer un
--     partenaire exige une convention de collaboration signée et son RCCM.
--     L'application masque déjà le champ `provider` ; on le neutralise aussi
--     ici pour qu'il ne ressorte nulle part (export, admin, futur écran).
--   * Aucune promesse de rendement : « Épargne Retraite… fort rendement
--     (7 %/an) » présentait la plateforme comme rémunérant l'épargne.
--   * Plus de « Tier A / S » dans les conditions : on parle de score sur 100.
--
-- Mises à jour par titre d'origine : un service renommé entre-temps par un
-- administrateur n'est pas touché.
-- ============================================================================

UPDATE public.marketplace_services
SET provider = 'Partenaire eganyé',
    requirements = ARRAY['Score de réputation d''au moins 70 sur 100', 'Solde du portefeuille : 2 000 FCFA par mois']
WHERE title = 'Assurance Santé Tontine';

UPDATE public.marketplace_services
SET provider = 'eganyé',
    requirements = ARRAY['Score de réputation d''au moins 70 sur 100', 'Avoir terminé un cercle complet']
WHERE title = 'Micro-crédit Agricole';

UPDATE public.marketplace_services
SET provider = 'Partenaire eganyé'
WHERE title = 'Kit Solaire PAYGO';

UPDATE public.marketplace_services
SET provider = 'Partenaire eganyé',
    description = 'Mettez de côté une partie de vos gains de tontine pour préparer votre retraite, avec un partenaire spécialisé. Les conditions vous sont présentées avant tout engagement.',
    action_label = 'Être contacté'
WHERE title = 'Épargne Retraite';

-- Filet : tout autre service encore nommé d'après une entreprise.
UPDATE public.marketplace_services
SET provider = 'Partenaire eganyé'
WHERE category <> 'credit'
  AND provider IS DISTINCT FROM 'Partenaire eganyé';
