-- ============================================================================
-- 0011 — COLONNES PRIVILÉGIÉES, COTISATIONS ET NOTIFICATIONS
-- ============================================================================
-- Revue de sécurité de la plateforme. Trois failles exploitables en une
-- requête depuis n'importe quel compte connecté.
--
--   1. LA PLUS GRAVE — `profiles_update_self_or_admin` autorise une
--      utilisatrice à modifier sa propre ligne, sans aucune restriction de
--      colonne. Or `wallet_balance` est une colonne de cette table :
--
--          supabase.from('profiles')
--            .update({ wallet_balance: 99999999 })
--            .eq('id', <son propre id>)
--
--      Tout le durcissement des migrations 0005 et 0010 sur
--      execute_financial_transaction ne servait donc à rien : il gardait la
--      porte pendant que la fenêtre restait ouverte. La migration 0004 avait
--      déjà identifié ce risque pour security_pin_hash et posé un déclencheur
--      dédié — mais uniquement pour cette colonne-là.
--
--      Même mécanisme pour `kyc_level` : les policies d'insertion de groupes
--      exigent is_kyc_verified(), qu'il suffisait de s'auto-attribuer pour
--      contourner la vérification d'identité.
--
--   2. Sur `contributions`, la policy était en ALL pour tout membre du
--      cercle. N'importe quel membre pouvait donc marquer sa propre
--      cotisation `paid` sans payer, ou modifier celles des autres.
--
--   3. `notifications_insert_authenticated` ne vérifiait que le fait d'être
--      connecté, pas le destinataire : on pouvait écrire une notification
--      dans l'application de n'importe qui. Dans un produit d'argent, c'est
--      un canal d'hameçonnage prêt à l'emploi (« votre compte est bloqué,
--      appelez ce numéro »), avec l'autorité visuelle de l'application.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Colonnes privilégiées de `profiles`
-- ----------------------------------------------------------------------------
-- On garde la policy telle quelle (l'utilisatrice doit pouvoir changer son
-- nom, sa langue, son avatar…) et on interdit au niveau du déclencheur les
-- seules colonnes qui donnent de l'argent, des droits ou un statut.
--
-- Comment distinguer une écriture légitime ? Par le rôle effectif, et non
-- par un drapeau applicatif : les fonctions qui déplacent l'argent sont en
-- SECURITY DEFINER et appartiennent à `postgres`, donc `current_user` y vaut
-- 'postgres' ; le webhook du prestataire écrit en 'service_role' ; une
-- requête PostgREST venue du navigateur, elle, s'exécute toujours en
-- 'authenticated'. C'est un signal que l'appelant ne peut pas falsifier, et
-- il évite de réécrire les trois fonctions d'argent pour y poser un drapeau.
create or replace function public.prevent_privileged_profile_changes()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_allowed boolean := current_user not in ('authenticated', 'anon');
begin
  -- Un administrateur ajuste légitimement un solde ou une réputation depuis
  -- le panneau d'administration ; la traçabilité de ce geste est traitée
  -- séparément (voir la revue : ces écritures ne passent pas par le grand
  -- livre et échappent donc à la réconciliation).
  if v_allowed or public.is_admin() then
    return new;
  end if;

  if new.wallet_balance is distinct from old.wallet_balance
     or new.total_saved is distinct from old.total_saved
     or new.reputation_score is distinct from old.reputation_score
     or new.groups_joined is distinct from old.groups_joined
     or new.kyc_level is distinct from old.kyc_level
     or new.kyc_verified_at is distinct from old.kyc_verified_at
     or new.bank_tier is distinct from old.bank_tier
     or new.bank_subscription_expires_at is distinct from old.bank_subscription_expires_at
     or new.subscription_plan is distinct from old.subscription_plan
     or new.subscription_expires_at is distinct from old.subscription_expires_at
     -- Sans ces deux-là, le verrouillage après échecs de PIN se remet à zéro
     -- d'une requête : la protection contre l'essai systématique des 10 000
     -- combinaisons à quatre chiffres n'existerait plus.
     or new.pin_failed_attempts is distinct from old.pin_failed_attempts
     or new.pin_locked_until is distinct from old.pin_locked_until
  then
    raise exception 'Ces informations ne peuvent pas être modifiées directement.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_privileged_profile_changes on public.profiles;
create trigger trg_prevent_privileged_profile_changes
  before update on public.profiles
  for each row execute function public.prevent_privileged_profile_changes();


-- ----------------------------------------------------------------------------
-- 2. Le hachage du PIN n'est plus lisible par les autres
-- ----------------------------------------------------------------------------
-- `profiles_select_all` ouvre la table entière à toute personne connectée,
-- security_pin_hash compris. Un PIN à quatre chiffres n'a que 10 000
-- valeurs possibles : disposer du hachage, c'est disposer du PIN après
-- quelques secondes de calcul hors ligne.
--
-- RLS filtre les lignes, pas les colonnes — d'où ce retrait de privilège au
-- niveau colonne, qui se combine avec la policy existante.
revoke select (security_pin_hash, pin_failed_attempts, pin_locked_until, fcm_token)
  on public.profiles from authenticated, anon;


-- ----------------------------------------------------------------------------
-- 3. Cotisations : on ne se déclare pas payé soi-même
-- ----------------------------------------------------------------------------
drop policy if exists "contributions_all_group_member_or_admin" on public.contributions;

-- Lecture : inchangée, tout membre du cercle voit les cotisations de tous
-- (c'est le principe même d'une tontine — la transparence fait la confiance).
create policy "contributions_select_group_member_or_admin" on public.contributions
  for select using (public.is_group_member(group_id) or public.is_admin());

-- Création et suppression : l'organisatrice du cercle, ou un administrateur.
create policy "contributions_insert_creator_or_admin" on public.contributions
  for insert with check (public.is_group_creator(group_id) or public.is_admin());

create policy "contributions_delete_creator_or_admin" on public.contributions
  for delete using (public.is_group_creator(group_id) or public.is_admin());

-- Modification : l'organisatrice, un administrateur, ou la personne concernée
-- — cette dernière uniquement pour déclarer un paiement en attente de
-- validation (voir le déclencheur ci-dessous).
create policy "contributions_update_owner_creator_or_admin" on public.contributions
  for update using (
    public.is_group_creator(group_id) or public.is_admin() or user_id = auth.uid()
  );

create or replace function public.prevent_self_settling_contribution()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  -- Même raisonnement qu'au point 1 : execute_financial_transaction solde la
  -- cotisation en SECURITY DEFINER, donc en 'postgres'.
  v_allowed boolean := current_user not in ('authenticated', 'anon');
begin
  if v_allowed or public.is_group_creator(new.group_id) or public.is_admin() then
    return new;
  end if;

  -- Déclarer un virement effectué reste possible : c'est `pending_approval`,
  -- qui attend précisément la validation de l'organisatrice. Ce qui est
  -- interdit, c'est de se solder soi-même.
  if (new.status = 'paid' and old.status is distinct from 'paid')
     or (new.penalty_status = 'paid' and old.penalty_status is distinct from 'paid')
  then
    raise exception 'Seule l''organisatrice du cercle peut valider un paiement.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_self_settling_contribution on public.contributions;
create trigger trg_prevent_self_settling_contribution
  before update on public.contributions
  for each row execute function public.prevent_self_settling_contribution();


-- ----------------------------------------------------------------------------
-- 4. Notifications : seulement à soi-même, à ses co-membres, ou en admin
-- ----------------------------------------------------------------------------
-- Les envois légitimes vers autrui passent tous par un cercle partagé :
-- rappel de cotisation, arrivée d'un membre, distribution. Cette fonction
-- décrit exactement ce périmètre.
create or replace function public.shares_group_with(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on b.group_id = a.group_id
    where a.user_id = auth.uid()
      and b.user_id = p_user_id
      and a.status = 'active'
      and b.status = 'active'
  );
$$;

grant execute on function public.shares_group_with(uuid) to authenticated;

drop policy if exists "notifications_insert_authenticated" on public.notifications;
create policy "notifications_insert_self_or_co_member" on public.notifications
  for insert with check (
    user_id = auth.uid() or public.is_admin() or public.shares_group_with(user_id)
  );


-- ----------------------------------------------------------------------------
-- 5. Le prélèvement automatique solde la pénalité côté serveur
-- ----------------------------------------------------------------------------
-- useWalletDebitor marquait `penalty_status = 'paid'` par une requête client
-- juste après le débit — ce que le déclencheur du point 3 refuse désormais,
-- et à raison : cette écriture attestait d'un paiement sans preuve. Elle
-- rejoint donc la transaction qui encaisse réellement l'argent.
create or replace function public.settle_contribution_penalty(p_contribution_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  -- Ne solde que si la cotisation vient d'être payée : la pénalité suit le
  -- sort de la cotisation, elle ne s'efface pas toute seule.
  update public.contributions
     set penalty_status = 'paid', updated_at = now()
   where id = p_contribution_id
     and status = 'paid'
     and penalty_status = 'pending'
     and (user_id = auth.uid() or public.is_group_creator(group_id) or public.is_admin());
end;
$$;

revoke all on function public.settle_contribution_penalty(uuid) from public, anon;
grant execute on function public.settle_contribution_penalty(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 6. Plus de double ligne d'historique sur le prélèvement automatique
-- ----------------------------------------------------------------------------
-- Depuis la migration 0010, execute_financial_transaction écrit elle-même la
-- ligne wallet_transactions. process_due_contributions, qui tourne toutes les
-- quinze minutes, en insérait une seconde juste après : chaque cotisation
-- automatique allait donc apparaître deux fois dans l'historique, et compter
-- double dans les graphiques qui somment cette table.
--
-- Le solde, lui, restait juste — wallet_transactions est un journal
-- d'affichage, pas la source du solde. C'était donc un défaut de lecture, pas
-- de comptabilité, mais il aurait fait douter de chaque relevé.
--
-- Aucun doublon n'existe à ce jour : aucun prélèvement automatique n'a eu lieu
-- entre l'application de 0010 et celle-ci.
CREATE OR REPLACE FUNCTION public.process_due_contributions()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_cont record;
  v_member_name text;
  v_current_balance numeric;
  v_pending_penalty numeric;
  v_total_due numeric;
  v_days_late integer;
  v_penalty_amount numeric;
  v_grace integer;
  v_ledger_result jsonb;
  v_penalty_note text;
BEGIN
  FOR v_cont IN
    SELECT c.*, g.name AS group_name, g.currency AS group_currency,
           g.grace_period, g.penalty_type, g.penalty_rate,
           g.penalty_amount AS group_penalty_amount
    FROM public.contributions c
    JOIN public.groups g ON g.id = c.group_id
    WHERE g.status = 'active' AND c.status IN ('pending', 'late')
  LOOP
    SELECT display_name, wallet_balance INTO v_member_name, v_current_balance
    FROM public.profiles WHERE id = v_cont.user_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_pending_penalty := CASE WHEN v_cont.penalty_status = 'pending' THEN COALESCE(v_cont.penalty_applied, 0) ELSE 0 END;
    v_total_due := v_cont.amount + v_pending_penalty;

    IF v_current_balance >= v_total_due THEN
      v_penalty_note := CASE WHEN v_pending_penalty > 0
        THEN ' (dont ' || v_pending_penalty || ' ' || v_cont.group_currency || ' de pénalité de retard)'
        ELSE '' END;

      v_ledger_result := public.execute_financial_transaction(
        p_idempotency_key := 'debit_' || v_cont.id::text,
        p_user_id := v_cont.user_id,
        p_amount := v_total_due,
        p_currency := v_cont.group_currency,
        p_description := 'Cotisation automatique - ' || v_cont.group_name || ' (' || COALESCE(v_cont.period, 'Période') || ')' || v_penalty_note,
        p_action_type := 'contribution_payment',
        p_debit_account := 'user_wallet:' || v_cont.user_id,
        p_credit_account := 'tontine_group:' || v_cont.group_id,
        p_contribution_id := v_cont.id,
        p_group_id := v_cont.group_id
      );

      IF (v_ledger_result->>'success')::boolean THEN
        IF v_pending_penalty > 0 THEN
          UPDATE public.contributions SET penalty_status = 'paid' WHERE id = v_cont.id;
        END IF;

        -- (L'insertion dans wallet_transactions qui se trouvait ici est
        -- retirée : execute_financial_transaction s'en charge désormais.)

        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (v_cont.user_id, 'Cotisation prélevée - ' || v_cont.group_name,
          'Votre cotisation de ' || v_total_due || ' ' || v_cont.group_currency || ' a été prélevée de votre portefeuille pour la période ' || COALESCE(v_cont.period, '') || v_penalty_note || '.',
          'payout', '/group/' || v_cont.group_id);

        INSERT INTO public.messages (group_id, user_id, user_name, is_system, content)
        VALUES (v_cont.group_id, NULL, 'Système Tontine', true,
          '📢 ' || v_member_name || ' a réglé sa cotisation de ' || v_total_due || ' ' || v_cont.group_currency || ' pour la période ' || COALESCE(v_cont.period, '') || ' par prélèvement automatique !');
      END IF;

    ELSIF NOT v_cont.notified_insufficient THEN
      v_grace := COALESCE(v_cont.grace_period, 0);
      v_days_late := GREATEST(0, (CURRENT_DATE - v_cont.date::date));

      IF v_days_late <= v_grace THEN
        v_penalty_amount := 0;
      ELSIF v_cont.penalty_type = 'percentage' THEN
        v_penalty_amount := GREATEST(0, ROUND(v_cont.amount * (COALESCE(v_cont.penalty_rate, 0) / 100) * v_days_late));
      ELSE
        v_penalty_amount := GREATEST(0, COALESCE(v_cont.group_penalty_amount, 0));
      END IF;

      UPDATE public.contributions SET
        status = 'late',
        notified_insufficient = true,
        penalty_applied = CASE WHEN v_penalty_amount > 0 THEN v_penalty_amount ELSE penalty_applied END,
        penalty_status = CASE WHEN v_penalty_amount > 0 THEN 'pending' ELSE penalty_status END
      WHERE id = v_cont.id;

      v_penalty_note := CASE WHEN v_penalty_amount > 0
        THEN ' Une pénalité de retard de ' || v_penalty_amount || ' ' || v_cont.group_currency || ' a été appliquée.'
        ELSE '' END;

      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (v_cont.user_id, '⚠️ Solde Insuffisant - ' || v_cont.group_name,
        'Le prélèvement de ' || v_cont.amount || ' ' || v_cont.group_currency || ' a échoué car le solde de votre portefeuille est insuffisant (' || v_current_balance || ' ' || v_cont.group_currency || ').' || ' Veuillez recharger.' || v_penalty_note,
        'reminder', '/profile');

      INSERT INTO public.messages (group_id, user_id, user_name, is_system, content)
      VALUES (v_cont.group_id, NULL, 'Système Tontine', true,
        '⚠️ Alerte : Le prélèvement automatique de ' || v_cont.amount || ' ' || v_cont.group_currency || ' de ' || v_member_name || ' a échoué (solde de portefeuille insuffisant).' || v_penalty_note);
    END IF;
  END LOOP;
END;
$fn$;
