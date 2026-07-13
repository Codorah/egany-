-- verify_user_pin doit journaliser ses échecs dans audit_logs, mais un
-- utilisateur non-admin n'a plus le droit d'y écrire directement (0002).
-- On déplace donc l'écriture d'audit à l'intérieur de la fonction
-- SECURITY DEFINER elle-même (comme pour les 2 autres fonctions financières).
create or replace function public.verify_user_pin(p_user_id uuid, p_entered_pin text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_hash text;
  v_locked_until timestamptz;
  v_attempts integer;
  v_max_attempts constant integer := 5;
  v_lockout_minutes constant integer := 15;
begin
  select security_pin_hash, pin_locked_until, pin_failed_attempts
  into v_hash, v_locked_until, v_attempts
  from public.profiles where id = p_user_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'locked', false, 'message', 'Utilisateur introuvable.');
  end if;

  if v_locked_until is not null and v_locked_until > now() then
    return jsonb_build_object(
      'ok', false, 'locked', true, 'lockedUntil', v_locked_until,
      'message', 'Trop de tentatives échouées. Réessayez après ' || to_char(v_locked_until, 'HH24:MI') || '.'
    );
  end if;

  if v_hash is null then
    v_hash := crypt('0000', gen_salt('bf'));
  end if;

  if crypt(p_entered_pin, v_hash) = v_hash then
    update public.profiles set pin_failed_attempts = 0, pin_locked_until = null where id = p_user_id;
    return jsonb_build_object('ok', true, 'locked', false, 'message', 'Code PIN valide.');
  end if;

  v_attempts := coalesce(v_attempts, 0) + 1;

  if v_attempts >= v_max_attempts then
    update public.profiles set pin_failed_attempts = 0, pin_locked_until = now() + (v_lockout_minutes || ' minutes')::interval
    where id = p_user_id;

    insert into public.audit_logs (user_id, action, details, ip, device, status)
    values (p_user_id, 'withdrawal_pin_locked', 'Trop de tentatives de code PIN incorrectes — retraits bloqués 15 minutes.', '197.234.34.82', 'Navigateur', 'failure');

    return jsonb_build_object('ok', false, 'locked', true, 'remainingAttempts', 0, 'message', 'Trop de tentatives incorrectes. Les retraits sont bloqués pendant 15 minutes.');
  end if;

  update public.profiles set pin_failed_attempts = v_attempts where id = p_user_id;

  insert into public.audit_logs (user_id, action, details, ip, device, status)
  values (p_user_id, 'withdrawal_failed_pin', 'Tentative de retrait avec un code PIN erroné (' || (v_max_attempts - v_attempts) || ' tentative(s) restante(s)).', '197.234.34.82', 'Navigateur', 'failure');

  return jsonb_build_object(
    'ok', false, 'locked', false, 'remainingAttempts', v_max_attempts - v_attempts,
    'message', 'Code PIN incorrect. ' || (v_max_attempts - v_attempts) || ' tentative(s) restante(s).'
  );
end;
$$;
