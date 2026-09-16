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
}

const DEFAULT_SETTINGS: PlatformSettings = {
  maintenanceMode: false,
  allowSignups: true,
  payoutFeeMode: 'none',
  payoutFeePercent: 0,
  platformWalletId: null,
};

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('maintenance_mode, allow_signups, payout_fee_mode, payout_fee_percent, platform_wallet_id')
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
  };
}

export async function updatePlatformSettings(
  patch: Partial<PlatformSettings>,
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
