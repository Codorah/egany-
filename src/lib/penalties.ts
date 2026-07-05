import { Group, Contribution } from '@/types';
import { differenceInDays, parseISO } from 'date-fns';

export interface PenaltyRule {
  type: 'fixed' | 'percentage';
  rate?: number;      // e.g., 1.5% per day
  amount?: number;    // e.g., 500 FCFA flat
  gracePeriod?: number; // e.g., 2 days grace period
}

/**
 * Calculates the late interest/penalty for a given contribution
 */
export function calculateLatePenalty(
  contribution: Contribution,
  group: Group,
  asOfDate: Date = new Date()
): { daysLate: number; penaltyAmount: number } {
  // If not pending/late, or already paid/exempted, return 0
  if (contribution.status === 'paid') {
    return { daysLate: 0, penaltyAmount: contribution.penaltyApplied || 0 };
  }

  const dueDate = parseISO(contribution.date);
  const daysLate = differenceInDays(asOfDate, dueDate);

  // If paid on time or within grace period
  const gracePeriod = group.gracePeriod || 0;
  if (daysLate <= gracePeriod) {
    return { daysLate: Math.max(0, daysLate), penaltyAmount: 0 };
  }

  const pType = group.penaltyType || 'fixed';
  let penaltyAmount = 0;

  if (pType === 'fixed') {
    penaltyAmount = group.penaltyAmount || 0;
  } else if (pType === 'percentage') {
    const rate = group.penaltyRate || 0; // e.g. 1% per day
    penaltyAmount = Math.round(contribution.amount * (rate / 100) * daysLate);
  }

  return {
    daysLate,
    penaltyAmount: Math.max(0, penaltyAmount)
  };
}
