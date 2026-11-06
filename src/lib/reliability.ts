import { supabase } from './supabase';

export type ReliabilityFactor =
  | 'on_time_rate'
  | 'recent_late_rate'
  | 'open_late'
  | 'experience'
  | 'late_after_payout';

export interface ReliabilityChange {
  factor: ReliabilityFactor;
  /** Effet sur le risque de retard : positif = le score baisse. */
  impact: number;
}

export type Reliability =
  | { status: 'building'; dueCount: number; needed: number }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      score: number;
      modelVersion: string;
      dueCount: number;
      onTimeCount: number;
      openLate: number;
      recentLate: number;
      recentCount: number;
      afterPayoutCount: number;
      lateAfterPayout: number;
      factors: Record<ReliabilityFactor, number>;
      previousScore: number | null;
      previousDay: string | null;
      changes: ReliabilityChange[];
    };

export type ReadyReliability = Extract<Reliability, { status: 'ready' }>;

/** Calculé par le serveur (migration 0039), à partir du seul comportement de cotisation. */
export async function fetchMyReliability(): Promise<Reliability> {
  const { data, error } = await supabase.rpc('get_my_reliability');
  if (error) return { status: 'error', message: error.message };
  return data as Reliability;
}

export async function fetchMemberReliability(userId: string): Promise<Reliability> {
  const { data, error } = await supabase.rpc('admin_member_reliability', { p_user_id: userId });
  if (error) return { status: 'error', message: error.message };
  return data as Reliability;
}

export function reliabilityLevel(score: number): string {
  if (score >= 80) return 'Très régulier';
  if (score >= 60) return 'Régulier';
  if (score >= 40) return 'À surveiller';
  return 'À redresser';
}
