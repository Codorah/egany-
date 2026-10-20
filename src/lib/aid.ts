/**
 * « Coup de pouce » : aide non remboursable sur dossier (migration 0026).
 *
 * Parcours : la personne indique le montant voulu, explique son activité en
 * vidéo et paie les frais d'étude (submit) → l'équipe regarde la vidéo puis
 * verse l'aide sur le portefeuille (grant) ou refuse avec un motif (reject).
 * Rien n'est à rembourser. Toute écriture passe par une fonction serveur.
 */
import { supabase } from './supabase';
import { rpc } from './credit';

export type AidStatus = 'submitted' | 'granted' | 'rejected';

export interface AidApplication {
  id: string;
  userId: string;
  projectTitle: string;
  projectDescription: string;
  requestedAmount: number;
  videoPath?: string;
  videoUrl?: string;
  applicationFee: number;
  status: AidStatus;
  grantedAmount?: number;
  rejectionReason?: string;
  adminNotes?: string;
  disbursedAt?: string;
  createdAt: string;
}

export const AID_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const AID_MAX_AMOUNT = 100_000_000;

function mapAid(row: Record<string, any>): AidApplication {
  return {
    id: row.id,
    userId: row.user_id,
    projectTitle: row.project_title,
    projectDescription: row.project_description,
    requestedAmount: Number(row.requested_amount),
    videoPath: row.video_path ?? undefined,
    videoUrl: row.video_url ?? undefined,
    applicationFee: Number(row.application_fee),
    status: row.status,
    grantedAmount: row.granted_amount == null ? undefined : Number(row.granted_amount),
    rejectionReason: row.rejection_reason ?? undefined,
    adminNotes: row.admin_notes ?? undefined,
    disbursedAt: row.disbursed_at ?? undefined,
    createdAt: row.created_at,
  };
}

export async function fetchAidApplicationFee(): Promise<number> {
  const { data } = await supabase.from('platform_settings').select('aid_application_fee').eq('id', 1).maybeSingle();
  return data?.aid_application_fee != null ? Number(data.aid_application_fee) : 1000;
}

export async function fetchMyAidApplications(userId: string): Promise<AidApplication[]> {
  const { data, error } = await supabase
    .from('aid_applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapAid);
}

/**
 * Envoie la vidéo dans l'espace privé de la personne et renvoie son chemin.
 * L'envoi a lieu AVANT le dépôt (et donc avant les frais) : si le réseau
 * coupe, la personne n'a rien payé.
 */
export async function uploadAidVideo(userId: string, file: File): Promise<{ path?: string; error?: string }> {
  if (!file.type.startsWith('video/')) return { error: 'Ce fichier n’est pas une vidéo.' };
  if (file.size > AID_VIDEO_MAX_BYTES) {
    return { error: 'La vidéo dépasse 50 Mo. Filmez plus court (environ 1 minute) ou envoyez plutôt un lien.' };
  }
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('credit-videos').upload(path, file, { contentType: file.type });
  if (error) return { error: `Échec de l'envoi de la vidéo : ${error.message}` };
  return { path };
}

/** Lien temporaire (5 min) pour regarder une vidéo privée. */
export async function getAidVideoUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('credit-videos').createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

export function submitAidApplication(params: {
  projectTitle: string;
  projectDescription: string;
  requestedAmount: number;
  videoPath?: string;
  videoUrl?: string;
  idempotencyKey: string;
}) {
  return rpc('submit_aid_application', {
    p_project_title: params.projectTitle,
    p_project_description: params.projectDescription,
    p_requested_amount: params.requestedAmount,
    p_video_path: params.videoPath ?? null,
    p_video_url: params.videoUrl ?? null,
    p_idempotency_key: params.idempotencyKey,
  });
}

// ---------------------------------------------------------------- Équipe ---

export type AidApplicationForReview = AidApplication & {
  userName: string;
  userEmail: string;
  userTotalSaved: number;
  userReputation: number;
};

export async function fetchAidApplicationsForReview(): Promise<AidApplicationForReview[]> {
  const { data, error } = await supabase
    .from('aid_applications')
    .select('*, profiles!aid_applications_user_id_fkey(display_name, email, total_saved, reputation_score)')
    .eq('status', 'submitted')
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((row: any) => ({
    ...mapAid(row),
    userName: row.profiles?.display_name || 'Utilisateur',
    userEmail: row.profiles?.email || '',
    userTotalSaved: Number(row.profiles?.total_saved ?? 0),
    userReputation: Number(row.profiles?.reputation_score ?? 0),
  }));
}

export const grantAidApplication = (applicationId: string, amount: number, adminNotes?: string) =>
  rpc('grant_aid_application', { p_application_id: applicationId, p_amount: amount, p_admin_notes: adminNotes || null });

export const rejectAidApplication = (applicationId: string, reason: string) =>
  rpc('reject_aid_application', { p_application_id: applicationId, p_reason: reason });
