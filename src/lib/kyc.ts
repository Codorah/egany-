import { supabase } from './supabase';
import { mapKycSubmissionRow } from './mappers';
import { KycSubmission, UserProfile } from '@/types';

export const KYC_VERIFIED_LEVEL = 2;

export function isKycVerified(profile: Pick<UserProfile, 'kycLevel'> | null | undefined): boolean {
  return (profile?.kycLevel ?? 1) >= KYC_VERIFIED_LEVEL;
}

export async function submitKycDocument(params: {
  userId: string;
  fullName: string;
  idNumber?: string;
  file: File;
}): Promise<{ success: boolean; message: string }> {
  const { userId, fullName, idNumber, file } = params;
  const path = `${userId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage.from('kyc-documents').upload(path, file);
  if (uploadError) {
    return { success: false, message: `Échec de l'envoi du document : ${uploadError.message}` };
  }

  const { error: insertError } = await supabase.from('kyc_submissions').insert({
    user_id: userId,
    full_name: fullName,
    id_number: idNumber || null,
    document_path: path,
  });
  if (insertError) {
    return { success: false, message: `Échec de la soumission : ${insertError.message}` };
  }

  return { success: true, message: 'Votre document a été envoyé et est en attente de vérification.' };
}

export async function fetchLatestKycSubmission(userId: string): Promise<KycSubmission | null> {
  const { data, error } = await supabase
    .from('kyc_submissions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapKycSubmissionRow(data);
}

export async function fetchPendingKycSubmissions(): Promise<(KycSubmission & { userName: string; userEmail: string })[]> {
  const { data, error } = await supabase
    .from('kyc_submissions')
    .select('*, profiles!kyc_submissions_user_id_fkey(display_name, email)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((row: any) => ({
    ...mapKycSubmissionRow(row),
    userName: row.profiles?.display_name || 'Utilisateur',
    userEmail: row.profiles?.email || '',
  }));
}

export async function getKycDocumentUrl(documentPath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('kyc-documents').createSignedUrl(documentPath, 300);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function reviewKycSubmission(params: {
  submissionId: string;
  approve: boolean;
  rejectionReason?: string;
}): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('review_kyc_submission', {
    p_submission_id: params.submissionId,
    p_approve: params.approve,
    p_rejection_reason: params.rejectionReason || null,
  });
  if (error) {
    return { success: false, message: error.message };
  }
  return data as { success: boolean; message: string };
}
