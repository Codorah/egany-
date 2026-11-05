import { supabase } from './supabase';

/**
 * 'contribution_share' prélève une cotisation par distribution. C'est
 * arithmétiquement 1/N du pot (pot = cotisation × N), donc le taux effectif
 * dépend de la taille du cercle : 10 membres → 10 %, mais 5 membres → 20 %.
 * 'percent' applique au contraire le même taux quelle que soit la taille.
 */
export type PayoutFeeMode = 'none' | 'contribution_share' | 'percent';

export interface PlatformSettings {
  maintenanceMode: boolean;
  allowSignups: boolean;
  payoutFeeMode: PayoutFeeMode;
  /** Utilisé uniquement quand payoutFeeMode vaut 'percent'. */
  payoutFeePercent: number;
  /** Profil dont le portefeuille encaisse la commission. Sans lui, rien n'est prélevé. */
  platformWalletId: string | null;
  /** Frais du prestataire de paiement sur les dépôts — voir computeDepositFee. */
  depositFeeEnabled: boolean;
  depositFeePercent: number;
  depositFeeFixed: number;
  depositFeeMin: number;
}

const DEFAULT_SETTINGS: PlatformSettings = {
  maintenanceMode: false,
  allowSignups: true,
  payoutFeeMode: 'none',
  payoutFeePercent: 0,
  platformWalletId: null,
  // Par défaut on ne facture rien : si la lecture des réglages échoue, mieux
  // vaut un dépôt sans frais qu'un montant gonflé au hasard.
  depositFeeEnabled: false,
  depositFeePercent: 0,
  depositFeeFixed: 0,
  depositFeeMin: 0,
};

export interface DepositFeeBreakdown {
  /** Ce qui arrive sur le portefeuille. */
  net: number;
  /** Les frais du prestataire. */
  fee: number;
  /** Ce qui est réellement débité sur le Mobile Money. */
  gross: number;
}

/**
 * Deux façons de régler les frais du prestataire sur un montant saisi :
 *
 * - feeOnTop (par défaut, case « frais en plus » cochée) : les frais
 *   s'AJOUTENT. Qui saisit 1000 F est débité de 1025 F et reçoit bien 1000 F
 *   — le plus clair sur un produit d'épargne où les montants sont des
 *   objectifs ronds.
 * - case décochée : les frais sont RETENUS sur le montant. Qui saisit 1000 F
 *   est débité de 1000 F et reçoit 975 F.
 *
 * Dans les deux cas les frais se calculent sur le montant saisi. Arrondi à
 * l'entier supérieur : le FCFA n'a pas de subdivision, et arrondir vers le
 * bas ferait payer la différence à la plateforme à chaque dépôt.
 *
 * Doit rester aligné sur computeGrossAmount (api/create-paydunya-checkout.ts),
 * qui refait ce calcul côté serveur au moment de facturer.
 */
export function computeDepositFee(amount: number, settings: PlatformSettings, feeOnTop = true): DepositFeeBreakdown {
  const rounded = Math.max(0, Math.round(amount) || 0);
  if (!settings.depositFeeEnabled || !Number.isFinite(amount) || amount <= 0) {
    return { net: rounded, fee: 0, gross: rounded };
  }
  const proportional = (rounded * settings.depositFeePercent) / 100;
  const fee = Math.max(Math.ceil(proportional + settings.depositFeeFixed), settings.depositFeeMin);
  return feeOnTop
    ? { net: rounded, fee, gross: rounded + fee }
    : { net: Math.max(0, rounded - fee), fee, gross: rounded };
}

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabase
    .from('platform_settings')
    // Doit rester un littéral d'un seul tenant : supabase-js infère le type du
    // résultat en analysant cette chaîne, et une concaténation lui fait perdre
    // l'inférence (toutes les colonnes deviennent alors des erreurs de type).
    .select('maintenance_mode, allow_signups, payout_fee_mode, payout_fee_percent, platform_wallet_id, deposit_fee_enabled, deposit_fee_percent, deposit_fee_fixed, deposit_fee_min')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('fetchPlatformSettings error:', error);
    return DEFAULT_SETTINGS;
  }
  return {
    maintenanceMode: data.maintenance_mode,
    allowSignups: data.allow_signups,
    payoutFeeMode: (data.payout_fee_mode ?? 'none') as PayoutFeeMode,
    payoutFeePercent: Number(data.payout_fee_percent ?? 0),
    platformWalletId: data.platform_wallet_id ?? null,
    depositFeeEnabled: data.deposit_fee_enabled ?? false,
    depositFeePercent: Number(data.deposit_fee_percent ?? 0),
    depositFeeFixed: Number(data.deposit_fee_fixed ?? 0),
    depositFeeMin: Number(data.deposit_fee_min ?? 0),
  };
}

export interface AutoWithdrawSettings {
  autoWithdrawEnabled: boolean;
  autoWithdrawMaxAmount: number;
  autoWithdrawDailyMax: number;
}

/**
 * Lecture séparée de fetchPlatformSettings : si ces colonnes manquent (migration
 * 0036 pas appliquée), les frais de dépôt et le mode maintenance restent lus.
 */
export async function fetchAutoWithdrawSettings(): Promise<AutoWithdrawSettings | null> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('auto_withdraw_enabled, auto_withdraw_max_amount, auto_withdraw_daily_max')
    .eq('id', 1)
    .maybeSingle();
  if (error || !data) {
    if (error) console.warn('fetchAutoWithdrawSettings error:', error);
    return null;
  }
  return {
    autoWithdrawEnabled: data.auto_withdraw_enabled,
    autoWithdrawMaxAmount: Number(data.auto_withdraw_max_amount),
    autoWithdrawDailyMax: Number(data.auto_withdraw_daily_max),
  };
}

export interface WithdrawFeeSettings {
  withdrawFeeEnabled: boolean;
  withdrawFeePercent: number;
  withdrawFeeFixed: number;
  withdrawFeeMin: number;
}

/** Lecture séparée, pour la même raison que fetchAutoWithdrawSettings. */
export async function fetchWithdrawFeeSettings(): Promise<WithdrawFeeSettings | null> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('withdraw_fee_enabled, withdraw_fee_percent, withdraw_fee_fixed, withdraw_fee_min')
    .eq('id', 1)
    .maybeSingle();
  if (error || !data) {
    if (error) console.warn('fetchWithdrawFeeSettings error:', error);
    return null;
  }
  return {
    withdrawFeeEnabled: data.withdraw_fee_enabled,
    withdrawFeePercent: Number(data.withdraw_fee_percent),
    withdrawFeeFixed: Number(data.withdraw_fee_fixed),
    withdrawFeeMin: Number(data.withdraw_fee_min),
  };
}

export interface WithdrawFeeBreakdown {
  /** Ce qui part sur le Mobile Money. */
  net: number;
  fee: number;
  /** Ce qui quitte le portefeuille. */
  debit: number;
}

/**
 * Doit donner exactement le même résultat que request_wallet_withdrawal
 * (migration 0037), qui refuse le retrait sinon. Le toFixed retire les erreurs
 * d'arrondi des nombres à virgule : 1000 × 1,1 / 100 vaut 11,000000000000002 en
 * JavaScript, ce qui donnerait 12 F ici et 11 F en base.
 */
export function computeWithdrawFee(amount: number, settings: WithdrawFeeSettings | null, feeOnTop: boolean): WithdrawFeeBreakdown {
  const rounded = Math.max(0, Math.round(amount) || 0);
  if (!settings?.withdrawFeeEnabled || rounded <= 0) {
    return { net: rounded, fee: 0, debit: rounded };
  }
  const raw = (rounded * settings.withdrawFeePercent) / 100 + settings.withdrawFeeFixed;
  const fee = Math.max(Math.ceil(Number(raw.toFixed(6))), settings.withdrawFeeMin);
  return feeOnTop
    ? { net: rounded, fee, debit: rounded + fee }
    : { net: Math.max(0, rounded - fee), fee, debit: rounded };
}

export interface RevenueShare {
  profileId: string;
  percent: number;
}

/** Parts de commission de chaque administrateur (lecture réservée aux admins). */
export async function fetchRevenueShares(): Promise<RevenueShare[]> {
  const { data, error } = await supabase
    .from('platform_revenue_shares')
    .select('profile_id, share_percent');
  if (error) {
    console.warn('fetchRevenueShares error:', error);
    return [];
  }
  return (data ?? []).map((r: any) => ({ profileId: r.profile_id, percent: Number(r.share_percent) }));
}

/**
 * Enregistre la répartition. Le serveur refuse tout total différent de 100 %
 * et tout compte qui n'est pas administrateur.
 */
export async function saveRevenueShares(shares: RevenueShare[]): Promise<{ success: boolean; message?: string }> {
  const { data, error } = await supabase.rpc('set_platform_revenue_shares', { p_shares: shares });
  if (error) return { success: false, message: error.message };
  const res = data as { success: boolean; message?: string } | null;
  return res?.success ? { success: true } : { success: false, message: res?.message || 'Enregistrement refusé.' };
}

export async function updatePlatformSettings(
  patch: Partial<PlatformSettings & AutoWithdrawSettings & WithdrawFeeSettings>,
  updatedBy: string
): Promise<{ success: boolean; message?: string }> {
  const { data, error } = await supabase
    .from('platform_settings')
    .update({
      ...(patch.maintenanceMode !== undefined ? { maintenance_mode: patch.maintenanceMode } : {}),
      ...(patch.allowSignups !== undefined ? { allow_signups: patch.allowSignups } : {}),
      ...(patch.payoutFeeMode !== undefined ? { payout_fee_mode: patch.payoutFeeMode } : {}),
      ...(patch.payoutFeePercent !== undefined ? { payout_fee_percent: patch.payoutFeePercent } : {}),
      ...(patch.platformWalletId !== undefined ? { platform_wallet_id: patch.platformWalletId } : {}),
      ...(patch.depositFeeEnabled !== undefined ? { deposit_fee_enabled: patch.depositFeeEnabled } : {}),
      ...(patch.depositFeePercent !== undefined ? { deposit_fee_percent: patch.depositFeePercent } : {}),
      ...(patch.depositFeeFixed !== undefined ? { deposit_fee_fixed: patch.depositFeeFixed } : {}),
      ...(patch.depositFeeMin !== undefined ? { deposit_fee_min: patch.depositFeeMin } : {}),
      ...(patch.withdrawFeeEnabled !== undefined ? { withdraw_fee_enabled: patch.withdrawFeeEnabled } : {}),
      ...(patch.withdrawFeePercent !== undefined ? { withdraw_fee_percent: patch.withdrawFeePercent } : {}),
      ...(patch.withdrawFeeFixed !== undefined ? { withdraw_fee_fixed: patch.withdrawFeeFixed } : {}),
      ...(patch.withdrawFeeMin !== undefined ? { withdraw_fee_min: patch.withdrawFeeMin } : {}),
      ...(patch.autoWithdrawEnabled !== undefined ? { auto_withdraw_enabled: patch.autoWithdrawEnabled } : {}),
      ...(patch.autoWithdrawMaxAmount !== undefined ? { auto_withdraw_max_amount: patch.autoWithdrawMaxAmount } : {}),
      ...(patch.autoWithdrawDailyMax !== undefined ? { auto_withdraw_daily_max: patch.autoWithdrawDailyMax } : {}),
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    })
    .eq('id', 1)
    .select('id');

  if (error) return { success: false, message: error.message };
  // RLS silently matches zero rows instead of erroring when the caller isn't
  // actually an admin — surface that as a failure rather than a false success.
  if (!data || data.length === 0) return { success: false, message: 'Action non autorisée.' };
  return { success: true };
}
