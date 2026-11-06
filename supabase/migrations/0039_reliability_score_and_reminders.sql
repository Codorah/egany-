-- ============================================================================
-- 0039 — Score de fiabilité et rappels de cotisation
-- ============================================================================
-- Score : régression logistique (scripts/reliability/train.mjs) qui estime le risque
-- que la prochaine cotisation soit en retard. Score = 100 x (1 - risque).
--
-- Règles de responsabilité, tenues ici et non dans l'interface :
--  - Seul le comportement de cotisation entre dans le calcul. Ni solde, ni montant,
--    ni genre, ni âge, ni lieu, ni langue, ni opérateur.
--  - Aucune décision automatique : ce score ne refuse rien. reputation_score, qui sert
--    à l'éligibilité, n'est pas touché.
--  - Moins de 3 cotisations échues : pas de score, pour ne pas juger sur trop peu.
--  - Visible seulement par la personne et par les admins, jamais par son cercle.
--  - Un retard dû à l'organisateur ne compte pas (preuve de paiement en attente de
--    validation). Une cotisation pas encore échue non plus.
--
-- Modèle de départ, entraîné sur des membres simulés : voir scripts/reliability/model.json.
-- ============================================================================

create table if not exists public.reliability_snapshots (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null default current_date,
  score integer not null check (score between 0 and 100),
  features jsonb not null,
  model_version text not null,
  computed_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.reliability_snapshots enable row level security;

drop policy if exists "reliability_select_own_or_admin" on public.reliability_snapshots;
create policy "reliability_select_own_or_admin" on public.reliability_snapshots
  for select using (user_id = auth.uid() or public.is_admin());

-- Coefficients générés par scripts/reliability/train.mjs : réentraîner remplace cette
-- seule fonction.
create or replace function public._reliability_model()
returns jsonb
language sql immutable set search_path = public
as $$ select '{"version":"depart-1","intercept":0.2394,"coefficients":{"on_time_rate":-2.1124,"recent_late_rate":0.9773,"open_late":0.3187,"experience":-0.0311,"late_after_payout":0.7264}}'::jsonb $$;

create or replace function public._reliability_compute(p_user_id uuid, p_save boolean)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_n integer;
  v_on_time integer;
  v_open integer;
  v_recent_late integer;
  v_recent_n integer;
  v_after integer;
  v_late_after integer;
  v_model jsonb := public._reliability_model();
  v_coef jsonb := v_model->'coefficients';
  v_features jsonb;
  v_z numeric;
  v_score integer;
  v_key text;
  v_factors jsonb := '{}'::jsonb;
  v_changes jsonb := '[]'::jsonb;
  v_previous record;
  v_has_previous boolean;
  v_ideal jsonb := jsonb_build_object(
    'on_time_rate', 1, 'recent_late_rate', 0, 'open_late', 0,
    'experience', ln(37), 'late_after_payout', 0
  );
begin
  with lines as (
    select
      c.date as due_at,
      (c.date::date + coalesce(g.grace_period, 0)) as limit_day,
      c.status,
      coalesce(c.penalty_applied, 0) as penalty,
      c.debited_at,
      exists (select 1 from public.payouts p
              where p.group_id = c.group_id and p.user_id = c.user_id and p.date < c.date) as after_payout
    from public.contributions c
    join public.groups g on g.id = c.group_id
    where c.user_id = p_user_id and c.status in ('paid', 'pending', 'late')
  ),
  due as (
    select l.*,
      (l.status <> 'paid'
       or l.penalty > 0
       or (l.debited_at is not null and l.debited_at::date > l.limit_day)) as is_late,
      row_number() over (order by l.due_at desc) as recency
    from lines l
    -- Une cotisation non payée mais pas encore échue ne compte pas.
    where l.status = 'paid' or l.limit_day < current_date
  )
  select
    count(*),
    count(*) filter (where not is_late),
    count(*) filter (where status <> 'paid'),
    count(*) filter (where recency <= 3 and is_late),
    count(*) filter (where recency <= 3),
    count(*) filter (where after_payout),
    count(*) filter (where after_payout and is_late)
  into v_n, v_on_time, v_open, v_recent_late, v_recent_n, v_after, v_late_after
  from due;

  if v_n < 3 then
    return jsonb_build_object('status', 'building', 'dueCount', v_n, 'needed', 3);
  end if;

  v_features := jsonb_build_object(
    'on_time_rate', round(v_on_time::numeric / v_n, 4),
    'recent_late_rate', round(v_recent_late::numeric / v_recent_n, 4),
    'open_late', v_open,
    'experience', round(ln(1 + least(v_n, 36))::numeric, 4),
    'late_after_payout', case when v_after > 0 then round(v_late_after::numeric / v_after, 4) else 0 end
  );

  v_z := (v_model->>'intercept')::numeric;
  for v_key in select jsonb_object_keys(v_coef) loop
    v_z := v_z + (v_coef->>v_key)::numeric * (v_features->>v_key)::numeric;
    -- Effet sur le risque par rapport à un parcours sans aucun retard. Positif = pénalise.
    v_factors := v_factors || jsonb_build_object(v_key, round(
      (v_coef->>v_key)::numeric * ((v_features->>v_key)::numeric - (v_ideal->>v_key)::numeric), 3));
  end loop;

  v_score := round(100 * (1 - 1 / (1 + exp(-v_z))));

  select * into v_previous from public.reliability_snapshots
   where user_id = p_user_id and day < current_date
   order by day desc limit 1;
  -- À garder tout de suite : FOUND change à chaque requête suivante.
  v_has_previous := found;

  if v_has_previous and v_previous.score <> v_score then
    for v_key in select jsonb_object_keys(v_coef) loop
      if (v_features->>v_key)::numeric <> (v_previous.features->>v_key)::numeric then
        v_changes := v_changes || jsonb_build_array(jsonb_build_object(
          'factor', v_key,
          'impact', round((v_coef->>v_key)::numeric * ((v_features->>v_key)::numeric - (v_previous.features->>v_key)::numeric), 3)
        ));
      end if;
    end loop;
  end if;

  if p_save then
    insert into public.reliability_snapshots (user_id, day, score, features, model_version)
    values (p_user_id, current_date, v_score, v_features, v_model->>'version')
    on conflict (user_id, day) do update
      set score = excluded.score, features = excluded.features,
          model_version = excluded.model_version, computed_at = now();
    -- On ne garde pas plus que nécessaire pour expliquer les variations.
    delete from public.reliability_snapshots
     where user_id = p_user_id and day < current_date - 400;
  end if;

  return jsonb_build_object(
    'status', 'ready',
    'score', v_score,
    'modelVersion', v_model->>'version',
    'dueCount', v_n,
    'onTimeCount', v_on_time,
    'openLate', v_open,
    'recentLate', v_recent_late,
    'recentCount', v_recent_n,
    'afterPayoutCount', v_after,
    'lateAfterPayout', v_late_after,
    'factors', v_factors,
    'previousScore', case when v_has_previous then v_previous.score end,
    'previousDay', case when v_has_previous then v_previous.day end,
    'changes', v_changes
  );
end;
$$;

revoke all on function public._reliability_compute(uuid, boolean) from public, anon, authenticated;

create or replace function public.get_my_reliability()
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'error', 'message', 'Connexion requise.');
  end if;
  return public._reliability_compute(auth.uid(), true);
end;
$$;

revoke all on function public.get_my_reliability() from public, anon;
grant execute on function public.get_my_reliability() to authenticated;

-- Lecture par un admin : ne crée pas de point dans l'historique de la personne, sinon sa
-- prochaine explication comparerait à une date qu'elle n'a jamais vue.
create or replace function public.admin_member_reliability(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('status', 'error', 'message', 'Réservé aux administrateurs.');
  end if;
  return public._reliability_compute(p_user_id, false);
end;
$$;

revoke all on function public.admin_member_reliability(uuid) from public, anon;
grant execute on function public.admin_member_reliability(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- Rappels de cotisation
-- ----------------------------------------------------------------------------
-- Le prélèvement automatique passe toutes les 15 minutes : une cotisation encore due
-- veut donc dire que le solde ne suffit pas. Le rappel dit combien il manque. Il part
-- du serveur, donc même si la personne n'ouvre pas l'application.
create table if not exists public.contribution_reminders_sent (
  contribution_id uuid not null references public.contributions(id) on delete cascade,
  stage text not null check (stage in ('before_3', 'before_1', 'after_1')),
  sent_at timestamptz not null default now(),
  primary key (contribution_id, stage)
);

alter table public.contribution_reminders_sent enable row level security;

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
      and c.date::date between current_date - 7 and current_date + 3
  loop
    v_days := v_row.due_day - current_date;
    v_stage := case
      when v_days between 2 and 3 then 'before_3'
      when v_days between 0 and 1 then 'before_1'
      when v_days < 0 then 'after_1'
    end;
    continue when v_stage is null;

    v_due := v_row.amount + case when v_row.penalty_status = 'pending' then v_row.penalty else 0 end;
    v_missing := v_due - v_row.wallet_balance;
    -- Solde suffisant : le prélèvement s'en charge, inutile de déranger.
    continue when v_missing <= 0;

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

do $$
begin
  if exists (select 1 from cron.job where jobname = 'send-contribution-reminders') then
    perform cron.unschedule('send-contribution-reminders');
  end if;
  -- 8 h à Lomé (UTC).
  perform cron.schedule('send-contribution-reminders', '0 8 * * *', 'select public.send_contribution_reminders()');
end;
$$;
