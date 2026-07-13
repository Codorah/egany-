-- Permet à un admin (et uniquement un admin) d'insérer directement une entrée
-- d'audit depuis le client — utilisé par performFullSystemReconciliation, qui
-- n'est pas une fonction SECURITY DEFINER (contrairement aux mouvements
-- financiers, cette entrée est un simple résumé administratif).
create policy "audit_logs_insert_admin" on public.audit_logs
  for insert with check (public.is_admin());
