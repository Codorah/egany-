import { supabase } from './supabase';
import { mapPersonalVaultRow } from './mappers';
import { PersonalVault } from '@/types';

export const BANK_TIER_MAX_VAULTS: Record<string, number> = {
  none: 0,
  starter: 5,
  growth: 20,
  unlimited: 999,
};

export const BANK_TIER_PRICE: Record<string, number> = {
  starter: 1000,
  growth: 2500,
  unlimited: 5000,
};

export async function fetchMyVaults(userId: string): Promise<PersonalVault[]> {
  const { data, error } = await supabase
    .from('personal_vaults')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapPersonalVaultRow);
}

export async function subscribeBankTier(tier: 'starter' | 'growth' | 'unlimited'): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('subscribe_bank_tier', { p_tier: tier });
  if (error) return { success: false, message: error.message };
  return data as { success: boolean; message: string };
}

export async function createPersonalVault(params: {
  name: string;
  description?: string;
  lockDays: number;
}): Promise<{ success: boolean; message: string; vaultId?: string }> {
  const { data, error } = await supabase.rpc('create_personal_vault', {
    p_name: params.name,
    p_description: params.description || null,
    p_lock_days: params.lockDays,
  });
  if (error) return { success: false, message: error.message };
  return data as { success: boolean; message: string; vaultId?: string };
}

export async function depositToVault(vaultId: string, amount: number): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('deposit_to_vault', { p_vault_id: vaultId, p_amount: amount });
  if (error) return { success: false, message: error.message };
  return data as { success: boolean; message: string };
}

export async function withdrawFromVault(vaultId: string, amount: number): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('withdraw_from_vault', { p_vault_id: vaultId, p_amount: amount });
  if (error) return { success: false, message: error.message };
  return data as { success: boolean; message: string };
}

export async function relockVault(vaultId: string, lockDays: number): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('relock_vault', { p_vault_id: vaultId, p_lock_days: lockDays });
  if (error) return { success: false, message: error.message };
  return data as { success: boolean; message: string };
}

export async function deleteEmptyVault(vaultId: string): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('delete_empty_vault', { p_vault_id: vaultId });
  if (error) return { success: false, message: error.message };
  return data as { success: boolean; message: string };
}
