-- Contrôle en lecture seule : ces failles ont-elles déjà servi ?
-- À exécuter dans l'éditeur SQL de Supabase. Ne modifie rien.
-- Chaque ligne est à vérifier, ce n'est pas une preuve de fraude à elle seule.

-- 1. Cercles qui ont versé sur des portefeuilles plus que ce qu'ils ont reçu des
--    portefeuilles : cet argent n'est jamais entré sur la plateforme.
select
  'cercle verse plus que recu' as controle,
  g.id::text as reference,
  g.name as detail,
  coalesce(sum(case when l.type = 'credit' and l.counterparty like 'user_wallet:%' then l.amount end), 0) as entre_fcfa,
  coalesce(sum(case when l.type = 'debit' and (l.counterparty like 'user_wallet:%' or l.counterparty like 'platform_wallet:%') then l.amount end), 0) as sorti_fcfa
from public.groups g
join public.double_entry_ledger l on l.account = 'tontine_group:' || g.id
group by g.id, g.name
having coalesce(sum(case when l.type = 'debit' and (l.counterparty like 'user_wallet:%' or l.counterparty like 'platform_wallet:%') then l.amount end), 0)
     > coalesce(sum(case when l.type = 'credit' and l.counterparty like 'user_wallet:%' then l.amount end), 0)

union all

-- 2. Membres qui ont reçu un versement plus souvent que d'autres membres du cercle.
select
  'membre servi plusieurs fois',
  s.group_id::text,
  s.user_id::text,
  s.recus,
  s.minimum
from (
  select gm.group_id, gm.user_id, count(p.id) as recus,
         min(count(p.id)) over (partition by gm.group_id) as minimum
  from public.group_members gm
  left join public.payouts p on p.group_id = gm.group_id and p.user_id = gm.user_id
  where gm.status = 'active'
  group by gm.group_id, gm.user_id
) s
where s.recus > s.minimum + 1

union all

-- 3. Cotisations payées pour un montant inférieur à celui du cercle.
select
  'cotisation inferieure au cercle',
  c.id::text,
  g.name,
  c.amount,
  g.contribution_amount
from public.contributions c
join public.groups g on g.id = c.group_id
where c.status = 'paid' and c.amount < g.contribution_amount

union all

-- 4. Soldes qui ne correspondent pas au registre. Un écart vient d'un ancien
--    « Ajuster » ou d'une écriture directe.
select
  'solde different du registre',
  p.id::text,
  p.display_name,
  p.wallet_balance,
  coalesce(sum(case when l.type = 'credit' then l.amount else -l.amount end), 0)
from public.profiles p
left join public.double_entry_ledger l on l.account = 'user_wallet:' || p.id
group by p.id, p.display_name, p.wallet_balance
having p.wallet_balance <> coalesce(sum(case when l.type = 'credit' then l.amount else -l.amount end), 0)

order by 1, 4 desc;
