import { supabase } from './supabase';
import { mapMarketplaceRequestRow, mapMarketplaceServiceRow } from './mappers';
import { MarketplaceRequest, MarketplaceService } from '@/types';

export async function fetchActiveServices(): Promise<MarketplaceService[]> {
  const { data, error } = await supabase
    .from('marketplace_services')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapMarketplaceServiceRow);
}

export async function fetchMyMarketplaceRequests(userId: string): Promise<MarketplaceRequest[]> {
  const { data, error } = await supabase
    .from('marketplace_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapMarketplaceRequestRow);
}

export async function submitMarketplaceRequest(params: {
  userId: string;
  serviceId: string;
  requestedAmount?: number;
}): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase.from('marketplace_requests').insert({
    user_id: params.userId,
    service_id: params.serviceId,
    requested_amount: params.requestedAmount ?? null,
  });
  if (error) {
    return { success: false, message: error.message };
  }
  return { success: true, message: 'Votre demande a été envoyée ! Notre partenaire vous contactera sous 24h.' };
}

export async function fetchPendingMarketplaceRequests(): Promise<(MarketplaceRequest & { userName: string; userEmail: string; userTotalSaved: number; serviceTitle: string; serviceCategory: string })[]> {
  const { data, error } = await supabase
    .from('marketplace_requests')
    .select('*, profiles!marketplace_requests_user_id_fkey(display_name, email, total_saved), marketplace_services!marketplace_requests_service_id_fkey(title, category)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((row: any) => ({
    ...mapMarketplaceRequestRow(row),
    userName: row.profiles?.display_name || 'Utilisateur',
    userEmail: row.profiles?.email || '',
    userTotalSaved: Number(row.profiles?.total_saved ?? 0),
    serviceTitle: row.marketplace_services?.title || 'Service',
    serviceCategory: row.marketplace_services?.category || '',
  }));
}

export async function approveMarketplaceCredit(params: {
  requestId: string;
  approvedAmount: number;
  repaymentDeadline: string;
  adminNotes?: string;
}): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('approve_marketplace_credit', {
    p_request_id: params.requestId,
    p_approved_amount: params.approvedAmount,
    p_repayment_deadline: params.repaymentDeadline,
    p_admin_notes: params.adminNotes || null,
  });
  if (error) return { success: false, message: error.message };
  return data as { success: boolean; message: string };
}

export async function repayMarketplaceCredit(params: {
  requestId: string;
  amount: number;
}): Promise<{ success: boolean; message: string; remainingBalance?: number }> {
  const { data, error } = await supabase.rpc('repay_marketplace_credit', {
    p_request_id: params.requestId,
    p_amount: params.amount,
  });
  if (error) return { success: false, message: error.message };
  return data as { success: boolean; message: string; remainingBalance?: number };
}

export async function updateMarketplaceRequestStatus(params: {
  requestId: string;
  status: 'contacted' | 'approved' | 'rejected';
  reviewerId: string;
  adminNotes?: string;
}): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase
    .from('marketplace_requests')
    .update({
      status: params.status,
      reviewed_by: params.reviewerId,
      reviewed_at: new Date().toISOString(),
      admin_notes: params.adminNotes || null,
    })
    .eq('id', params.requestId)
    .select('id');
  if (error) {
    return { success: false, message: error.message };
  }
  // A denied-by-RLS update matches zero rows without ever raising `error` —
  // without this check a non-admin session silently no-ops while the caller
  // still sees a success toast (this is exactly what happened in production:
  // the bootstrap admin account could open the admin panel but its profile
  // row had never actually been promoted to role='admin').
  if (!data || data.length === 0) {
    return { success: false, message: "Action non autorisée ou demande introuvable." };
  }
  return { success: true, message: 'Demande mise à jour.' };
}
