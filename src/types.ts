export type Frequency = 'daily' | 'weekly' | 'bi-weekly' | 'monthly';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  reputationScore: number; // 0-100
  totalSaved: number;
  groupsJoined: number;
  createdAt: string;
  role: 'user' | 'admin';
  walletBalance: number; // Virtual wallet balance (FCFA)
  language?: string;
  theme?: 'light' | 'dark';
  securityPin?: string;
  pinFailedAttempts?: number;
  pinLockedUntil?: string;
  biometricsEnabled?: boolean;
  fcmToken?: string;
  pushEnabled?: boolean;
  emailNotificationsEnabled?: boolean;
  kycLevel?: number;
  kycVerifiedAt?: string;
  mandateName?: string;
  mandatePhone?: string;
  mandatePermissions?: string[];
}

export interface KycSubmission {
  id: string;
  userId: string;
  fullName: string;
  idNumber?: string;
  documentPath: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export type GroupMemberRole = 'member' | 'treasurer' | 'secretary';

export interface Group {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  members: string[]; // Array of UIDs
  pendingMembers?: string[]; // Array of UIDs awaiting admin approval to join
  memberRoles?: Record<string, GroupMemberRole>; // uid -> role within this group
  contributionAmount: number;
  frequency: Frequency;
  startDate: string;
  endDate?: string;
  nextPayoutDate: string;
  status: 'active' | 'completed' | 'pending';
  payoutOrder: string[]; // Array of UIDs in order of payout
  currentPayoutIndex: number;
  currency: string;
  joinCode?: string;
  isPrivate?: boolean;
  maxMembers?: number;
  rules?: string;
  lastReminderSentAt?: string;
  distributionMethod?: 'sequential' | 'draw' | 'auction';
  penaltyRate?: number;
  penaltyType?: 'percentage' | 'fixed';
  penaltyAmount?: number;
  gracePeriod?: number;
  activeAuction?: {
    round: number;
    highestBid: number;
    highestBidderId: string;
    highestBidderName: string;
    endTime: string;
    status: 'active' | 'closed';
    bids: Array<{
      userId: string;
      userName: string;
      bidAmount: number;
      timestamp: string;
    }>;
  };
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'reminder' | 'payout' | 'system' | 'chat';
  read: boolean;
  createdAt: any;
  link?: string;
}

export interface Contribution {
  id: string;
  groupId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  amount: number;
  date: string;
  status: 'paid' | 'pending' | 'late' | 'pending_approval';
  period?: string;
  proofOfPayment?: {
    reference: string;
    submittedAt: string;
    notes?: string;
  };
  penaltyApplied?: number;
  penaltyStatus?: 'none' | 'pending' | 'paid';
  notifiedInsufficient?: boolean;
  paymentMethod?: string;
  debitedAt?: string;
  idempotencyKey?: string;
}

export interface Payout {
  id: string;
  groupId: string;
  userId: string;
  amount: number;
  date: string;
  discountAmount?: number;
  currency?: string;
  cycle?: number;
  transactionId?: string;
}

export interface Invitation {
  id: string;
  groupId: string;
  inviterId: string;
  inviteeEmail: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface Message {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  content: string;
  createdAt: any; // Using any for Firestore timestamp compatibility
}

export interface WalletTransaction {
  id: string;
  userId: string;
  amount: number; // Positive for credit/recharge, negative for debit/contribution
  type: 'recharge' | 'contribution_debit' | 'payout_credit' | 'payout_deduction' | 'withdraw';
  description: string;
  date: string;
  status: 'completed' | 'failed' | 'pending';
  reference?: string; // Paydunya checkout session ID or reference
  paymentMethod?: string; // e.g., 'paydunya' | 'wallet'
}

export interface GroupDocument {
  id: string;
  groupId: string;
  uploaderId: string;
  uploaderName: string;
  name: string;
  category: 'statuts' | 'contrat' | 'pv' | 'justificatif' | 'autre';
  url?: string; // signed URL, fetched on-demand (private Supabase Storage bucket)
  storagePath: string;
  size: number;
  contentType: string;
  uploadedAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  message: string;
  status: 'open' | 'resolved';
  createdAt: any;
}

