/**
 * Microcrédit sur dossier de projet (migration 0019).
 *
 * Parcours : dépôt du dossier + frais (submit) → offre ou refus de l'équipe
 * (makeOffer / reject) → l'emprunteur accepte ou décline (accept / decline)
 * → mensualités (repay, et prélèvement automatique côté serveur).
 * Toute écriture passe par une fonction serveur : les tables sont en lecture
 * seule pour l'application.
 */
import { supabase } from './supabase';
import { isOffline, OFFLINE_MONEY_MESSAGE } from './ledger';

export type CreditStatus = 'submitted' | 'offered' | 'rejected' | 'declined' | 'active' | 'repaid';

export interface CreditInstallment {
  id: string;
  number: number;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  status: 'pending' | 'late' | 'paid';
}

export interface CreditApplication {
  id: string;
  userId: string;
  serviceId: string;
  projectTitle: string;
  projectDescription: string;
  requestedAmount: number;
  requestedMonths: number;
  videoPath?: string;
  videoUrl?: string;
  applicationFee: number;
  status: CreditStatus;
  offeredAmount?: number;
  interestRate?: number;
  durationMonths?: number;
  totalDue?: number;
  rejectionReason?: string;
  adminNotes?: string;
  offeredAt?: string;
  disbursedAt?: string;
  repaidAmount: number;
  createdAt: string;
  installments: CreditInstallment[];
}

type Result = { success: boolean; message: string };

const num = (v: unknown) => (v == null ? undefined : Number(v));

function mapInstallment(row: Record<string, any>): CreditInstallment {
  return {
    id: row.id,
    number: row.number,
    dueDate: row.due_date,
    amountDue: Number(row.amount_due),
    amountPaid: Number(row.amount_paid ?? 0),
    status: row.status,
  };
}

function mapApplication(row: Record<string, any>): CreditApplication {
  return {
    id: row.id,
    userId: row.user_id,
    serviceId: row.service_id,
    projectTitle: row.project_title,
    projectDescription: row.project_description,
    requestedAmount: Number(row.requested_amount),
    requestedMonths: row.requested_months,
    videoPath: row.video_path ?? undefined,
    videoUrl: row.video_url ?? undefined,
    applicationFee: Number(row.application_fee),
    status: row.status,
    offeredAmount: num(row.offered_amount),
    interestRate: num(row.interest_rate),
    durationMonths: row.duration_months ?? undefined,
    totalDue: num(row.total_due),
    rejectionReason: row.rejection_reason ?? undefined,
    adminNotes: row.admin_notes ?? undefined,
    offeredAt: row.offered_at ?? undefined,
    disbursedAt: row.disbursed_at ?? undefined,
    repaidAmount: Number(row.repaid_amount ?? 0),
    createdAt: row.created_at,
    installments: ((row.credit_installments ?? []) as Record<string, any>[])
      .map(mapInstallment)
      .sort((a, b) => a.number - b.number),
  };
}

/** Un dossier « ouvert » empêche d'en déposer un autre. */
export const isOpenApplication = (a: CreditApplication) =>
  a.status === 'submitted' || a.status === 'offered' || a.status === 'active';

/** Ce qu'il reste à rembourser sur un crédit en cours. */
export const remainingDue = (a: CreditApplication) => Math.max(0, (a.totalDue ?? 0) - a.repaidAmount);

/** La prochaine mensualité non soldée, la plus ancienne d'abord. */
export const nextInstallment = (a: CreditApplication) => a.installments.find((i) => i.status !== 'paid');

/** Plafond indicatif : 2 × l'épargne versée, 5 000 F minimum (même règle côté serveur). */
export const CREDIT_FLOOR = 5000;
export const creditCap = (totalSaved: number) => Math.max(CREDIT_FLOOR, Math.round(totalSaved * 2));

export const CREDIT_MAX_MONTHS = 24;
export const CREDIT_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

export async function fetchCreditApplicationFee(): Promise<number> {
  const { data } = await supabase.from('platform_settings').select('credit_application_fee').eq('id', 1).maybeSingle();
  return data?.credit_application_fee != null ? Number(data.credit_application_fee) : 1000;
}

export async function fetchMyCreditApplications(userId: string): Promise<CreditApplication[]> {
  const { data, error } = await supabase
    .from('credit_applications')
    .select('*, credit_installments(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapApplication);
}

/**
 * Envoie la vidéo dans l'espace privé de la personne et renvoie son chemin.
 * L'envoi a lieu AVANT le dépôt (et donc avant les frais) : si le réseau
 * coupe, la personne n'a rien payé.
 */
export async function uploadCreditVideo(userId: string, file: File): Promise<{ path?: string; error?: string }> {
  if (!file.type.startsWith('video/')) return { error: 'Ce fichier n’est pas une vidéo.' };
  if (file.size > CREDIT_VIDEO_MAX_BYTES) {
    return { error: 'La vidéo dépasse 50 Mo. Filmez plus court (environ 1 minute) ou envoyez plutôt un lien.' };
  }
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('credit-videos').upload(path, file, { contentType: file.type });
  if (error) return { error: `Échec de l'envoi de la vidéo : ${error.message}` };
  return { path };
}

/** Lien temporaire (5 min) pour regarder une vidéo privée. */
export async function getCreditVideoUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('credit-videos').createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<Result> {
  if (isOffline()) return { success: false, message: OFFLINE_MONEY_MESSAGE };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { success: false, message: error.message };
  return data as Result;
}

export function submitCreditApplication(params: {
  serviceId: string;
  projectTitle: string;
  projectDescription: string;
  requestedAmount: number;
  requestedMonths: number;
  videoPath?: string;
  videoUrl?: string;
  idempotencyKey: string;
}): Promise<Result> {
  return rpc('submit_credit_application', {
    p_service_id: params.serviceId,
    p_project_title: params.projectTitle,
    p_project_description: params.projectDescription,
    p_requested_amount: params.requestedAmount,
    p_requested_months: params.requestedMonths,
    p_video_path: params.videoPath ?? null,
    p_video_url: params.videoUrl ?? null,
    p_idempotency_key: params.idempotencyKey,
  });
}

export const acceptCreditOffer = (applicationId: string) =>
  rpc('accept_credit_offer', { p_application_id: applicationId });

export const declineCreditOffer = (applicationId: string) =>
  rpc('decline_credit_offer', { p_application_id: applicationId });

export const repayCredit = (applicationId: string, amount: number, idempotencyKey: string) =>
  rpc('repay_credit', { p_application_id: applicationId, p_amount: amount, p_idempotency_key: idempotencyKey });

// ---------------------------------------------------------------- Équipe ---

export type CreditApplicationForReview = CreditApplication & {
  userName: string;
  userEmail: string;
  userTotalSaved: number;
  userReputation: number;
  serviceTitle: string;
};

export async function fetchCreditApplicationsForReview(): Promise<CreditApplicationForReview[]> {
  const { data, error } = await supabase
    .from('credit_applications')
    .select('*, credit_installments(*), profiles!credit_applications_user_id_fkey(display_name, email, total_saved, reputation_score), marketplace_services(title)')
    .in('status', ['submitted', 'offered', 'active'])
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((row: any) => ({
    ...mapApplication(row),
    userName: row.profiles?.display_name || 'Utilisateur',
    userEmail: row.profiles?.email || '',
    userTotalSaved: Number(row.profiles?.total_saved ?? 0),
    userReputation: Number(row.profiles?.reputation_score ?? 0),
    serviceTitle: row.marketplace_services?.title || 'Crédit',
  }));
}

/** Total à rembourser pour une offre, calculé comme le serveur (intérêt simple, au franc). */
export const offerTotal = (amount: number, ratePercent: number) =>
  Math.round(amount) + Math.round((Math.round(amount) * ratePercent) / 100);

export const makeCreditOffer = (params: {
  applicationId: string;
  offeredAmount: number;
  interestRate: number;
  durationMonths: number;
  adminNotes?: string;
}) =>
  rpc('make_credit_offer', {
    p_application_id: params.applicationId,
    p_offered_amount: params.offeredAmount,
    p_interest_rate: params.interestRate,
    p_duration_months: params.durationMonths,
    p_admin_notes: params.adminNotes || null,
  });

export const rejectCreditApplication = (applicationId: string, reason: string) =>
  rpc('reject_credit_application', { p_application_id: applicationId, p_reason: reason });
