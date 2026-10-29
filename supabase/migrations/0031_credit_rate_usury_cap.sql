-- ============================================================================
-- 0031 — MICROCRÉDIT : TAUX PLAFONNÉ SOUS LE TAUX D'USURE UEMOA
-- ============================================================================
-- Jusqu'ici une offre pouvait aller jusqu'à 3 % par mois en intérêt simple
-- (36 % par an affichés). Remboursé par mensualités, cela fait un coût réel
-- (TEG) d'environ 60 % par an. Le taux d'usure de la microfinance (SFD) dans
-- l'UEMOA est de 24 % par an, et il porte sur le TEG.
--
-- Nouveau plafond : 13 % par an en intérêt simple (taux total ≤ 13 × mois / 12,
-- et ≤ 24 % comme avant). Le TEG reste alors au plus vers 23,4 %. Taux
-- conseillé dans l'écran admin : 1 % par mois (TEG ≈ 18 à 21 %).
--
-- Seule la vérification du taux change ; le reste de la fonction est repris
-- tel quel de 0026. Les offres déjà faites ne sont pas modifiées.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.make_credit_offer(
  p_application_id uuid,
  p_offered_amount numeric,
  p_interest_rate numeric,
  p_duration_months integer,
  p_admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_app record;
  v_total numeric;
  v_max_rate numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Non autorisé.');
  END IF;
  IF p_offered_amount IS NULL OR p_offered_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le montant offert doit être supérieur à zéro.');
  END IF;
  IF p_duration_months IS NULL OR p_duration_months < 3 OR p_duration_months > 24 THEN
    RETURN jsonb_build_object('success', false, 'message', 'La durée doit être comprise entre 3 et 24 mois.');
  END IF;

  v_max_rate := least(24, floor(13.0 * p_duration_months / 12 * 100) / 100);
  IF p_interest_rate IS NULL OR p_interest_rate < 0 OR p_interest_rate > v_max_rate THEN
    RETURN jsonb_build_object('success', false, 'message',
      'Pour ' || p_duration_months || ' mois, le taux doit être compris entre 0 et ' || v_max_rate
        || ' % (13 % par an au plus en intérêt simple, pour rester sous le taux d''usure de 24 %).');
  END IF;

  SELECT * INTO v_app FROM public.credit_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Dossier introuvable.');
  END IF;
  IF v_app.status <> 'submitted' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce dossier a déjà été traité.');
  END IF;

  v_total := round(p_offered_amount) + round(round(p_offered_amount) * p_interest_rate / 100);

  UPDATE public.credit_applications SET
    status = 'offered',
    offered_amount = round(p_offered_amount),
    interest_rate = p_interest_rate,
    duration_months = p_duration_months,
    total_due = v_total,
    admin_notes = p_admin_notes,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    offered_at = now(),
    updated_at = now()
  WHERE id = p_application_id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_app.user_id, 'Une offre de crédit vous attend',
          'Pour « ' || v_app.project_title || ' » : ' || round(p_offered_amount) || ' FCFA, à rembourser ' || v_total
            || ' FCFA en ' || p_duration_months || ' mois. Ouvrez Services annexes pour l''accepter ou la refuser.',
          'system');

  RETURN jsonb_build_object('success', true, 'message', 'Offre envoyée.', 'totalDue', v_total);
END;
$$;
