import { supabase } from './supabase';
import { Frequency } from '@/types';
import { addDays, parseISO } from 'date-fns';

/**
 * Calculates the next payout date based on frequency. Pure function, no I/O —
 * unchanged by the Supabase migration (still used by CreateGroupDialog.tsx
 * and the execute_payout_disbursement Postgres function reimplements the
 * same logic server-side for atomicity).
 */
export function calculateNextPayoutDate(currentDateStr: string, frequency: Frequency): string {
  const date = parseISO(currentDateStr);
  let nextDate = date;
  if (frequency === 'daily') {
    nextDate = addDays(date, 1);
  } else if (frequency === 'weekly') {
    nextDate = addDays(date, 7);
  } else if (frequency === 'bi-weekly') {
    nextDate = addDays(date, 14);
  } else {
    nextDate = addDays(date, 30);
  }
  return nextDate.toISOString();
}

/**
 * Executes a full payout disbursement (standard, random draw, or auction
 * tontine). The actual logic — including the idempotency protection that was
 * missing from the old Firestore version — now lives in the Postgres
 * function execute_payout_disbursement (supabase/migrations/0001_init.sql).
 */
export async function executePayoutDisbursement(params: {
  groupId: string;
  beneficiaryId: string;
  discountAmount?: number;
  adminUserId: string;
}): Promise<{ success: boolean; message: string; transactionId?: string }> {
  const { data, error } = await supabase.rpc('execute_payout_disbursement', {
    p_group_id: params.groupId,
    p_beneficiary_id: params.beneficiaryId,
    p_admin_user_id: params.adminUserId,
    p_discount_amount: params.discountAmount ?? 0,
  });

  if (error) {
    console.error('executePayoutDisbursement RPC error:', error);
    return { success: false, message: error.message };
  }
  return data as { success: boolean; message: string; transactionId?: string };
}
