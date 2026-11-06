import { supabase } from './supabase';
import { Group, UserProfile } from '@/types';
import type { AssistantContext, AssistantContribution } from './assistantEngine';
import { fetchCircleHealth, fetchMyReliability } from './reliability';

/**
 * Rassemble les données réelles lues par l'assistant. Renvoie null si les cotisations
 * sont illisibles : mieux vaut ne rien dire qu'annoncer « aucun retard » à tort.
 */
export async function loadAssistantContext(
  user: UserProfile,
  groups: Group[],
  { withCircleHealth = false }: { withCircleHealth?: boolean } = {}
): Promise<AssistantContext | null> {
  const active = groups.filter((g) => g.status === 'active');

  const [reliability, contributionsResult, health] = await Promise.all([
    fetchMyReliability(),
    supabase
      .from('contributions')
      .select('group_id, amount, date, status, penalty_applied, penalty_status')
      .eq('user_id', user.uid)
      .in('status', ['pending', 'late']),
    withCircleHealth ? Promise.all(active.map((g) => fetchCircleHealth(g.id))) : Promise.resolve(null),
  ]);

  if (contributionsResult.error || !contributionsResult.data) return null;

  const contributions: AssistantContribution[] = contributionsResult.data.map((row: any) => {
    const group = groups.find((g) => g.id === row.group_id);
    return {
      groupName: group?.name || 'Cercle',
      amount: Number(row.amount),
      penalty: row.penalty_status === 'pending' ? Number(row.penalty_applied ?? 0) : 0,
      currency: group?.currency || 'FCFA',
      dueDate: row.date,
      status: row.status,
    };
  });

  return {
    firstName: user.firstName || user.displayName.split(' ')[0] || '',
    walletBalance: user.walletBalance || 0,
    contributions,
    reliability,
    circles: active.map((g, index) => ({
      name: g.name,
      nextPayoutDate: g.nextPayoutDate,
      potAmount: g.contributionAmount * g.members.length,
      currency: g.currency,
      isNextBeneficiary: g.payoutOrder[g.currentPayoutIndex] === user.uid,
      health: health ? health[index] : undefined,
    })),
  };
}
