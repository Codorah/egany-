-- ============================================================================
-- 0040 — Le modèle de fiabilité au travail
-- ============================================================================
-- Trois usages de plus pour le modèle de 0039, tous à conséquence douce :
--  1. Une estimation pour tout le cercle, en trois niveaux. Jamais de score individuel
--     ni de nom, et rien sous 4 membres scorés : dans un petit cercle, on devinerait
--     les personnes.
--  2. Une liste pour l'équipe : qui contacter d'abord. Aucune action automatique.
--  3. Un rappel de plus, à 5 jours de l'échéance, quand le score est sous 60. Jamais
--     de pénalité, jamais de refus.
--
-- Le modèle reste entraîné sur des données simulées et ne décide rien. Lire ces
-- données ne crée aucun point dans l'historique du score des personnes.
-- À exécuter après 0039.
-- ============================================================================

create or replace function public.get_circle_health(p_group_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_member record;
  v_result jsonb;
  v_total numeric := 0;
  v_count integer := 0;
  v_mean numeric;
begin
  if auth.uid() is null or not (public.is_group_member(p_group_id) or public.is_admin()) then
    return jsonb_build_object('status', 'error');
  end if;

  for v_member in
    select user_id from public.group_members where group_id = p_group_id and status = 'active'
  loop
    v_result := public._reliability_compute(v_member.user_id, false);
    if v_result->>'status' = 'ready' then
      v_total := v_total + (v_result->>'score')::numeric;
      v_count := v_count + 1;
    end if;
  end loop;

  if v_count < 4 then
    return jsonb_build_object('status', 'not_enough');
  end if;

  v_mean := v_total / v_count;
  return jsonb_build_object(
    'status', 'ok',
    'level', case when v_mean >= 75 then 'low' when v_mean >= 55 then 'medium' else 'high' end
  );
end;
$$;

revoke all on function public.get_circle_health(uuid) from public, anon;
grant execute on function public.get_circle_health(uuid) to authenticated;

create or replace function public.admin_reliability_overview()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_profile record;
  v_result jsonb;
  v_members jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    return jsonb_build_object('status', 'error', 'message', 'Réservé aux administrateurs.');
  end if;

  for v_profile in
    select p.id, p.display_name, p.email, p.phone
    from public.profiles p
    where exists (select 1 from public.contributions c where c.user_id = p.id)
  loop
    v_result := public._reliability_compute(v_profile.id, false);
    if v_result->>'status' = 'ready'
       and ((v_result->>'score')::integer < 60 or (v_result->>'openLate')::integer > 0) then
      v_members := v_members || jsonb_build_array(jsonb_build_object(
        'userId', v_profile.id,
        'name', coalesce(v_profile.display_name, 'Sans nom'),
        'email', v_profile.email,
        'phone', v_profile.phone,
        'score', (v_result->>'score')::integer,
        'openLate', (v_result->>'openLate')::integer
      ));
    end if;
  end loop;

  return jsonb_build_object('status', 'ok', 'members', coalesce((
    select jsonb_agg(m order by (m->>'openLate')::integer desc, (m->>'score')::integer asc)
    from jsonb_array_elements(v_members) m
  ), '[]'::jsonb));
end;
$$;

revoke all on function public.admin_reliability_overview() from public, anon;
grant execute on function public.admin_reliability_overview() to authenticated;

alter table public.contribution_reminders_sent
  drop constraint if exists contribution_reminders_sent_stage_check;
alter table public.contribution_reminders_sent
  add constraint contribution_reminders_sent_stage_check
  check (stage in ('before_5', 'before_3', 'before_1', 'after_1'));

create or replace function public.send_contribution_reminders()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_row record;
  v_stage text;
  v_days integer;
  v_due numeric;
  v_missing numeric;
  v_when text;
  v_reliability jsonb;
  v_sent integer := 0;
begin
  for v_row in
    select c.id, c.user_id, c.group_id, c.amount, c.date::date as due_day,
           coalesce(c.penalty_applied, 0) as penalty, c.penalty_status,
           g.name as group_name, g.currency, p.wallet_balance
    from public.contributions c
    join public.groups g on g.id = c.group_id and g.status = 'active'
    join public.profiles p on p.id = c.user_id
    where c.status in ('pending', 'late')
      and c.date::date between current_date - 7 and current_date + 5
  loop
    v_days := v_row.due_day - current_date;
    v_stage := case
      when v_days between 4 and 5 then 'before_5'
      when v_days between 2 and 3 then 'before_3'
      when v_days between 0 and 1 then 'before_1'
      when v_days < 0 then 'after_1'
    end;
    continue when v_stage is null;

    v_due := v_row.amount + case when v_row.penalty_status = 'pending' then v_row.penalty else 0 end;
    v_missing := v_due - v_row.wallet_balance;
    -- Solde suffisant : le prélèvement s'en charge, inutile de déranger.
    continue when v_missing <= 0;

    -- Le rappel en avance est réservé aux scores sous 60, calculés (pas d'historique
    -- trop court). Calculé en dernier : c'est l'étape la plus coûteuse.
    if v_stage = 'before_5' then
      v_reliability := public._reliability_compute(v_row.user_id, false);
      continue when v_reliability->>'status' <> 'ready' or (v_reliability->>'score')::integer >= 60;
    end if;

    insert into public.contribution_reminders_sent (contribution_id, stage)
    values (v_row.id, v_stage)
    on conflict do nothing;
    continue when not found;

    v_when := case
      when v_days < 0 then 'était attendue le ' || to_char(v_row.due_day, 'DD/MM')
      when v_days = 0 then 'est attendue aujourd''hui'
      when v_days = 1 then 'est attendue demain'
      else 'est attendue le ' || to_char(v_row.due_day, 'DD/MM')
    end;

    insert into public.notifications (user_id, title, message, type, link)
    values (v_row.user_id, 'Cotisation ' || v_row.group_name,
      'Votre cotisation de ' || v_due || ' ' || v_row.currency || ' ' || v_when
        || '. Il manque ' || v_missing || ' ' || v_row.currency || ' sur votre portefeuille : rechargez pour qu''elle parte automatiquement.',
      'reminder', '/group/' || v_row.group_id);
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end;
$$;

revoke all on function public.send_contribution_reminders() from public, anon, authenticated;
