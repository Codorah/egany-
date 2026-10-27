-- Coup de pouce : prévenir TOUTE l'équipe admin.
--
-- Jusqu'ici, un dossier déposé (vidéo + frais d'étude payés) n'apparaissait
-- que dans l'onglet admin : aucun admin n'était prévenu, et le dossier
-- pouvait attendre des jours. N'importe quel admin peut déjà verser ou
-- refuser (grant/reject_aid_application vérifient is_admin() et verrouillent
-- la ligne : le premier qui décide l'emporte, le second reçoit « Ce dossier
-- a déjà été traité »).
--
-- Un trigger plutôt qu'une réécriture des trois fonctions : elles touchent à
-- l'argent, on n'y change rien.
--   - INSERT : chaque admin reçoit « Nouveau dossier Coup de pouce ».
--   - passage de 'submitted' à 'granted'/'rejected' : les AUTRES admins
--     apprennent qui a décidé, pour ne pas étudier une vidéo pour rien.

CREATE OR REPLACE FUNCTION public._notify_admins_aid_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_applicant text;
  v_reviewer text;
BEGIN
  SELECT coalesce(nullif(trim(display_name), ''), 'Un membre') INTO v_applicant
  FROM public.profiles WHERE id = NEW.user_id;
  v_applicant := coalesce(v_applicant, 'Un membre');

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT p.id,
           'Nouveau dossier Coup de pouce',
           v_applicant || ' demande ' || NEW.requested_amount || ' FCFA pour « ' || NEW.project_title
             || ' ». Vidéo à regarder dans Admin > Marketplace > Dossiers Coup de pouce.',
           'system'
    FROM public.profiles p
    WHERE p.role = 'admin' AND p.id <> NEW.user_id;

  ELSIF OLD.status = 'submitted' AND NEW.status IN ('granted', 'rejected') THEN
    SELECT coalesce(nullif(trim(display_name), ''), 'Un admin') INTO v_reviewer
    FROM public.profiles WHERE id = NEW.reviewed_by;
    v_reviewer := coalesce(v_reviewer, 'Un admin');

    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT p.id,
           'Dossier Coup de pouce traité',
           '« ' || NEW.project_title || ' » (' || v_applicant || ') : '
             || CASE WHEN NEW.status = 'granted'
                  THEN NEW.granted_amount || ' FCFA versés par ' || v_reviewer || '.'
                  ELSE 'refusé par ' || v_reviewer || '.' END,
           'system'
    FROM public.profiles p
    WHERE p.role = 'admin'
      AND p.id IS DISTINCT FROM NEW.reviewed_by
      AND p.id <> NEW.user_id;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public._notify_admins_aid_application() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS aid_applications_notify_admins ON public.aid_applications;
CREATE TRIGGER aid_applications_notify_admins
  AFTER INSERT OR UPDATE OF status ON public.aid_applications
  FOR EACH ROW EXECUTE FUNCTION public._notify_admins_aid_application();
