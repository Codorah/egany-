import { useEffect, useMemo, useState } from 'react';
import { supabase, createChannel } from '@/lib/supabase';
import { Group } from '@/types';

export interface MyDue {
  id: string;
  groupId: string;
  groupName: string;
  /** Montant à régler, pénalité en attente comprise. */
  amount: number;
  currency: string;
  dueDate: string;
  /** Date limite passée, délai de grâce compris. */
  isLate: boolean;
  /** Paiement déclaré, en attente de validation par l'organisateur. */
  awaitingApproval: boolean;
}

/**
 * Ce que la personne doit réellement, lu dans ses cotisations.
 *
 * L'accueil affichait « À faire maintenant » à partir de la date du prochain tour, même si
 * la cotisation était déjà payée. Le statut `late` ne suffit pas non plus : le prélèvement
 * automatique le pose dès que le solde manque, parfois avant la date. Le retard se déduit donc
 * de la date.
 */
export function useMyDues(userId: string | undefined, groups: Group[]) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from('contributions')
        .select('id, group_id, amount, date, status, penalty_applied, penalty_status')
        .eq('user_id', userId)
        .in('status', ['pending', 'late', 'pending_approval'])
        .order('date', { ascending: true });
      if (cancelled) return;
      // Échec de lecture : on garde ce qu'on avait, sans annoncer « à jour » à tort.
      if (error) console.error('useMyDues error:', error);
      else setRows(data ?? []);
      setLoading(false);
    };

    load();

    const channel = createChannel(`my-dues-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contributions', filter: `user_id=eq.${userId}` },
        () => load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const dues = useMemo<MyDue[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result: MyDue[] = [];
    for (const row of rows) {
      const group = groups.find((g) => g.id === row.group_id);
      if (!group || group.status !== 'active') continue;
      const limit = new Date(row.date);
      limit.setHours(0, 0, 0, 0);
      limit.setDate(limit.getDate() + (group.gracePeriod || 0));
      const penalty = row.penalty_status === 'pending' ? Number(row.penalty_applied ?? 0) : 0;
      result.push({
        id: row.id,
        groupId: row.group_id,
        groupName: group.name,
        amount: Number(row.amount) + penalty,
        currency: group.currency || 'FCFA',
        dueDate: row.date,
        isLate: limit < today,
        awaitingApproval: row.status === 'pending_approval',
      });
    }
    return result;
  }, [rows, groups]);

  return { dues, loading };
}
