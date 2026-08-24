import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { mapProfileRow, mapLedgerEntryRow, mapAuditLogRow, mapReconciliationReportRow } from '@/lib/mappers';
import { hydrateGroups } from '@/lib/groups';
import { UserProfile, Group } from '@/types';
import { LedgerEntry, AuditLog, performFullSystemReconciliation, fetchPendingWithdrawals, completeWithdrawal, failWithdrawal, PendingWithdrawal } from '@/lib/ledger';
import { fetchPendingKycSubmissions, getKycDocumentUrl, reviewKycSubmission } from '@/lib/kyc';
import { fetchPendingMarketplaceRequests, updateMarketplaceRequestStatus, approveMarketplaceCredit } from '@/lib/marketplace';
import { fetchPlatformSettings, updatePlatformSettings } from '@/lib/platformSettings';
import { KycSubmission, MarketplaceRequest } from '@/types';
import { notifyUser } from '@/lib/notify';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Loader2, 
  Trash2, 
  Shield, 
  User, 
  Users as GroupsIcon, 
  Settings, 
  Search, 
  DollarSign, 
  Award, 
  TrendingUp, 
  Coins, 
  ChevronRight, 
  Sparkles,
  Sliders,
  Check,
  AlertTriangle,
  Activity,
  BookOpen,
  ShieldCheck,
  RefreshCw,
  FileText,
  Terminal,
  ArrowUpRight,
  ArrowDownLeft,
  Lock,
  Clock,
  History,
  BadgeCheck,
  Eye,
  X,
  Store,
  ChevronLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { CustomAvatar } from './CustomAvatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';

function handleAdminError(error: unknown, path: string) {
  console.error('Admin Error: ', JSON.stringify({ error: error instanceof Error ? error.message : String(error), path, context: 'AdminDashboard' }));
  throw error;
}

export function AdminDashboard() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Interactive search & filter states
  const [userSearch, setUserSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [groupStatusFilter, setGroupStatusFilter] = useState<'all' | 'active' | 'pending' | 'completed'>('all');

  // Selected user for adjustments (Reputation score / walletBalance)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [reputationInput, setReputationInput] = useState<number>(75);
  const [walletInput, setWalletInput] = useState<number>(0);
  const [isSavingUserChanges, setIsSavingUserChanges] = useState(false);

  // Platform settings (persisted in public.platform_settings, enforced app-wide)
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [allowSignups, setAllowSignups] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Ledger & Reconciliation States
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [reconReports, setReconReports] = useState<any[]>([]);
  const [isReconciling, setIsReconciling] = useState(false);

  // Pending Mobile Money withdrawal queue (manual disbursement — Paydunya has no payout API)
  const [pendingWithdrawals, setPendingWithdrawals] = useState<PendingWithdrawal[]>([]);
  const [processingWithdrawalId, setProcessingWithdrawalId] = useState<string | null>(null);

  // KYC review queue
  const [kycSubmissions, setKycSubmissions] = useState<(KycSubmission & { userName: string; userEmail: string })[]>([]);
  const [reviewingKycId, setReviewingKycId] = useState<string | null>(null);

  // Marketplace request queue
  const [marketplaceRequests, setMarketplaceRequests] = useState<(MarketplaceRequest & { userName: string; userEmail: string; userTotalSaved: number; serviceTitle: string; serviceCategory: string })[]>([]);

  // Mobile drill-down: null = showing the section menu, otherwise the id of the
  // entered section. Desktop ignores this and always shows the tab strip + content
  // side by side — this only changes how the same Tabs are presented on phones.
  const [adminSection, setAdminSection] = useState<string | null>(null);
  const handleAdminBack = React.useCallback(() => {
    if (adminSection === null) return false;
    setAdminSection(null);
    return true;
  }, [adminSection]);
  useBackHandler(handleAdminBack, true);
  const [creditApprovalForm, setCreditApprovalForm] = useState<Record<string, { amount: string; deadline: string }>>({});
  const [approvingCreditId, setApprovingCreditId] = useState<string | null>(null);
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: userRows, error: usersError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (usersError) throw usersError;
      setUsers((userRows ?? []).map(mapProfileRow));

      const { data: groupRows, error: groupsError } = await supabase.from('groups').select('*').order('created_at', { ascending: false });
      if (groupsError) throw groupsError;
      setGroups(await hydrateGroups(groupRows ?? []));

      // Graceful fetch of Ledger & Reconciliation data (admin-only tables)
      const { data: ledgerRows, error: ledgerError } = await supabase.from('double_entry_ledger').select('*').order('created_at', { ascending: false });
      if (ledgerError) console.warn("Ledger fetch failed:", ledgerError);
      else setLedgerEntries((ledgerRows ?? []).map(mapLedgerEntryRow));

      const { data: auditRows, error: auditError } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false });
      if (auditError) console.warn("Audit logs fetch failed:", auditError);
      else setAuditLogs((auditRows ?? []).map(mapAuditLogRow));

      const { data: reconRows, error: reconError } = await supabase.from('reconciliation_reports').select('*').order('timestamp', { ascending: false });
      if (reconError) console.warn("Reconciliation reports fetch failed:", reconError);
      else setReconReports((reconRows ?? []).map(mapReconciliationReportRow));

      setKycSubmissions(await fetchPendingKycSubmissions());
      setMarketplaceRequests(await fetchPendingMarketplaceRequests());
      setPendingWithdrawals(await fetchPendingWithdrawals());

      const settings = await fetchPlatformSettings();
      setMaintenanceMode(settings.maintenanceMode);
      setAllowSignups(settings.allowSignups);

    } catch (error) {
      handleAdminError(error, 'admin_collections');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerReconciliation = async () => {
    setIsReconciling(true);
    toast.info(t('admin_recon_starting'));
    try {
      const result = await performFullSystemReconciliation();
      if (result.success && result.report) {
        toast.success(t('admin_recon_success'));
        // Reload data to reflect reports and audit logs
        await fetchData();
      } else {
        toast.error(result.message || t('admin_recon_failed'));
      }
    } catch (error: any) {
      console.error("Reconciliation error:", error);
      toast.error(error.message || t('admin_recon_error'));
    } finally {
      setIsReconciling(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleViewKycDocument = async (documentPath: string) => {
    const url = await getKycDocumentUrl(documentPath);
    if (!url) {
      toast.error("Impossible d'ouvrir le document.");
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleReviewKyc = async (submissionId: string, approve: boolean) => {
    let rejectionReason: string | undefined;
    if (!approve) {
      rejectionReason = window.prompt("Motif du refus (visible par l'utilisateur) :") || undefined;
      if (rejectionReason === undefined) return;
    }
    setReviewingKycId(submissionId);
    try {
      const result = await reviewKycSubmission({ submissionId, approve, rejectionReason });
      if (!result.success) throw new Error(result.message);
      toast.success(approve ? "Identité validée." : "Vérification refusée.");
      setKycSubmissions(prev => prev.filter(s => s.id !== submissionId));
    } catch (error: any) {
      toast.error(error.message || "Erreur lors du traitement de la vérification.");
    } finally {
      setReviewingKycId(null);
    }
  };

  const handleReviewMarketplaceRequest = async (requestId: string, status: 'contacted' | 'approved' | 'rejected', notifyUserId: string, serviceTitle: string) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    setReviewingRequestId(requestId);
    try {
      const result = await updateMarketplaceRequestStatus({ requestId, status, reviewerId: authUser.id });
      if (!result.success) throw new Error(result.message);
      toast.success('Demande mise à jour.');
      setMarketplaceRequests(prev => prev.filter(r => r.id !== requestId));

      const statusMessages: Record<typeof status, string> = {
        contacted: `Notre équipe vous a contacté au sujet de votre demande pour "${serviceTitle}".`,
        approved: `Votre demande pour "${serviceTitle}" a été approuvée !`,
        rejected: `Votre demande pour "${serviceTitle}" n'a pas pu être retenue.`,
      };
      await notifyUser({
        userId: notifyUserId,
        title: 'Marketplace — mise à jour de votre demande',
        message: statusMessages[status],
        type: 'system',
      });
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du traitement de la demande.');
    } finally {
      setReviewingRequestId(null);
    }
  };

  const getCreditForm = (req: { id: string; requestedAmount?: number }) => {
    if (creditApprovalForm[req.id]) return creditApprovalForm[req.id];
    const defaultDeadline = new Date();
    defaultDeadline.setDate(defaultDeadline.getDate() + 30);
    return {
      amount: req.requestedAmount != null ? String(req.requestedAmount) : '',
      deadline: defaultDeadline.toISOString().slice(0, 10),
    };
  };

  const setCreditFormField = (requestId: string, field: 'amount' | 'deadline', value: string, req: { id: string; requestedAmount?: number }) => {
    setCreditApprovalForm(prev => ({ ...prev, [requestId]: { ...getCreditForm(req), ...prev[requestId], [field]: value } }));
  };

  const handleApproveCredit = async (req: { id: string; userId: string; serviceTitle: string; requestedAmount?: number }) => {
    const form = getCreditForm(req);
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      toast.error('Veuillez indiquer un montant à décaisser.');
      return;
    }
    if (!form.deadline) {
      toast.error("Veuillez indiquer une date d'échéance de remboursement.");
      return;
    }
    setApprovingCreditId(req.id);
    try {
      const result = await approveMarketplaceCredit({ requestId: req.id, approvedAmount: amount, repaymentDeadline: form.deadline });
      if (!result.success) throw new Error(result.message);
      toast.success(`Crédit de ${amount.toLocaleString()} FCFA décaissé pour "${req.serviceTitle}".`);
      setMarketplaceRequests(prev => prev.filter(r => r.id !== req.id));
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'approbation du crédit.");
    } finally {
      setApprovingCreditId(null);
    }
  };

  const handleCompleteWithdrawal = async (w: PendingWithdrawal) => {
    setProcessingWithdrawalId(w.id);
    try {
      const result = await completeWithdrawal(w.id);
      if (!result.success) throw new Error(result.message);
      toast.success(`Retrait de ${w.amount.toLocaleString()} FCFA marqué comme envoyé.`);
      setPendingWithdrawals(prev => prev.filter(p => p.id !== w.id));
      await notifyUser({
        userId: w.userId,
        title: 'Retrait effectué',
        message: `Votre retrait de ${w.amount.toLocaleString()} FCFA vers ${w.paymentMethod.toUpperCase()} a été envoyé.`,
        type: 'system',
      });
    } catch (error: any) {
      toast.error(error.message || "Erreur lors du traitement du retrait.");
    } finally {
      setProcessingWithdrawalId(null);
    }
  };

  const handleFailWithdrawal = async (w: PendingWithdrawal) => {
    const reason = window.prompt("Motif de l'échec (le portefeuille sera remboursé) :") || undefined;
    setProcessingWithdrawalId(w.id);
    try {
      const result = await failWithdrawal({ transactionId: w.id, userId: w.userId, amount: w.amount, reason });
      if (!result.success) throw new Error(result.message);
      toast.success('Retrait annulé, portefeuille remboursé.');
      setPendingWithdrawals(prev => prev.filter(p => p.id !== w.id));
      await notifyUser({
        userId: w.userId,
        title: 'Retrait échoué — remboursé',
        message: `Votre retrait de ${w.amount.toLocaleString()} FCFA n'a pas pu être effectué${reason ? ` (${reason})` : ''}. Le montant a été recrédité sur votre portefeuille.`,
        type: 'system',
      });
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'annulation du retrait.");
    } finally {
      setProcessingWithdrawalId(null);
    }
  };

  const handleToggleRole = async (user: UserProfile) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      const { data, error } = await supabase.from('profiles').update({ role: newRole }).eq('id', user.uid).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Action non autorisée.');
      toast.success(`${t('admin_role_updated')}: ${user.displayName} → ${newRole}`);

      setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, role: newRole } : u));
      if (editingUser?.uid === user.uid) {
        setEditingUser(prev => prev ? { ...prev, role: newRole } : null);
      }
    } catch (error) {
      toast.error(t('admin_role_error'));
    }
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (!confirm(t('admin_confirm_delete_user'))) return;
    try {
      // Removes the profile row only (deleting the underlying Supabase Auth
      // account requires a service-role server call, same limitation as the
      // old Firestore version which only ever removed the profile document).
      const { data, error } = await supabase.from('profiles').delete().eq('id', userId).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Action non autorisée.');
      toast.success(`${t('admin_user_deleted')}: ${name}`);
      setUsers(prev => prev.filter(u => u.uid !== userId));
      if (editingUser?.uid === userId) {
        setEditingUser(null);
      }
    } catch (error) {
      toast.error(t('admin_user_delete_error'));
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!confirm(t('admin_confirm_delete_group'))) return;
    try {
      const { data, error } = await supabase.from('groups').delete().eq('id', groupId).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Action non autorisée.');
      toast.success(`${t('admin_group_deleted')}: ${groupName}`);
      setGroups(prev => prev.filter(g => g.id !== groupId));
    } catch (error) {
      toast.error(t('admin_group_delete_error'));
    }
  };

  const handleSelectUserToEdit = (user: UserProfile) => {
    setEditingUser(user);
    setReputationInput(user.reputationScore);
    setWalletInput(user.walletBalance || 0);
  };

  const handleSaveUserTuning = async () => {
    if (!editingUser) return;
    setIsSavingUserChanges(true);

    // Bounds checking
    const finalRep = Math.max(0, Math.min(100, Number(reputationInput)));
    const finalWallet = Math.max(0, Number(walletInput));

    try {
      const { data, error } = await supabase.from('profiles').update({
        reputation_score: finalRep,
        wallet_balance: finalWallet
      }).eq('id', editingUser.uid).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Action non autorisée.');

      toast.success(`${t('admin_profile_adjusted')}: ${editingUser.displayName}`);
      
      // Sync UI state
      setUsers(prev => prev.map(u => u.uid === editingUser.uid ? { ...u, reputationScore: finalRep, walletBalance: finalWallet } : u));
      setEditingUser(null);
    } catch (error) {
      toast.error(t('admin_save_error'));
    } finally {
      setIsSavingUserChanges(false);
    }
  };

  // --- STATS CALCULATIONS ---
  const totalUsers = users.length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  const standardUsersCount = totalUsers - adminCount;

  const totalGroupsCount = groups.length;
  const activeGroupsCount = groups.filter(g => g.status === 'active').length;
  const pendingGroupsCount = groups.filter(g => g.status === 'pending').length;

  // Global Platform Volume calculation: Sum of all group targets (members * contributionAmount)
  const totalPlatformVolume = groups.reduce((acc, g) => {
    const multiplier = g.members?.length || 0;
    return acc + (g.contributionAmount * multiplier);
  }, 0);

  // Average Platform Reputation calculation
  const averageReputation = totalUsers > 0 
    ? Math.round(users.reduce((acc, u) => acc + (u.reputationScore || 0), 0) / totalUsers)
    : 0;

  // Filters logic
  const filteredUsers = users.filter(u => {
    const matchSearch = u.displayName.toLowerCase().includes(userSearch.toLowerCase()) || 
                        u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchRole = userRoleFilter === 'all' ? true : u.role === userRoleFilter;
    return matchSearch && matchRole;
  });

  const filteredGroups = groups.filter(g => {
    const matchSearch = g.name.toLowerCase().includes(groupSearch.toLowerCase()) || 
                        g.description.toLowerCase().includes(groupSearch.toLowerCase());
    const matchStatus = groupStatusFilter === 'all' ? true : g.status === groupStatusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-muted-foreground">
        <Loader2 className="w-10 h-10 animate-spin text-brand" />
        <p className="text-xs font-bold tracking-wider uppercase">{t('admin_loading')}</p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="max-w-6xl mx-auto space-y-8 pb-12"
    >
      {/* Header and Branding section */}
      <div className="bg-[#4B2E05] text-white p-6 md:p-8 rounded-3xl border border-border shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-brand text-primary-foreground text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full">
                {t('admin_super_admin_space')}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-serif font-black tracking-tight text-[#F5E6D3]">
              {t('admin_panel_title')}
            </h1>
            <p className="text-xs text-[#F5E6D3]/75 mt-1 font-medium max-w-xl leading-relaxed">
              {t('admin_panel_subtitle')}
            </p>
          </div>

          <Button
            onClick={fetchData}
            variant="outline"
            size="sm"
            className="self-start md:self-center border-border text-[#F5E6D3] bg-white/5 hover:bg-white/10 hover:text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer"
          >
            {t('admin_refresh_data')}
          </Button>
        </div>
      </div>

      {/* --- PLATFORM STATISTICS GRID --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Users */}
        <Card className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wide">{t('admin_registered_members')}</span>
              <span className="text-3xl font-serif font-black text-foreground block">{totalUsers}</span>
              <span className="text-[10px] text-muted-foreground font-medium block">
                {standardUsersCount} {t('admin_users_word')} • {adminCount} {t('admin_admins_word')}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand">
              <User className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Groups */}
        <Card className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wide">{t('admin_tontine_circles')}</span>
              <span className="text-3xl font-serif font-black text-foreground block">{totalGroupsCount}</span>
              <span className="text-[10px] text-muted-foreground font-medium block">
                {activeGroupsCount} {t('admin_active_word')} • {pendingGroupsCount} {t('status_pending')}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
              <GroupsIcon className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Platform Volume */}
        <Card className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wide">{t('admin_cumulative_volume')}</span>
              <span className="text-xl font-serif font-black text-foreground block truncate max-w-[160px]">
                {totalPlatformVolume.toLocaleString()} F CFA
              </span>
              <span className="text-[10px] text-muted-foreground font-medium block">
                {t('admin_total_savings_goals')}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Reputation health */}
        <Card className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1 w-full">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wide">{t('admin_reputation_health')}</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-serif font-black text-foreground">{averageReputation}</span>
                <span className="text-xs font-black text-secondary">/ 100</span>
              </div>

              {/* Micro visual progress bar */}
              <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-brand rounded-full"
                  style={{ width: `${averageReputation}%` }}
                />
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 shrink-0">
              <Award className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* --- INTERACTIVE USER TUNING BAR (CONDITIONAL) --- */}
      <AnimatePresence>
        {editingUser && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            className="p-1"
          >
            <Card className="border-2 border-brand bg-muted rounded-3xl overflow-hidden shadow-md">
              <CardHeader className="bg-brand/5 p-5 border-b border-border flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-brand font-black uppercase tracking-wide">
                    <Sliders className="w-4 h-4" />
                    {t('admin_member_config_console')}
                  </div>
                  <CardTitle className="text-sm font-serif font-bold text-foreground mt-1">
                    {t('admin_adjustment_of')} {editingUser.displayName}
                  </CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingUser(null)}
                  className="text-muted-foreground hover:text-foreground font-bold text-xs hover:bg-muted/50 cursor-pointer"
                >
                  {t('cancel')}
                </Button>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                {/* Field 1: Reputation Score */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase text-foreground flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-brand" />
                    {t('admin_reputation_score_range')}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={reputationInput}
                      onChange={(e) => setReputationInput(Number(e.target.value))}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-brand"
                    />
                    <span className="text-sm font-serif font-black px-2.5 py-1 bg-card border border-border rounded-xl text-foreground w-12 text-center">
                      {reputationInput}
                    </span>
                  </div>
                </div>

                {/* Field 2: Solde Portefeuille */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase text-foreground flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-secondary" />
                    {t('admin_virtual_wallet_balance')}
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={walletInput}
                      onChange={(e) => setWalletInput(Math.max(0, Number(e.target.value)))}
                      className="bg-card border-border focus-visible:ring-primary rounded-xl pl-9 font-serif font-black"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-serif text-sm">FCFA</span>
                  </div>
                </div>

                {/* Save controls */}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleSaveUserTuning}
                    disabled={isSavingUserChanges}
                    className="flex-1 bg-primary text-primary-foreground font-black text-xs uppercase tracking-wider py-5 hover:bg-primary/90 rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {isSavingUserChanges ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                        {t('admin_applying')}
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-1.5" />
                        {t('admin_apply')}
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => handleToggleRole(editingUser)}
                    variant="outline"
                    className="border-border hover:bg-muted font-bold text-xs text-foreground px-3.5 rounded-xl cursor-pointer h-[44px]"
                    title={t('admin_toggle_role_title')}
                  >
                    <Shield className="w-4 h-4 text-brand" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- DETAILED MANAGEMENT SECTIONS --- */}
      {(() => {
        const adminSections = [
          { id: 'users', label: t('members'), icon: User, color: 'bg-brand/10 text-brand', count: 0 },
          { id: 'groups', label: t('admin_tab_groups'), icon: GroupsIcon, color: 'bg-secondary/10 text-secondary', count: 0 },
          { id: 'kyc', label: 'KYC', icon: BadgeCheck, color: 'bg-eganye-gold/10 text-eganye-gold', count: kycSubmissions.length },
          { id: 'marketplace', label: 'Marketplace', icon: Store, color: 'bg-brand/10 text-brand', count: marketplaceRequests.length },
          { id: 'ledger', label: t('admin_tab_ledger'), icon: BookOpen, color: 'bg-secondary/10 text-secondary', count: pendingWithdrawals.length },
          { id: 'settings', label: t('settings'), icon: Settings, color: 'bg-muted-foreground/10 text-muted-foreground', count: 0 },
        ];
        const currentSection = adminSections.find((s) => s.id === adminSection);
        return (
          <Tabs value={adminSection ?? 'users'} onValueChange={setAdminSection} className="w-full">
            {/* Desktop: classic tab strip — plenty of horizontal room */}
            <TabsList className="hidden md:grid w-full grid-cols-6 max-w-3xl bg-muted p-1 rounded-2xl">
              {adminSections.map((s) => (
                <TabsTrigger key={s.id} value={s.id} className="flex items-center gap-2 font-bold text-xs py-2 rounded-xl cursor-pointer">
                  <s.icon className="w-4 h-4" />
                  {s.label}
                  {s.count > 0 && (
                    <Badge className="bg-brand text-white text-[9px] h-4 px-1.5 border-none">{s.count}</Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Mobile: drill-down menu — tap a section to enter it, like a native settings screen */}
            {adminSection === null && (
              <div className="md:hidden bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
                {adminSections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setAdminSection(s.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-muted/60 transition-colors"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
                      <s.icon className="w-4.5 h-4.5" />
                    </div>
                    <span className="flex-1 font-bold text-sm text-foreground">{s.label}</span>
                    {s.count > 0 && (
                      <Badge className="bg-brand text-white text-[10px] h-5 px-1.5 border-none">{s.count}</Badge>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {/* Mobile: back header — only shown once a section is entered */}
            {adminSection !== null && currentSection && (
              <div className="md:hidden flex items-center gap-2 mb-1">
                <button
                  onClick={() => setAdminSection(null)}
                  className="p-2 -ml-2 rounded-xl text-foreground active:bg-muted/60 transition-colors"
                  aria-label={t('gd_back')}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${currentSection.color}`}>
                  <currentSection.icon className="w-3.5 h-3.5" />
                </div>
                <h2 className="font-serif font-bold text-base text-foreground">{currentSection.label}</h2>
              </div>
            )}

            {/* Content: on mobile, hidden while the menu is showing; on desktop, always visible */}
            <div className={adminSection === null ? 'hidden md:block' : ''}>

        {/* TAB 1: USER MANAGEMENT */}
        <TabsContent value="users" className="mt-6 space-y-4">
          <Card className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
            <CardHeader className="pb-4 bg-muted/30 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-serif font-bold text-foreground">
                  {t('admin_member_directory_mgmt')}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  {t('admin_member_directory_desc')}
                </CardDescription>
              </div>

              {/* Search and Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder={t('admin_search_name_email')}
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-9 h-9 bg-card border-border focus-visible:ring-primary text-xs rounded-xl"
                  />
                </div>

                <div className="flex gap-1 bg-muted p-0.5 rounded-xl">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setUserRoleFilter('all')}
                    className={`h-7 text-[10px] px-2.5 font-bold rounded-lg cursor-pointer ${userRoleFilter === 'all' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground'}`}
                  >
                    {t('all')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUserRoleFilter('admin')}
                    className={`h-7 text-[10px] px-2.5 font-bold rounded-lg cursor-pointer ${userRoleFilter === 'admin' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground'}`}
                  >
                    {t('admin_admins_word')}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/70 border-b">
                    <TableRow>
                      <TableHead className="text-muted-foreground uppercase font-black text-[9px] tracking-wider pl-6">{t('admin_profil_col')}</TableHead>
                      <TableHead className="text-muted-foreground uppercase font-black text-[9px] tracking-wider">Email</TableHead>
                      <TableHead className="text-muted-foreground uppercase font-black text-[9px] tracking-wider">{t('admin_role_col')}</TableHead>
                      <TableHead className="text-muted-foreground uppercase font-black text-[9px] tracking-wider text-center">{t('admin_reputation_col')}</TableHead>
                      <TableHead className="text-muted-foreground uppercase font-black text-[9px] tracking-wider text-right">{t('admin_wallet_col')}</TableHead>
                      <TableHead className="text-muted-foreground uppercase font-black text-[9px] tracking-wider text-right pr-6">{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-xs font-medium">
                          {t('admin_no_member_found')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((u) => (
                        <TableRow key={u.uid} className="hover:bg-muted/50 transition-colors">
                          <TableCell className="pl-6 font-bold text-foreground">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full overflow-hidden shrink-0">
                                <CustomAvatar photoURL={u.photoURL} name={u.displayName} size={36} />
                              </div>
                              <span className="text-xs truncate max-w-[120px]">{u.displayName}</span>
                            </div>
                          </TableCell>
                          
                          <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                          
                          <TableCell>
                            <Badge className={`text-[9px] font-bold px-2 py-0.5 border-none uppercase ${
                              u.role === 'admin' 
                                ? 'bg-brand/10 text-brand' 
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {u.role === 'admin' ? t('admin_administrator') : t('member')}
                            </Badge>
                          </TableCell>
                          
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`text-xs font-serif font-black ${
                                u.reputationScore >= 85 
                                  ? 'text-secondary' 
                                  : u.reputationScore >= 70 
                                  ? 'text-blue-600' 
                                  : u.reputationScore >= 50 
                                  ? 'text-brand' 
                                  : 'text-danger'
                              }`}>
                                {u.reputationScore}
                              </span>
                              <span className="text-[8px] uppercase tracking-wider font-bold text-muted-foreground">
                                {u.reputationScore >= 85 ? 'S-Tier' : u.reputationScore >= 70 ? 'A-Tier' : u.reputationScore >= 50 ? 'B-Tier' : 'C-Tier'}
                              </span>
                            </div>
                          </TableCell>
                          
                          <TableCell className="text-right font-serif font-black text-xs text-foreground">
                            {(u.walletBalance || 0).toLocaleString()} F CFA
                          </TableCell>
                          
                          <TableCell className="text-right pr-6">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSelectUserToEdit(u)}
                                className="h-8 px-2.5 text-[10px] font-black uppercase text-brand hover:bg-brand/10 hover:text-brand rounded-lg cursor-pointer"
                              >
                                {t('admin_adjust')}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleToggleRole(u)}
                                className={`h-8 w-8 p-0 rounded-lg cursor-pointer ${u.role === 'admin' ? 'text-brand' : 'text-muted-foreground hover:text-foreground'}`}
                                title={u.role === 'admin' ? t('admin_demote_user') : t('admin_promote_admin')}
                              >
                                <Shield className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDeleteUser(u.uid, u.displayName)}
                                className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger-soft cursor-pointer"
                                title={t('admin_delete_user')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: GROUP/TONTINE MANAGEMENT */}
        <TabsContent value="groups" className="mt-6">
          <Card className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
            <CardHeader className="pb-4 bg-muted/30 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-serif font-bold text-foreground">
                  {t('admin_active_circles_mgmt')}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  {t('admin_active_circles_desc')}
                </CardDescription>
              </div>

              {/* Group Search & Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder={t('admin_search_group')}
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    className="pl-9 h-9 bg-card border-border focus-visible:ring-primary text-xs rounded-xl"
                  />
                </div>

                <div className="flex gap-1 bg-muted p-0.5 rounded-xl">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setGroupStatusFilter('all')}
                    className={`h-7 text-[10px] px-2.5 font-bold rounded-lg cursor-pointer ${groupStatusFilter === 'all' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground'}`}
                  >
                    {t('all')}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setGroupStatusFilter('active')}
                    className={`h-7 text-[10px] px-2.5 font-bold rounded-lg cursor-pointer ${groupStatusFilter === 'active' ? 'bg-secondary text-white shadow-2xs' : 'text-muted-foreground'}`}
                  >
                    {t('admin_active_word')}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setGroupStatusFilter('pending')}
                    className={`h-7 text-[10px] px-2.5 font-bold rounded-lg cursor-pointer ${groupStatusFilter === 'pending' ? 'bg-brand text-white shadow-2xs' : 'text-muted-foreground'}`}
                  >
                    {t('status_pending')}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/70 border-b">
                    <TableRow>
                      <TableHead className="text-muted-foreground uppercase font-black text-[9px] tracking-wider pl-6">{t('admin_circle_name')}</TableHead>
                      <TableHead className="text-muted-foreground uppercase font-black text-[9px] tracking-wider text-center">{t('members')}</TableHead>
                      <TableHead className="text-muted-foreground uppercase font-black text-[9px] tracking-wider">{t('admin_installment_amount')}</TableHead>
                      <TableHead className="text-muted-foreground uppercase font-black text-[9px] tracking-wider">{t('admin_payout_cycle')}</TableHead>
                      <TableHead className="text-muted-foreground uppercase font-black text-[9px] tracking-wider text-center">{t('frequency')}</TableHead>
                      <TableHead className="text-muted-foreground uppercase font-black text-[9px] tracking-wider">{t('status')}</TableHead>
                      <TableHead className="text-muted-foreground uppercase font-black text-[9px] tracking-wider text-right pr-6">{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGroups.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs font-medium">
                          {t('admin_no_group_found')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredGroups.map((g) => {
                        const payoutCompleted = g.payoutOrder ? g.currentPayoutIndex : 0;
                        const totalPayoutRounds = g.members?.length || 0;
                        
                        return (
                          <TableRow key={g.id} className="hover:bg-muted/50 transition-colors">
                            <TableCell className="pl-6 font-bold text-foreground text-xs">
                              <div className="flex flex-col">
                                <span>{g.name}</span>
                                <span className="text-[10px] text-muted-foreground font-normal truncate max-w-[150px]">
                                  {t('admin_invite_code')} : {g.joinCode || t('admin_none_word')}
                                </span>
                              </div>
                            </TableCell>
                            
                            <TableCell className="text-center text-xs text-muted-foreground font-bold">
                              {g.members?.length || 0}
                            </TableCell>
                            
                            <TableCell className="text-xs font-serif font-black text-foreground">
                              {g.contributionAmount.toLocaleString()} {g.currency || 'XOF'}
                            </TableCell>
                            
                            <TableCell className="text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <span className="font-bold">{payoutCompleted}</span>
                                <span className="text-muted-foreground">/</span>
                                <span className="text-muted-foreground">{totalPayoutRounds} {t('admin_payouts_word')}</span>
                              </div>
                            </TableCell>
                            
                            <TableCell className="text-center text-xs">
                              <Badge variant="outline" className="text-[10px] font-bold border-border capitalize">
                                {g.frequency === 'daily' ? t('freq_daily') : g.frequency === 'weekly' ? t('freq_weekly') : g.frequency === 'monthly' ? t('freq_monthly') : g.frequency}
                              </Badge>
                            </TableCell>
                            
                            <TableCell>
                              <Badge className={`text-[9px] font-bold uppercase border-none px-2 py-0.5 ${
                                g.status === 'active' 
                                  ? 'bg-secondary/10 text-secondary' 
                                  : g.status === 'pending'
                                  ? 'bg-brand/10 text-brand'
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {g.status === 'active' ? t('admin_status_active') : g.status === 'pending' ? t('admin_status_init') : t('admin_status_closed')}
                              </Badge>
                            </TableCell>
                            
                            <TableCell className="text-right pr-6">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDeleteGroup(g.id, g.name)}
                                className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger-soft cursor-pointer"
                                title={t('admin_delete_group_perm')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: KYC IDENTITY VERIFICATION QUEUE */}
        <TabsContent value="kyc" className="mt-6">
          <Card className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
            <CardHeader className="pb-4 bg-muted/30 border-b border-border">
              <CardTitle className="text-lg font-serif font-bold text-foreground">
                File d'attente de vérification d'identité
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Approuvez ou refusez les pièces d'identité soumises par les membres avant qu'ils ne puissent créer ou rejoindre un cercle.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {kycSubmissions.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground text-xs font-medium">
                  Aucune vérification en attente.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {kycSubmissions.map((sub) => (
                    <div key={sub.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold text-foreground">{sub.fullName}</p>
                        <p className="text-[11px] text-muted-foreground">{sub.userName} • {sub.userEmail}</p>
                        {sub.idNumber && <p className="text-[11px] text-muted-foreground">N° pièce : {sub.idNumber}</p>}
                        <p className="text-[10px] text-muted-foreground">
                          Soumis le {new Date(sub.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewKycDocument(sub.documentPath)}
                          className="h-9 rounded-xl text-xs font-bold border-border"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5" />
                          Voir le document
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleReviewKyc(sub.id, true)}
                          disabled={reviewingKycId === sub.id}
                          className="h-9 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/90 text-white"
                        >
                          <Check className="w-3.5 h-3.5 mr-1.5" />
                          Valider
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReviewKyc(sub.id, false)}
                          disabled={reviewingKycId === sub.id}
                          className="h-9 w-9 p-0 rounded-xl border-danger/30 text-danger hover:bg-danger-soft"
                          title="Refuser"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: MARKETPLACE REQUEST QUEUE */}
        <TabsContent value="marketplace" className="mt-6">
          <Card className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
            <CardHeader className="pb-4 bg-muted/30 border-b border-border">
              <CardTitle className="text-lg font-serif font-bold text-foreground">
                Demandes de services partenaires
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Traitez les demandes soumises depuis la Marketplace (assurance, crédit, équipement...).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {marketplaceRequests.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground text-xs font-medium">
                  Aucune demande en attente.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {marketplaceRequests.map((req) => (
                    <div key={req.id} className="p-5 flex flex-col gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-foreground">{req.serviceTitle}</p>
                          <p className="text-[11px] text-muted-foreground">{req.userName} • {req.userEmail}</p>
                          {req.serviceCategory === 'credit' && (
                            <p className="text-[11px] text-brand font-bold">
                              Demande : {(req.requestedAmount || 0).toLocaleString()} FCFA • Épargne du membre : {req.userTotalSaved.toLocaleString()} FCFA
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground">
                            Soumis le {new Date(req.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        {req.serviceCategory !== 'credit' && (
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReviewMarketplaceRequest(req.id, 'contacted', req.userId, req.serviceTitle)}
                              disabled={reviewingRequestId === req.id}
                              className="h-9 rounded-xl text-xs font-bold border-border"
                            >
                              Marquer contacté
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleReviewMarketplaceRequest(req.id, 'approved', req.userId, req.serviceTitle)}
                              disabled={reviewingRequestId === req.id}
                              className="h-9 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/90 text-white"
                            >
                              <Check className="w-3.5 h-3.5 mr-1.5" />
                              Approuver
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReviewMarketplaceRequest(req.id, 'rejected', req.userId, req.serviceTitle)}
                              disabled={reviewingRequestId === req.id}
                              className="h-9 w-9 p-0 rounded-xl border-danger/30 text-danger hover:bg-danger-soft"
                              title="Refuser"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {req.serviceCategory === 'credit' && (
                        <div className="flex flex-col sm:flex-row sm:items-end gap-3 bg-muted/30 border border-border rounded-2xl p-4">
                          <div className="space-y-1 flex-1">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Montant à décaisser (FCFA)</Label>
                            <Input
                              type="number"
                              min={1}
                              value={getCreditForm(req).amount}
                              onChange={(e) => setCreditFormField(req.id, 'amount', e.target.value, req)}
                              className="h-10 rounded-xl bg-card"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Échéance de remboursement</Label>
                            <Input
                              type="date"
                              value={getCreditForm(req).deadline}
                              onChange={(e) => setCreditFormField(req.id, 'deadline', e.target.value, req)}
                              className="h-10 rounded-xl bg-card"
                            />
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button
                              size="sm"
                              onClick={() => handleApproveCredit(req)}
                              disabled={approvingCreditId === req.id}
                              className="h-10 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/90 text-white"
                            >
                              <Check className="w-3.5 h-3.5 mr-1.5" />
                              Approuver et décaisser
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReviewMarketplaceRequest(req.id, 'rejected', req.userId, req.serviceTitle)}
                              disabled={reviewingRequestId === req.id || approvingCreditId === req.id}
                              className="h-10 w-10 p-0 rounded-xl border-danger/30 text-danger hover:bg-danger-soft"
                              title="Refuser"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: PLATFORM SETTINGS */}
        <TabsContent value="settings" className="mt-6">
          <Card className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
            <CardHeader className="pb-4 bg-muted/30 border-b border-border">
              <CardTitle className="text-lg font-serif font-bold text-foreground">
                {t('admin_global_settings')}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {t('admin_global_settings_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              
              <div className="grid gap-4 max-w-xl">
                
                {/* Switch: Maintenance mode simulation */}
                <div className="flex items-center justify-between p-4 border rounded-2xl bg-muted/20 border-border">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-foreground">{t('admin_maintenance_sim')}</p>
                    <p className="text-[10px] text-muted-foreground">{t('admin_maintenance_sim_desc')}</p>
                  </div>
                  <Button
                    variant={maintenanceMode ? 'default' : 'outline'}
                    size="sm"
                    disabled={isSavingSettings}
                    onClick={async () => {
                      const next = !maintenanceMode;
                      setIsSavingSettings(true);
                      const { data: authData } = await supabase.auth.getUser();
                      const result = await updatePlatformSettings({ maintenanceMode: next }, authData.user?.id || '');
                      setIsSavingSettings(false);
                      if (!result.success) {
                        toast.error(result.message || "Impossible d'enregistrer ce réglage.");
                        return;
                      }
                      setMaintenanceMode(next);
                      toast.info(`${t('admin_maintenance_mode')} ${next ? t('admin_enabled') : t('admin_disabled')}`);
                    }}
                    className={`h-8 font-bold text-xs rounded-xl cursor-pointer ${maintenanceMode ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : 'border-border'}`}
                  >
                    {maintenanceMode ? t('admin_mode_enabled') : t('admin_disabled')}
                  </Button>
                </div>

                {/* Switch: Signup blocker */}
                <div className="flex items-center justify-between p-4 border rounded-2xl bg-muted/20 border-border">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-foreground">{t('admin_allow_signups')}</p>
                    <p className="text-[10px] text-muted-foreground">{t('admin_allow_signups_desc')}</p>
                  </div>
                  <Button
                    variant={allowSignups ? 'default' : 'outline'}
                    size="sm"
                    disabled={isSavingSettings}
                    onClick={async () => {
                      const next = !allowSignups;
                      setIsSavingSettings(true);
                      const { data: authData } = await supabase.auth.getUser();
                      const result = await updatePlatformSettings({ allowSignups: next }, authData.user?.id || '');
                      setIsSavingSettings(false);
                      if (!result.success) {
                        toast.error(result.message || "Impossible d'enregistrer ce réglage.");
                        return;
                      }
                      setAllowSignups(next);
                      toast.info(`${t('admin_signups_word')} ${next ? t('admin_open_fem') : t('admin_closed_fem')}`);
                    }}
                    className={`h-8 font-bold text-xs rounded-xl cursor-pointer ${allowSignups ? 'bg-secondary hover:bg-secondary/90 text-white' : 'border-border'}`}
                  >
                    {allowSignups ? t('admin_signups_active') : t('admin_blocked')}
                  </Button>
                </div>

                {/* Info block for developer demo */}
                <div className="bg-brand/10 border border-brand/20 p-4 rounded-2xl flex gap-3 text-xs text-foreground leading-relaxed">
                  <AlertTriangle className="w-5 h-5 text-brand shrink-0" />
                  <div className="space-y-1">
                    <span className="font-bold block">{t('admin_reputation_control')}</span>
                    <p className="text-[11px] text-muted-foreground">
                      {t('admin_recontrol_before')} <strong>{t('members')}</strong> {t('admin_recontrol_after')}
                    </p>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: DOUBLE-ENTRY LEDGER & AUDIT LOGS */}
        <TabsContent value="ledger" className="mt-6 space-y-6">
          <Card className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
            <CardHeader className="pb-4 bg-muted/30 border-b border-border">
              <CardTitle className="text-lg font-serif font-bold text-foreground flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-brand" />
                Retraits Mobile Money en attente
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Paydunya ne décaisse pas automatiquement vers Mobile Money : envoyez l'argent manuellement puis marquez la demande traitée. Le portefeuille de l'utilisateur est déjà débité (réservé).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {pendingWithdrawals.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground text-xs font-medium">
                  Aucun retrait en attente.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {pendingWithdrawals.map((w) => (
                    <div key={w.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold text-foreground">{w.userName} • {w.userEmail}</p>
                        <p className="text-xs font-black text-brand">{w.amount.toLocaleString()} FCFA → {w.paymentMethod.toUpperCase()} ({w.reference})</p>
                        <p className="text-[10px] text-muted-foreground">
                          Demandé le {new Date(w.date).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleCompleteWithdrawal(w)}
                          disabled={processingWithdrawalId === w.id}
                          className="h-9 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/90 text-white"
                        >
                          <Check className="w-3.5 h-3.5 mr-1.5" />
                          Envoyé
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFailWithdrawal(w)}
                          disabled={processingWithdrawalId === w.id}
                          className="h-9 rounded-xl text-xs font-bold border-danger/30 text-danger hover:bg-danger-soft"
                        >
                          <X className="w-3.5 h-3.5 mr-1.5" />
                          Échec (rembourser)
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left side: Reconciliation control */}
            <div className="lg:col-span-4 space-y-6">
              <Card className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
                <CardHeader className="pb-4 bg-muted/30 border-b border-border">
                  <div className="flex items-center gap-2 text-secondary">
                    <ShieldCheck className="w-5 h-5 text-secondary" />
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      {t('admin_integrity_report')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                  {(() => {
                    const latestReport = reconReports[0];
                    const hasDiscrepancy = !!latestReport && Number(latestReport.totalDiscrepancies) > 0;
                    if (!latestReport) {
                      return (
                        <div className="flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-muted border border-border">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-2">
                            <Clock className="w-6 h-6" />
                          </div>
                          <span className="text-xs font-black text-muted-foreground uppercase tracking-wide">
                            Aucune vérification effectuée
                          </span>
                          <p className="text-[10px] text-muted-foreground mt-1 max-w-xs leading-normal">
                            Lancez une réconciliation pour comparer les soldes déclarés au registre comptable réel.
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div className={`flex flex-col items-center justify-center text-center p-4 rounded-2xl border ${hasDiscrepancy ? 'bg-danger/10 border-danger/20' : 'bg-muted border-border'}`}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${hasDiscrepancy ? 'bg-danger/15 text-danger' : 'bg-success-soft text-secondary'}`}>
                          {hasDiscrepancy ? <AlertTriangle className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
                        </div>
                        <span className={`text-xs font-black uppercase tracking-wide ${hasDiscrepancy ? 'text-danger' : 'text-secondary'}`}>
                          {hasDiscrepancy ? 'Écart détecté' : t('admin_ledger_reconciled')}
                        </span>
                        <p className="text-[10px] text-muted-foreground mt-1 max-w-xs leading-normal">
                          {hasDiscrepancy
                            ? `${Number(latestReport.totalDiscrepancies).toLocaleString()} FCFA d'écart au dernier contrôle (${new Date(latestReport.timestamp).toLocaleString()}).`
                            : t('admin_no_discrepancy')}
                        </p>
                      </div>
                    );
                  })()}

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-dashed">
                      <span className="text-muted-foreground">{t('admin_total_accounts')}</span>
                      <span className="font-bold">{users.length}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-dashed">
                      <span className="text-muted-foreground">{t('admin_ledger_entries_label')}</span>
                      <span className="font-bold">{ledgerEntries.length}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-dashed">
                      <span className="text-muted-foreground">{t('admin_accounting_gaps')}</span>
                      <span className={`font-bold ${reconReports[0] && Number(reconReports[0].totalDiscrepancies) > 0 ? 'text-danger' : 'text-secondary'}`}>
                        {reconReports[0] ? Number(reconReports[0].totalDiscrepancies).toLocaleString() : '—'} FCFA
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">{t('admin_recon_status')}</span>
                      {reconReports[0] ? (
                        Number(reconReports[0].totalDiscrepancies) > 0 ? (
                          <Badge className="bg-danger/15 text-danger border-none text-[9px] px-1.5 font-bold">ÉCART</Badge>
                        ) : (
                          <Badge className="bg-secondary/15 text-secondary border-none text-[9px] px-1.5 font-bold">100% OK</Badge>
                        )
                      ) : (
                        <Badge className="bg-muted text-muted-foreground border-none text-[9px] px-1.5 font-bold">NON VÉRIFIÉ</Badge>
                      )}
                    </div>
                  </div>

                  <Button 
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black rounded-2xl h-11 text-xs"
                    onClick={handleTriggerReconciliation}
                    disabled={isReconciling}
                  >
                    {isReconciling ? (
                      <span className="flex items-center gap-1.5 justify-center w-full">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {t('admin_reconciling')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 justify-center w-full">
                        <RefreshCw className="w-4 h-4" />
                        {t('admin_run_reconciliation')}
                      </span>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* History of reconciliation reports */}
              <Card className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
                <CardHeader className="pb-3 bg-muted/30 border-b border-border">
                  <CardTitle className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <History className="w-4 h-4 text-muted-foreground" />
                    {t('admin_reports_history')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3 max-h-[220px] overflow-y-auto">
                  {reconReports.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground text-center py-4">{t('admin_no_report')}</p>
                  ) : (
                    reconReports.map((report: any) => (
                      <div key={report.id} className="p-2.5 rounded-xl border border-border bg-muted/50 flex flex-col gap-1 text-[10px]">
                        <div className="flex justify-between font-bold">
                          <span className="text-foreground">{t('admin_report_word')} {report.id.substring(0, 8)}</span>
                          <span className="text-secondary font-bold uppercase text-[8px] bg-success-soft px-1 border border-secondary/20">{t('admin_success_upper')}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-[9px]">
                          <span>{new Date(report.timestamp).toLocaleString()}</span>
                          <span>{report.totalLedgerEntriesChecked} {t('admin_entries_checked')}</span>
                        </div>
                        <div className="text-[9px] text-muted-foreground border-t border-dashed pt-1 mt-1 flex justify-between">
                          <span>{t('admin_gaps_short')} <strong className="text-secondary">{report.totalDiscrepancies} FCFA</strong></span>
                          <span>{t('admin_accounts_short')} <strong>{report.totalUsersChecked}</strong></span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right side: Live Ledger & Audit Trail */}
            <div className="lg:col-span-8">
              <Tabs defaultValue="ledger-entries" className="w-full">
                <TabsList className="bg-muted rounded-xl p-1 w-fit flex gap-1 mb-4">
                  <TabsTrigger value="ledger-entries" className="text-xs font-bold py-1.5 px-3 rounded-lg">
                    {t('admin_ledger_double')}
                  </TabsTrigger>
                  <TabsTrigger value="audit-logs" className="text-xs font-bold py-1.5 px-3 rounded-lg">
                    {t('admin_audit_immutable')}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="ledger-entries">
                  <Card className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto max-h-[450px]">
                      <Table>
                        <TableHeader className="bg-muted">
                          <TableRow>
                            <TableHead className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">{t('date')}</TableHead>
                            <TableHead className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">{t('admin_account_col')}</TableHead>
                            <TableHead className="text-[9px] font-black uppercase text-muted-foreground tracking-wider text-center">{t('admin_type_col')}</TableHead>
                            <TableHead className="text-[9px] font-black uppercase text-muted-foreground tracking-wider text-right">{t('amount')}</TableHead>
                            <TableHead className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">{t('admin_counterparty_col')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-[11px]">
                          {ledgerEntries.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-6 text-muted-foreground italic">
                                {t('admin_no_ledger_entry')}
                              </TableCell>
                            </TableRow>
                          ) : (
                            ledgerEntries.map((entry) => (
                              <TableRow key={entry.id} className="hover:bg-muted/50">
                                <TableCell className="text-muted-foreground font-mono text-[10px]">
                                  {new Date(entry.createdAt).toLocaleTimeString()}
                                </TableCell>
                                <TableCell className="font-mono text-[10px]">
                                  {entry.account.startsWith('user_wallet:') ? (
                                    <span className="text-foreground font-semibold">{t('admin_wallet_prefix')} {entry.account.split(':')[1].substring(0, 6)}...</span>
                                  ) : entry.account.startsWith('tontine_group:') ? (
                                    <span className="text-indigo-600 font-semibold">{t('admin_circle_prefix')} {entry.account.split(':')[1].substring(0, 6)}...</span>
                                  ) : (
                                    <span className="text-muted-foreground font-semibold">{entry.account}</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  {entry.type === 'credit' ? (
                                    <Badge className="bg-success-soft text-secondary border border-secondary/20 text-[8px] h-4 px-1 rounded-sm uppercase font-black tracking-wider">{t('admin_credit')}</Badge>
                                  ) : (
                                    <Badge className="bg-danger-soft text-danger border border-danger/20 text-[8px] h-4 px-1 rounded-sm uppercase font-black tracking-wider">{t('admin_debit')}</Badge>
                                  )}
                                </TableCell>
                                <TableCell className={`text-right font-bold ${entry.type === 'credit' ? 'text-secondary' : 'text-danger'}`}>
                                  {entry.type === 'credit' ? '+' : '-'}{entry.amount.toLocaleString()} {entry.currency}
                                </TableCell>
                                <TableCell className="text-muted-foreground font-mono text-[9px] max-w-[100px] truncate">
                                  {entry.counterparty}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="audit-logs">
                  <Card className="bg-[#0f172a] text-slate-200 font-mono text-[11px] p-4 rounded-2xl shadow-inner border border-slate-800">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Terminal className="w-4 h-4 text-emerald-400 animate-pulse" />
                        IMMUTABLE AUDIT LOGS — SHA-256 SECURED
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold">Total logs: {auditLogs.length}</span>
                    </div>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                      {auditLogs.length === 0 ? (
                        <p className="text-slate-500 text-center py-8 italic">{t('admin_no_audit_log')}</p>
                      ) : (
                        auditLogs.map((log) => (
                          <div key={log.id} className="border-b border-slate-900/40 pb-2 flex flex-col gap-1 leading-normal">
                            <div className="flex justify-between items-start">
                              <span className="text-slate-400">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                              <span className={log.status === 'success' ? 'text-emerald-400 font-bold text-[9px]' : 'text-red-400 font-bold text-[9px]'}>
                                {log.status.toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <span className="text-amber-400 uppercase font-black text-[10px]">{log.action}:</span>{' '}
                              <span className="text-slate-200">{log.details}</span>
                            </div>
                            <div className="flex gap-4 text-[10px] text-slate-500 pt-0.5">
                              <span>IP: <strong className="text-slate-400">{log.ip}</strong></span>
                              <span>{t('admin_device')} <strong className="text-slate-400">{log.device}</strong></span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

          </div>
        </TabsContent>

            </div>
          </Tabs>
        );
      })()}
    </motion.div>
  );
}
