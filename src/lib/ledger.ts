import { supabase } from './supabase';

// Kept for AdminDashboard.tsx (not yet migrated) which still casts Firestore-
// shaped ledger/audit rows to these shapes for display.
export interface LedgerEntry {
  id: string;
  transactionId: string;
  idempotencyKey: string;
  account: string;
  counterparty: string;
  type: 'debit' | 'credit';
  amount: number;
  currency: string;
  description: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  details: string;
  ip: string;
  device: string;
  timestamp: string;
  status: 'success' | 'failure';
  idempotencyKey?: string;
}

export async function getDeviceInfo(): Promise<{ device: string; ip: string }> {
  if (typeof window === 'undefined') {
    return { device: 'Server Environment', ip: 'Non disponible' };
  }
  const ua = window.navigator.userAgent;
  let device = 'Navigateur Web';
  if (ua.includes('Mobi')) device = 'Appareil Mobile';
  if (ua.includes('Android')) device = 'Android App Core';
  else if (ua.includes('iPhone') || ua.includes('iPad')) device = 'iOS App Core';

  let ip = 'Non disponible';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data?.ip) ip = data.ip;
    }
  } catch {
    // Réseau indisponible ou requête bloquée — on ne fabrique jamais une IP de substitution.
  }

  return { device: `${device} (${window.navigator.platform || 'Unknown OS'})`, ip };
}

/**
 * Double-entry financial transaction, atomic and idempotent — the actual
 * logic now lives in the Postgres function execute_financial_transaction
 * (supabase/migrations/0001_init.sql), which is atomic by default (no manual
 * transaction orchestration needed client-side, unlike the old Firestore
 * runTransaction version).
 */
export async function executeFinancialTransaction(params: {
  idempotencyKey: string;
  userId: string;
  amount: number;
  currency: string;
  description: string;
  actionType: 'wallet_recharge' | 'contribution_payment' | 'payout_disbursement' | 'admin_adjustment' | 'wallet_withdrawal';
  debitAccount: string;
  creditAccount: string;
  metadata?: { contributionId?: string; groupId?: string };
}): Promise<{ success: boolean; message: string; transactionId?: string }> {
  const { ip } = await getDeviceInfo();
  const { data, error } = await supabase.rpc('execute_financial_transaction', {
    p_idempotency_key: params.idempotencyKey,
    p_user_id: params.userId,
    p_amount: params.amount,
    p_currency: params.currency,
    p_description: params.description,
    p_action_type: params.actionType,
    p_debit_account: params.debitAccount,
    p_credit_account: params.creditAccount,
    p_contribution_id: params.metadata?.contributionId ?? null,
    p_group_id: params.metadata?.groupId ?? null,
    p_ip: ip,
  });

  if (error) {
    console.error('executeFinancialTransaction RPC error:', error);
    return { success: false, message: error.message };
  }
  return data as { success: boolean; message: string; transactionId?: string };
}

export interface PendingWithdrawal {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  paymentMethod: string;
  reference: string | null;
  date: string;
}

/**
 * Retraits Mobile Money : Paydunya n'expose que l'encaissement (checkout),
 * pas le décaissement automatique — un vrai retrait nécessite qu'un admin
 * envoie physiquement l'argent via Mobile Money, puis marque la demande
 * traitée ici. Le portefeuille de l'utilisateur est débité immédiatement à
 * la demande (l'argent est réservé), remboursé uniquement si l'admin
 * marque le retrait en échec.
 */
export async function fetchPendingWithdrawals(): Promise<PendingWithdrawal[]> {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*, profiles!wallet_transactions_user_id_fkey(display_name, email)')
    .eq('type', 'withdraw')
    .eq('status', 'pending')
    .order('date', { ascending: true });
  if (error || !data) return [];
  return data.map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.profiles?.display_name || 'Utilisateur',
    userEmail: row.profiles?.email || '',
    amount: Number(row.amount),
    paymentMethod: row.payment_method || '',
    reference: row.reference,
    date: row.date,
  }));
}

export async function completeWithdrawal(transactionId: string): Promise<{ success: boolean; message?: string }> {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .update({ status: 'completed' })
    .eq('id', transactionId)
    .eq('status', 'pending')
    .select('id');
  if (error) return { success: false, message: error.message };
  if (!data || data.length === 0) return { success: false, message: 'Action non autorisée ou retrait déjà traité.' };
  return { success: true };
}

export async function failWithdrawal(params: {
  transactionId: string;
  userId: string;
  amount: number;
  reason?: string;
}): Promise<{ success: boolean; message?: string }> {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .update({ status: 'failed', description: params.reason || 'Retrait échoué — remboursé.' })
    .eq('id', params.transactionId)
    .eq('status', 'pending')
    .select('id');
  if (error) return { success: false, message: error.message };
  if (!data || data.length === 0) return { success: false, message: 'Action non autorisée ou retrait déjà traité.' };

  const refund = await executeFinancialTransaction({
    idempotencyKey: `withdraw_refund_${params.transactionId}`,
    userId: params.userId,
    amount: params.amount,
    currency: 'FCFA',
    description: `Remboursement — retrait échoué (${params.reason || 'raison non précisée'})`,
    actionType: 'admin_adjustment',
    debitAccount: 'mobile_money_payout_pending',
    creditAccount: `user_wallet:${params.userId}`,
  });
  if (!refund.success) return { success: false, message: refund.message };
  return { success: true };
}

export interface PinVerificationResult {
  ok: boolean;
  locked: boolean;
  remainingAttempts?: number;
  lockedUntil?: string;
  message: string;
}

export async function verifyUserPin(userId: string, enteredPin: string): Promise<PinVerificationResult> {
  const { data, error } = await supabase.rpc('verify_user_pin', {
    p_user_id: userId,
    p_entered_pin: enteredPin,
  });

  if (error) {
    console.error('verifyUserPin RPC error:', error);
    return { ok: false, locked: false, message: 'Erreur lors de la vérification du code PIN.' };
  }
  return data as PinVerificationResult;
}

export async function setUserPin(userId: string, newPin: string): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase.rpc('set_user_pin', {
    p_user_id: userId,
    p_new_pin: newPin,
  });

  if (error) {
    console.error('setUserPin RPC error:', error);
    return { success: false, message: error.message || 'Erreur lors de la mise à jour du code PIN.' };
  }
  return { success: true, message: 'Code PIN mis à jour !' };
}

/**
 * Reconciliation is a plain read + admin-gated write (no cross-table
 * atomicity needed), so unlike the two functions above it runs as regular
 * client queries rather than a SECURITY DEFINER RPC — RLS's is_admin() check
 * on reconciliation_reports/reconciliation_report_lines/audit_logs already
 * protects it correctly for a genuinely admin-only caller.
 */
export async function performFullSystemReconciliation() {
  const { ip, device } = await getDeviceInfo();

  try {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, display_name, email, wallet_balance');
    if (profilesError) throw profilesError;

    const { data: ledgerEntries, error: ledgerError } = await supabase
      .from('double_entry_ledger')
      .select('account, type, amount');
    if (ledgerError) throw ledgerError;

    const reconciliations: Array<{
      userId: string;
      displayName: string;
      currentBalance: number;
      calculatedBalance: number;
      discrepancy: number;
      status: 'OK' | 'DISCREPANCY';
    }> = [];

    let totalDiscrepancies = 0;

    for (const p of profiles ?? []) {
      const walletAccount = `user_wallet:${p.id}`;
      const credits = (ledgerEntries ?? [])
        .filter((e) => e.account === walletAccount && e.type === 'credit')
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const debits = (ledgerEntries ?? [])
        .filter((e) => e.account === walletAccount && e.type === 'debit')
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const calculatedBalance = credits - debits;
      const actualBalance = Number(p.wallet_balance) || 0;
      const discrepancy = actualBalance - calculatedBalance;
      if (discrepancy !== 0) totalDiscrepancies += Math.abs(discrepancy);

      reconciliations.push({
        userId: p.id,
        displayName: p.display_name || p.email,
        currentBalance: actualBalance,
        calculatedBalance,
        discrepancy,
        status: discrepancy === 0 ? 'OK' : 'DISCREPANCY',
      });
    }

    const status = totalDiscrepancies === 0 ? 'fully_reconciled' : 'discrepancy_alert';

    const { data: report, error: reportError } = await supabase
      .from('reconciliation_reports')
      .insert({
        total_users_checked: profiles?.length ?? 0,
        total_ledger_entries_checked: ledgerEntries?.length ?? 0,
        total_discrepancies: totalDiscrepancies,
        status,
        executed_by: 'Admin Panel',
      })
      .select()
      .single();
    if (reportError) throw reportError;

    if (reconciliations.length > 0) {
      const { error: linesError } = await supabase.from('reconciliation_report_lines').insert(
        reconciliations.map((r) => ({
          report_id: report.id,
          user_id: r.userId,
          display_name: r.displayName,
          current_balance: r.currentBalance,
          calculated_balance: r.calculatedBalance,
          discrepancy: r.discrepancy,
          status: r.status,
        }))
      );
      if (linesError) throw linesError;
    }

    await supabase.from('audit_logs').insert({
      user_id: null,
      action: 'reconciliation',
      details: `Réconciliation automatique terminée. Statut: ${status.toUpperCase()}. Écarts totaux: ${totalDiscrepancies} FCFA.`,
      ip,
      device,
      status: 'success',
    });

    return {
      success: true,
      report: {
        id: report.id,
        timestamp: report.timestamp,
        totalUsersChecked: report.total_users_checked,
        totalLedgerEntriesChecked: report.total_ledger_entries_checked,
        totalDiscrepancies: report.total_discrepancies,
        reconciliations,
        status: report.status,
        executedBy: report.executed_by,
      },
    };
  } catch (error: any) {
    console.error('Reconciliation error:', error);
    return { success: false, message: error.message || 'La réconciliation a échoué.' };
  }
}
