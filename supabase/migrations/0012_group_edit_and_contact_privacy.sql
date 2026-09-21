-- ============================================================================
-- 0012 — QUI PEUT MODIFIER UN CERCLE, ET QUI PEUT VOIR VOS COORDONNÉES
-- ============================================================================
--   1. `groups_update_creator_member_or_admin` accordait l'écriture à TOUT
--      membre actif du cercle, sur la ligne entière. Le commentaire d'origine
--      l'explique : il fallait permettre d'écrire `last_reminder_period`.
--      Mais une policy porte sur la ligne, pas sur une colonne — n'importe
--      quel membre pouvait donc changer le montant de la cotisation, la date
--      du prochain tour, le bénéficiaire tiré, ou clore le cercle.
--
--      L'écriture du jeton de rappel passe désormais par une fonction dédiée
--      qui ne touche que cette colonne.
--
--   2. `profiles_select_all` ouvrait chaque ligne de profil à toute personne
--      connectée : adresse e-mail, téléphone, date de naissance, nom civil de
--      tous les comptes. Dans un produit où des inconnues se retrouvent dans
--      un même cercle, c'est un annuaire de harcèlement — et un fichier de
--      contacts prêt à l'emploi pour qui voudrait démarcher ou arnaquer.
--
--      La table n'est plus lisible que pour soi-même (et les administrateurs).
--      Ce dont l'application a réellement besoin pour afficher une liste de
--      membres — un nom, un avatar, une réputation — passe par une vue qui
--      n'expose que cela.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Le cercle ne se modifie que par son organisatrice
-- ----------------------------------------------------------------------------
drop policy if exists "groups_update_creator_member_or_admin" on public.groups;
drop policy if exists "groups_update_creator_or_admin" on public.groups;

create policy "groups_update_creator_or_admin" on public.groups
  for update using (creator_id = auth.uid() or public.is_admin());

-- Le rappel d'échéance est envoyé par le premier appareil qui constate que la
-- date approche ; le jeton de période sert à ce qu'un seul le fasse. C'est
-- donc bien une écriture de membre — mais limitée à cette colonne.
--
-- Le `where` porte aussi sur la valeur actuelle : deux téléphones qui
-- réveillent l'application en même temps ne peuvent pas réclamer la même
-- période tous les deux. Celui qui perd reçoit `false` et n'envoie rien.
create or replace function public.claim_reminder_period(p_group_id uuid, p_period text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_claimed integer;
begin
  if not public.is_group_member(p_group_id) then
    return false;
  end if;

  update public.groups
     set last_reminder_period = p_period, updated_at = now()
   where id = p_group_id
     and status = 'active'
     and last_reminder_period is distinct from p_period;

  get diagnostics v_claimed = row_count;
  return v_claimed > 0;
end;
$$;

revoke all on function public.claim_reminder_period(uuid, text) from public, anon;
grant execute on function public.claim_reminder_period(uuid, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 2. Les coordonnées ne sortent plus de la base
-- ----------------------------------------------------------------------------
drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "profiles_select_self_or_admin" on public.profiles;

create policy "profiles_select_self_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

-- Ce que l'application montre légitimement d'une autre personne : de quoi la
-- reconnaître dans une liste de membres, et rien de plus. Pas d'adresse, pas
-- de téléphone, pas de date de naissance, pas de nom civil.
--
-- Une vue s'exécute avec les droits de son propriétaire et contourne donc la
-- policy ci-dessus — c'est précisément ce qu'on veut : elle sert de guichet
-- étroit, et c'est le choix des colonnes qui fait la protection.
create or replace view public.member_profiles as
  select id, display_name, avatar_config, avatar_url, reputation_score, kyc_level
  from public.profiles;

revoke all on public.member_profiles from public, anon;
grant select on public.member_profiles to authenticated;

comment on view public.member_profiles is
  'Champs publics d''un profil, pour les listes de membres. La table profiles n''est lisible que par son propriétaire et les administrateurs (0012).';
