-- Le PIN de retrait doit rester haché (pgcrypto) en toute circonstance — y
-- compris quand l'utilisateur le change depuis son Profil. La policy
-- "profiles_update_self_or_admin" (0001) autorise un UPDATE direct sur sa
-- propre ligne profiles pour les préférences (langue, thème, avatar...), ce
-- qui permettrait sinon d'écrire security_pin_hash en texte clair depuis le
-- client. On ajoute donc :
--   1. set_user_pin(...) : seule voie autorisée pour hacher et enregistrer un
--      nouveau PIN.
--   2. un trigger qui bloque toute autre écriture de security_pin_hash,
--      même via un UPDATE direct sur profiles.

create or replace function public.set_user_pin(p_user_id uuid, p_new_pin text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() <> p_user_id then
    raise exception 'Non autorisé.';
  end if;

  if p_new_pin !~ '^[0-9]{4}$' then
    raise exception 'Le code PIN doit comporter exactement 4 chiffres.';
  end if;

  perform set_config('eganye.allow_pin_hash_write', 'on', true);

  update public.profiles
  set security_pin_hash = crypt(p_new_pin, gen_salt('bf')),
      pin_failed_attempts = 0,
      pin_locked_until = null
  where id = p_user_id;
end;
$$;

grant execute on function public.set_user_pin(uuid, text) to authenticated;

create or replace function public.prevent_direct_pin_hash_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.security_pin_hash is distinct from old.security_pin_hash
     and coalesce(current_setting('eganye.allow_pin_hash_write', true), 'off') <> 'on' then
    raise exception 'Le code PIN ne peut être modifié que via set_user_pin().';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_direct_pin_hash_change
  before update on public.profiles
  for each row execute function public.prevent_direct_pin_hash_change();
