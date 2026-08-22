import { Contribution, Group, GroupDocument, KycSubmission, Message, Notification, Payout, UserProfile, WalletTransaction } from '@/types';
import { LedgerEntry, AuditLog } from '@/lib/ledger';

export function mapProfileRow(row: Record<string, any>): UserProfile {
  return {
    uid: row.id,
    email: row.email,
    displayName: row.display_name,
    photoURL: row.avatar_url ?? undefined,
    reputationScore: row.reputation_score,
    totalSaved: Number(row.total_saved),
    groupsJoined: row.groups_joined,
    createdAt: row.created_at,
    role: row.role,
    walletBalance: Number(row.wallet_balance),
    language: row.language ?? undefined,
    theme: row.theme ?? undefined,
    pinFailedAttempts: row.pin_failed_attempts,
    pinLockedUntil: row.pin_locked_until ?? undefined,
    biometricsEnabled: row.biometrics_enabled,
    fcmToken: row.fcm_token ?? undefined,
    pushEnabled: row.push_enabled,
    emailNotificationsEnabled: row.email_notifications_enabled,
    kycLevel: row.kyc_level ?? 1,
    kycVerifiedAt: row.kyc_verified_at ?? undefined,
    mandateName: row.mandate_name ?? undefined,
    mandatePhone: row.mandate_phone ?? undefined,
    mandatePermissions: row.mandate_permissions ?? undefined,
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    dateOfBirth: row.date_of_birth ?? undefined,
    phone: row.phone ?? undefined,
  };
}

export function mapKycSubmissionRow(row: Record<string, any>): KycSubmission {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    idNumber: row.id_number ?? undefined,
    documentPath: row.document_path,
    status: row.status,
    rejectionReason: row.rejection_reason ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    createdAt: row.created_at,
  };
}

/**
 * Reconstructs the members[]/pendingMembers[]/memberRoles{}/payoutOrder[]
 * shape every not-yet-migrated component still expects, from a group_members
 * join-table result — so those components don't need to change until their
 * own migration lot.
 */
export function mapGroupRow(row: Record<string, any>, members: Record<string, any>[]): Group {
  const active = members.filter((m) => m.status === 'active');
  const pending = members.filter((m) => m.status === 'pending');
  const payoutOrder = [...active]
    .sort((a, b) => (a.payout_position ?? Infinity) - (b.payout_position ?? Infinity))
    .map((m) => m.user_id);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    creatorId: row.creator_id,
    members: active.map((m) => m.user_id),
    pendingMembers: pending.map((m) => m.user_id),
    memberRoles: Object.fromEntries(active.map((m) => [m.user_id, m.role])),
    contributionAmount: Number(row.contribution_amount),
    frequency: row.frequency,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    nextPayoutDate: row.next_payout_date,
    status: row.status,
    payoutOrder,
    currentPayoutIndex: row.current_payout_index,
    currency: row.currency,
    joinCode: row.join_code ?? undefined,
    isPrivate: row.is_private,
    maxMembers: row.max_members ?? undefined,
    rules: row.rules ?? undefined,
    lastReminderSentAt: row.last_reminder_period ?? undefined,
    distributionMethod: row.distribution_method ?? undefined,
    drawnBeneficiaryId: row.drawn_beneficiary_id ?? null,
    penaltyRate: row.penalty_rate ?? undefined,
    penaltyType: row.penalty_type ?? undefined,
    penaltyAmount: row.penalty_amount ?? undefined,
    gracePeriod: row.grace_period ?? undefined,
  };
}

export function mapContributionRow(row: Record<string, any>): Contribution {
  return {
    id: row.id,
    groupId: row.group_id,
    userId: row.user_id,
    userName: row.user_name ?? undefined,
    userEmail: row.user_email ?? undefined,
    amount: Number(row.amount),
    date: row.date,
    status: row.status,
    period: row.period ?? undefined,
    proofOfPayment: row.proof_reference
      ? { reference: row.proof_reference, submittedAt: row.proof_submitted_at }
      : undefined,
    penaltyApplied: row.penalty_applied != null ? Number(row.penalty_applied) : undefined,
    penaltyStatus: row.penalty_status ?? undefined,
    notifiedInsufficient: row.notified_insufficient,
    paymentMethod: row.payment_method ?? undefined,
    debitedAt: row.debited_at ?? undefined,
    idempotencyKey: row.idempotency_key ?? undefined,
  };
}

export function mapWalletTransactionRow(row: Record<string, any>): WalletTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    amount: Number(row.amount),
    type: row.type,
    description: row.description,
    date: row.date,
    status: row.status,
    reference: row.reference ?? undefined,
    paymentMethod: row.payment_method ?? undefined,
  };
}

export function mapPayoutRow(row: Record<string, any>): Payout {
  return {
    id: row.id,
    groupId: row.group_id,
    userId: row.user_id,
    amount: Number(row.amount),
    date: row.date,
    discountAmount: row.discount_amount != null ? Number(row.discount_amount) : undefined,
    currency: row.currency ?? undefined,
    cycle: row.cycle ?? undefined,
    transactionId: row.transaction_id ?? undefined,
  };
}

export function mapMessageRow(row: Record<string, any>): Message {
  return {
    id: row.id,
    groupId: row.group_id,
    userId: row.user_id ?? 'system',
    userName: row.user_name,
    userPhoto: row.user_photo ?? undefined,
    content: row.content,
    createdAt: row.created_at,
  };
}

export function mapLedgerEntryRow(row: Record<string, any>): LedgerEntry {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    idempotencyKey: row.idempotency_key,
    account: row.account,
    counterparty: row.counterparty,
    type: row.type,
    amount: Number(row.amount),
    currency: row.currency,
    description: row.description,
    createdAt: row.created_at,
  };
}

export function mapAuditLogRow(row: Record<string, any>): AuditLog {
  return {
    id: row.id,
    userId: row.user_id,
    action: row.action,
    details: row.details,
    ip: row.ip,
    device: row.device,
    timestamp: row.timestamp,
    status: row.status,
    idempotencyKey: row.idempotency_key ?? undefined,
  };
}

export function mapReconciliationReportRow(row: Record<string, any>) {
  return {
    id: row.id,
    timestamp: row.timestamp,
    totalUsersChecked: row.total_users_checked,
    totalLedgerEntriesChecked: row.total_ledger_entries_checked,
    totalDiscrepancies: Number(row.total_discrepancies),
    status: row.status,
    executedBy: row.executed_by,
  };
}

export function mapGroupDocumentRow(row: Record<string, any>): GroupDocument {
  return {
    id: row.id,
    groupId: row.group_id,
    uploaderId: row.uploader_id,
    uploaderName: row.uploader_name,
    name: row.name,
    category: row.category,
    storagePath: row.storage_path,
    size: row.size,
    contentType: row.content_type,
    uploadedAt: row.created_at,
  };
}

export function mapNotificationRow(row: Record<string, any>): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    message: row.message,
    type: row.type,
    read: row.read,
    createdAt: row.created_at,
    link: row.link ?? undefined,
  };
}
