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

export type CircleHealthLevel = 'low' | 'medium' | 'high';

export type CircleHealth =
  | { status: 'ok'; level: CircleHealthLevel }
  | { status: 'not_enough' }
  | { status: 'error'; message?: string };

/** Estimation agrégée, sans score ni nom (migration 0040). */
export async function fetchCircleHealth(groupId: string): Promise<CircleHealth> {
  const { data, error } = await supabase.rpc('get_circle_health', { p_group_id: groupId });
  if (error) return { status: 'error', message: error.message };
  return data as CircleHealth;
}

export interface MemberToContact {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  score: number;
  openLate: number;
}

/** Admin : personnes à contacter d'abord. Une aide à l'équipe, pas une décision. */
export async function fetchReliabilityOverview(): Promise<MemberToContact[] | null> {
  const { data, error } = await supabase.rpc('admin_reliability_overview');
  if (error) return null;
  const result = data as { status: string; members?: MemberToContact[] };
  return result?.status === 'ok' ? result.members ?? [] : null;
}

// L'assistant et son moteur sont hors de React : la langue affichée leur est transmise ici.
let assistantEnglish = false;
export function setAssistantLanguage(language: string) {
  assistantEnglish = language === 'en';
}
/** Le français par défaut ; l'anglais si la personne a choisi l'anglais. */
export const tr = (fr: string, en: string) => (assistantEnglish ? en : fr);

export function reliabilityLevel(score: number): string {
  if (score >= 80) return tr('Très régulier', 'Very regular');
  if (score >= 60) return tr('Régulier', 'Regular');
  if (score >= 40) return tr('À surveiller', 'Keep an eye on it');
  return tr('À redresser', 'Needs work');
}
