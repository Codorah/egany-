-- ============================================================================
-- 0013 — ON NE S'INSCRIT PLUS SOI-MÊME COMME MEMBRE ACTIF D'UN CERCLE
-- ============================================================================
-- "group_members_insert_self" (0001, resserrée en KYC par la migration non
-- numérotée de schema.sql ligne 1091) n'a jamais contraint `status` ni
-- `payout_position`. Résultat : une utilisatrice vérifiée KYC pouvait, par un
-- simple insert client, s'ajouter en `active` à un cercle PRIVÉ dont elle n'a
-- jamais reçu le code d'invitation, et choisir elle-même sa `payout_position`
-- — par exemple en copiant `current_payout_index` pour se désigner
-- bénéficiaire du tour en cours.
--
-- Les deux seuls inserts légitimes faits par une utilisatrice sur elle-même
-- sont :
--   1. la demande d'adhésion (`requestToJoinGroup`, src/lib/groups.ts) :
--      status='pending', payout_position=null, validée ensuite par
--      l'organisatrice via assign_next_payout_position (SECURITY DEFINER,
--      déjà restreinte à is_group_creator/is_admin) ;
--   2. l'auto-inscription de la créatrice au moment même de la création du
--      cercle (CreateGroupDialog.tsx) : status='active', payout_position=0,
--      uniquement sur le cercle qu'elle vient de créer.
--
-- Toute autre combinaison (active avec une position, pending avec une
-- position, active sur un cercle dont on n'est pas la créatrice) passait
-- jusqu'ici sans contrôle : elle est désormais refusée par la policy.
-- ============================================================================

drop policy if exists "group_members_insert_self" on public.group_members;

create policy "group_members_insert_self" on public.group_members
  for insert with check (
    user_id = auth.uid()
    and public.is_kyc_verified()
    and (
      (status = 'pending' and payout_position is null)
      or (
        status = 'active'
        and payout_position = 0
        and exists (
          select 1 from public.groups g
          where g.id = group_id and g.creator_id = auth.uid()
        )
      )
    )
  );
