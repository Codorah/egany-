-- ============================================================================
-- 0033 — Code PIN : les fonctions retrouvent enfin pgcrypto
-- ============================================================================
-- Sur Supabase, l'extension pgcrypto vit dans le schéma "extensions". Or
-- set_user_pin et verify_user_pin fixaient search_path = public : crypt() et
-- gen_salt() restaient introuvables, d'où « function gen_salt(unknown) does
-- not exist » à chaque création, changement ou vérification du PIN.
-- On ajoute "extensions" au search_path de ces deux fonctions.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_user_pin(p_user_id uuid, p_new_pin text)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Non autorisé.';
  end if;

  if p_new_pin !~ '^[0-9]{4}$' then
    raise exception 'Le code PIN doit comporter exactement 4 chiffres.';
  end if;

  perform set_config('eganye.allow_pin_hash_write', 'on', true);

  update public.profiles
  set security_pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf')),
      pin_failed_attempts = 0,
      pin_locked_until = null
  where id = p_user_id;
end;
$$;

grant execute on function public.set_user_pin(uuid, text) to authenticated;

create or replace function public.verify_user_pin(p_user_id uuid, p_entered_pin text)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_hash text;
  v_locked_until timestamptz;
  v_attempts integer;
  v_max_attempts constant integer := 5;
  v_lockout_minutes constant integer := 15;
begin
  if auth.uid() is distinct from p_user_id then
    return jsonb_build_object('ok', false, 'locked', false, 'message', 'Non autorisé.');
  end if;

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

  -- Aucun PIN défini : le code par défaut est 0000 (annoncé dans l'appli).
  if v_hash is null then
    v_hash := extensions.crypt('0000', extensions.gen_salt('bf'));
  end if;

  if extensions.crypt(p_entered_pin, v_hash) = v_hash then
    update public.profiles set pin_failed_attempts = 0, pin_locked_until = null where id = p_user_id;
    return jsonb_build_object('ok', true, 'locked', false, 'message', 'Code PIN valide.');
  end if;

  v_attempts := coalesce(v_attempts, 0) + 1;

  if v_attempts >= v_max_attempts then
    update public.profiles set pin_failed_attempts = 0, pin_locked_until = now() + (v_lockout_minutes || ' minutes')::interval
    where id = p_user_id;

    insert into public.audit_logs (user_id, action, details, ip, device, status)
    values (p_user_id, 'withdrawal_pin_locked', 'Trop de tentatives de code PIN incorrectes — retraits bloqués 15 minutes.', 'non disponible', 'Navigateur', 'failure');

    return jsonb_build_object('ok', false, 'locked', true, 'remainingAttempts', 0, 'message', 'Trop de tentatives incorrectes. Les retraits sont bloqués pendant 15 minutes.');
  end if;

  update public.profiles set pin_failed_attempts = v_attempts where id = p_user_id;

  insert into public.audit_logs (user_id, action, details, ip, device, status)
  values (p_user_id, 'withdrawal_failed_pin', 'Tentative de retrait avec un code PIN erroné (' || (v_max_attempts - v_attempts) || ' tentative(s) restante(s)).', 'non disponible', 'Navigateur', 'failure');

  return jsonb_build_object(
    'ok', false, 'locked', false, 'remainingAttempts', v_max_attempts - v_attempts,
    'message', 'Code PIN incorrect. ' || (v_max_attempts - v_attempts) || ' tentative(s) restante(s).'
  );
end;
$$;
