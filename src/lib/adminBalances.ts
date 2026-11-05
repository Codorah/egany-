import { supabase } from './supabase';

export interface MemberVault {
  id: string;
  name: string;
  balance: number;
  unlockAt: string;
}

export interface MemberBalance {
  uid: string;
  name: string;
  email: string;
  wallet: number;
  savings: number;
  vaults: MemberVault[];
  /** Déjà débité du portefeuille, pas encore envoyé. */
  pendingWithdrawals: number;
  /** Reste à rembourser sur un crédit en cours. */
  creditDue: number;
  /** Cumul des cotisations payées depuis le début (profiles.total_saved) : pas un solde. */
  contributed: number;
}

export interface BalancesOverview {
  members: MemberBalance[];
  totals: {
    wallets: number;
    savings: number;
    pendingWithdrawals: number;
    /** Cotisations encaissées et pas encore distribuées, tous cercles confondus. */
    circlePots: number;
    /** Tout l'argent détenu pour les membres. Le crédit dû n'y est pas : c'est l'inverse, ils le doivent. */
    heldForMembers: number;
    creditDue: number;
  };
}

const PAGE_SIZE = 1000;

/**
 * Supabase renvoie 1 000 lignes au maximum par requête, sans le signaler. Sur des
 * totaux d'argent, ce serait un montant faux affiché sans avertissement : on lit donc
 * toutes les pages, et une erreur de lecture remonte au lieu de compter pour zéro.
 */
async function fetchAllRows(table: string, columns: string, apply: (query: any) => any = (q) => q): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const query = apply((supabase.from(table as any) as any).select(columns))
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    const { data, error } = await query;
    if (error) throw new Error(`Lecture de ${table} impossible : ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export async function fetchBalancesOverview(): Promise<BalancesOverview> {
  const [profiles, vaults, withdrawals, installments, contributions, payouts] = await Promise.all([
    fetchAllRows('profiles', 'id, display_name, email, wallet_balance, total_saved'),
    fetchAllRows('personal_vaults', 'id, user_id, name, balance, unlock_at'),
    fetchAllRows('wallet_transactions', 'id, user_id, amount', (q) => q.eq('type', 'withdraw').eq('status', 'pending')),
    fetchAllRows(
      'credit_installments',
      'id, amount_due, amount_paid, credit_applications!inner(user_id, status)',
      (q) => q.neq('status', 'paid').eq('credit_applications.status', 'active')
    ),
    // Même calcul de la cagnotte que GroupDetails et ContributionsManager.
    fetchAllRows('contributions', 'id, amount', (q) => q.eq('status', 'paid')),
    fetchAllRows('payouts', 'id, amount'),
  ]);

  const members = new Map<string, MemberBalance>();
  for (const p of profiles) {
    members.set(p.id, {
      uid: p.id,
      name: p.display_name || 'Sans nom',
      email: p.email || '',
      wallet: Number(p.wallet_balance ?? 0),
      savings: 0,
      vaults: [],
      pendingWithdrawals: 0,
      creditDue: 0,
      contributed: Number(p.total_saved ?? 0),
    });
  }

  const totals = { wallets: 0, savings: 0, pendingWithdrawals: 0, circlePots: 0, heldForMembers: 0, creditDue: 0 };

  for (const member of members.values()) totals.wallets += member.wallet;

  // Les totaux comptent aussi les lignes dont le profil a disparu (compte supprimé) :
  // cet argent reste à rendre, même s'il n'apparaît sur aucune ligne de la liste.
  for (const v of vaults) {
    const balance = Number(v.balance ?? 0);
    totals.savings += balance;
    const member = members.get(v.user_id);
    if (member) {
      member.savings += balance;
      member.vaults.push({ id: v.id, name: v.name, balance, unlockAt: v.unlock_at });
    }
  }

  for (const w of withdrawals) {
    const amount = Math.abs(Number(w.amount ?? 0));
    totals.pendingWithdrawals += amount;
    const member = members.get(w.user_id);
    if (member) member.pendingWithdrawals += amount;
  }

  for (const i of installments) {
    const due = Math.max(0, Number(i.amount_due ?? 0) - Number(i.amount_paid ?? 0));
    totals.creditDue += due;
    const application = Array.isArray(i.credit_applications) ? i.credit_applications[0] : i.credit_applications;
    const member = members.get(application?.user_id);
    if (member) member.creditDue += due;
  }

  const collected = contributions.reduce((sum, c) => sum + Number(c.amount ?? 0), 0);
  const distributed = payouts.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  totals.circlePots = collected - distributed;

  totals.heldForMembers = totals.wallets + totals.savings + totals.pendingWithdrawals + totals.circlePots;

  return { members: [...members.values()], totals };
}

/** Ce que la personne a chez nous aujourd'hui. */
export function memberTotal(member: MemberBalance): number {
  return member.wallet + member.savings + member.pendingWithdrawals;
}
