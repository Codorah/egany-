-- ============================================================================
-- 0014 — verify_user_pin : on ne devine plus le PIN d'une autre utilisatrice
-- ============================================================================
-- La fonction (SECURITY DEFINER) prenait p_user_id en paramètre libre sans
-- jamais le comparer à auth.uid(), contrairement à set_user_pin qui le fait
-- déjà. N'importe quel compte connecté pouvait donc appeler ce RPC avec
-- l'identifiant d'une autre personne pour :
--   - tenter de deviner son PIN de retrait à 4 chiffres (lent : 5 essais puis
--     verrou de 15 minutes, mais pas nul) ;
--   - ou simplement verrouiller à volonté les retraits de la victime, en
--     épuisant ses tentatives sans même connaître le bon code (déni de
--     service collatéral).
-- ============================================================================

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
