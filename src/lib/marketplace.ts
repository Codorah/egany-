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
}): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase.from('marketplace_requests').insert({
    user_id: params.userId,
    service_id: params.serviceId,
  });
  if (error) {
    return { success: false, message: error.message };
  }
  return { success: true, message: 'Votre demande a été envoyée ! Notre partenaire vous contactera sous 24h.' };
}

export async function fetchPendingMarketplaceRequests(): Promise<(MarketplaceRequest & { userName: string; userEmail: string; serviceTitle: string })[]> {
  const { data, error } = await supabase
    .from('marketplace_requests')
    .select('*, profiles!marketplace_requests_user_id_fkey(display_name, email), marketplace_services!marketplace_requests_service_id_fkey(title)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((row: any) => ({
    ...mapMarketplaceRequestRow(row),
    userName: row.profiles?.display_name || 'Utilisateur',
    userEmail: row.profiles?.email || '',
    serviceTitle: row.marketplace_services?.title || 'Service',
  }));
}

export async function updateMarketplaceRequestStatus(params: {
  requestId: string;
  status: 'contacted' | 'approved' | 'rejected';
  reviewerId: string;
  adminNotes?: string;
}): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from('marketplace_requests')
    .update({
      status: params.status,
      reviewed_by: params.reviewerId,
      reviewed_at: new Date().toISOString(),
      admin_notes: params.adminNotes || null,
    })
    .eq('id', params.requestId);
  if (error) {
    return { success: false, message: error.message };
  }
  return { success: true, message: 'Demande mise à jour.' };
}
