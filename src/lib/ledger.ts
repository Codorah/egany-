import { supabase } from './supabase';
import { apiFetch } from './apiBase';

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

/**
 * Garde hors connexion, commune à toutes les opérations d'argent.
 *
 * La bannière hors-ligne annonçait déjà que « recharge, retrait, cotisation
 * et création/adhésion de cercle sont désactivés » — mais rien ne les
 * désactivait : l'état `isOnline` n'était transmis à aucun écran. La
 * personne lançait donc l'opération, qui échouait sur une erreur réseau
 * brute, après avoir cru l'avoir engagée.
 *
 * Le contrôle est posé ici, au point de passage obligé de l'argent, plutôt
 * que répété dans chaque écran : aucun nouveau chemin de paiement ne pourra
 * l'oublier. Rien n'est mis en file d'attente : un mouvement d'argent n'est
 * réel que lorsque le serveur l'a validé (idempotence, grand livre, verrou
 * de ligne), et rejouer plus tard une intention prise hors ligne sur un
 * solde devenu faux est précisément ce qu'il faut éviter.
 */
export const OFFLINE_MONEY_MESSAGE =
  "Vous êtes hors connexion. Les opérations d'argent attendent le retour du réseau : rien n'est engagé sans confirmation du serveur.";

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
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
  if (isOffline()) return { success: false, message: OFFLINE_MONEY_MESSAGE };

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

export type WithdrawalState = 'sent' | 'processing' | 'manual' | 'failed';

export interface WithdrawalResult {
  success: boolean;
  message?: string;
  state?: WithdrawalState;
  withdrawalId?: string;
  amount?: number;
  /** Le code PIN est encore 0000 : le retrait passe par l'équipe. */
  defaultPin?: boolean;
  error?: string | null;
}

const WITHDRAWAL_CONNECTION_ERROR = 'Connexion interrompue. Vérifiez votre historique avant de réessayer.';

async function callPayout(action: string, body: object): Promise<WithdrawalResult> {
  try {
    const response = await apiFetch(`/api/paydunya-payout?action=${action}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!data) return { success: false, message: WITHDRAWAL_CONNECTION_ERROR };
    return data as WithdrawalResult;
  } catch (err) {
    console.error('callPayout error:', action, err);
    return { success: false, message: WITHDRAWAL_CONNECTION_ERROR };
  }
}

/**
 * Retrait : le serveur vérifie le code PIN, débite le portefeuille, puis envoie
 * l'argent via PayDunya quand le retrait est sous les plafonds. Sinon la demande
 * va dans la file de l'Admin. Voir api/paydunya-payout.ts.
 *
 * La clé d'idempotence rend un nouvel essai sans danger après une coupure.
 */
export function requestWithdrawal(params: {
  idempotencyKey: string;
  amount: number;
  paymentMethod: string;
  phone: string;
  pin: string;
}): Promise<WithdrawalResult> {
  if (isOffline()) return Promise.resolve({ success: false, message: OFFLINE_MONEY_MESSAGE });
  return callPayout('request', params);
}

export function fetchWithdrawalStatus(withdrawalId: string): Promise<WithdrawalResult> {
  return callPayout('status', { withdrawalId });
}

/** Admin : lance ou relance l'envoi PayDunya d'un retrait de la file. */
export function sendWithdrawalViaPaydunya(withdrawalId: string): Promise<WithdrawalResult> {
  return callPayout('send', { withdrawalId });
}

/**
 * Admin : rend la main sur un envoi resté « en cours ». Le jeton est conservé :
 * si PayDunya confirme plus tard, le retrait sera bien marqué envoyé.
 */
export async function releaseStuckWithdrawal(transactionId: string): Promise<{ success: boolean; message?: string }> {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .update({ payout_state: 'manual', payout_error: 'Débloqué par un admin après vérification sur PayDunya.' })
    .eq('id', transactionId)
    .eq('status', 'pending')
    .eq('payout_state', 'processing')
    .select('id');
  if (error) return { success: false, message: error.message };
  if (!data || data.length === 0) return { success: false, message: 'Ce retrait n’est plus en cours.' };
  return { success: true };
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
  payoutState: 'processing' | 'manual' | 'sent' | null;
  payoutError: string | null;
  payoutStartedAt: string | null;
}

/**
 * File de l'Admin : retraits débités, pas encore envoyés. Les envois en cours
 * chez PayDunya y figurent aussi, sans possibilité d'action tant que leur issue
 * n'est pas connue.
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
    // Les lignes de retrait sont stockées en négatif depuis 0010 (l'argent
    // sort du portefeuille, et l'historique affiche un montant signé). Ici
    // l'admin raisonne en « combien envoyer », donc valeur absolue.
    amount: Math.abs(Number(row.amount)),
    paymentMethod: row.payment_method || '',
    reference: row.reference,
    date: row.date,
    payoutState: row.payout_state ?? null,
    payoutError: row.payout_error ?? null,
    payoutStartedAt: row.payout_started_at ?? null,
  }));
}

export interface ProcessedWithdrawal extends PendingWithdrawal {
  status: 'completed' | 'failed';
  payoutReference?: string | null;
  payoutFee?: number | null;
}

/** Historique des retraits déjà traités (envoyés ou échoués), du plus récent au plus ancien. */
export async function fetchProcessedWithdrawals(limit = 100): Promise<ProcessedWithdrawal[]> {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*, profiles!wallet_transactions_user_id_fkey(display_name, email)')
    .eq('type', 'withdraw')
    .in('status', ['completed', 'failed'])
    .order('date', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.profiles?.display_name || 'Utilisateur',
    userEmail: row.profiles?.email || '',
    amount: Math.abs(Number(row.amount)),
    paymentMethod: row.payment_method || '',
    reference: row.reference,
    date: row.date,
    payoutState: row.payout_state ?? null,
    payoutError: row.payout_error ?? null,
    payoutStartedAt: row.payout_started_at ?? null,
    status: row.status,
    payoutReference: row.payout_reference ?? null,
    payoutFee: row.payout_fee === null || row.payout_fee === undefined ? null : Number(row.payout_fee),
  }));
}

/** Un envoi PayDunya en cours peut encore réussir : ni envoi manuel, ni remboursement. */
const NOT_BEING_SENT = 'payout_state.is.null,payout_state.eq.manual';

export async function completeWithdrawal(transactionId: string, payoutReference: string): Promise<{ success: boolean; message?: string }> {
  const ref = payoutReference.trim();
  if (!ref) return { success: false, message: 'La référence de la transaction Mobile Money est obligatoire.' };
  const { data, error } = await supabase
    .from('wallet_transactions')
    .update({ status: 'completed', payout_state: 'sent', payout_reference: ref })
    .eq('id', transactionId)
    .eq('status', 'pending')
    .or(NOT_BEING_SENT)
    .select('id');
  if (error) return { success: false, message: error.message };
  if (!data || data.length === 0) return { success: false, message: 'Retrait déjà traité, ou envoi PayDunya en cours.' };
  return { success: true };
}

export async function failWithdrawal(params: {
  transactionId: string;
  userId: string;
  amount: number;
  reason?: string;
}): Promise<{ success: boolean; message?: string }> {
  // On vérifie que la demande est toujours en attente, puis on REMBOURSE
  // d'abord : si le remboursement échoue, la demande reste « en attente » et
  // l'admin peut réessayer (la clé d'idempotence évite tout double crédit).
  const { data: pending, error: pendingError } = await supabase
    .from('wallet_transactions')
    .select('id')
    .eq('id', params.transactionId)
    .eq('status', 'pending')
    .or(NOT_BEING_SENT);
  if (pendingError) return { success: false, message: pendingError.message };
  if (!pending || pending.length === 0) return { success: false, message: 'Retrait déjà traité, ou envoi PayDunya en cours.' };

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

  const { error } = await supabase
    .from('wallet_transactions')
    .update({ status: 'failed', description: params.reason || 'Retrait échoué — remboursé.' })
    .eq('id', params.transactionId)
    .eq('status', 'pending');
  if (error) return { success: false, message: `Remboursé, mais statut non mis à jour : ${error.message}` };
  return { success: true };
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
