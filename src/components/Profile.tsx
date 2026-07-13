import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  ShieldCheck, 
  Calendar, 
  Wallet, 
  Users, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  Sparkles, 
  Info, 
  HelpCircle, 
  ChevronRight, 
  ArrowUpRight,
  ArrowDownRight,
  ArrowDownLeft,
  Filter,
  Plus,
  Loader2,
  RefreshCw,
  Settings,
  Globe,
  Key,
  Lock,
  User,
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  Bell,
  Mail,
  Gift,
  Share2,
  Copy
} from 'lucide-react';
import { UserProfile, Group, Contribution, WalletTransaction } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase, createChannel, changePassword, isPasswordProviderUser } from '@/lib/supabase';
import { mapWalletTransactionRow, mapContributionRow } from '@/lib/mappers';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { executeFinancialTransaction, verifyUserPin } from '@/lib/ledger';
import { notifyUser } from '@/lib/notify';
import { 
  CustomAvatar, 
  AvatarConfig, 
  DEFAULT_AVATAR 
} from './CustomAvatar';
import { AvatarWorkshop } from './AvatarWorkshop';
import { ConfirmationBottomSheet } from './ui/ConfirmationBottomSheet';
import { EmptyState } from './ui/EmptyState';

interface ProfileProps {
  user: UserProfile;
  groups: Group[];
  defaultTab?: string;
}

export function Profile({ user, groups, defaultTab }: ProfileProps) {
  const { t, setLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState(defaultTab || "contributions");
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loadingContributions, setLoadingContributions] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showExplanation, setShowExplanation] = useState(false);

  // Wallet Top-up States
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isConfirmRechargeOpen, setIsConfirmRechargeOpen] = useState(false);

  // Profile settings states
  const [editDisplayName, setEditDisplayName] = useState(user.displayName);
  const [newPassword, setNewPassword] = useState('');
  const [editLanguage, setEditLanguage] = useState(user.language || 'fr');
  const [editTheme, setEditTheme] = useState(user.theme || 'light');
  const [editSecurityPin, setEditSecurityPin] = useState('');
  const [canChangePassword, setCanChangePassword] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCanChangePassword(isPasswordProviderUser(session));
    });
  }, []);
  const [emailNotifEnabled, setEmailNotifEnabled] = useState(user.emailNotificationsEnabled ?? true);

  // Wallet Withdrawal States
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('orange_money');
  const [withdrawDetails, setWithdrawDetails] = useState('');
  const [enteredPin, setEnteredPin] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  
  // Parse avatar config
  const initialAvatarConfig = useMemo(() => {
    if (user.photoURL) {
      try {
        return { ...DEFAULT_AVATAR, ...JSON.parse(user.photoURL) };
      } catch (e) {
        // Not a JSON string
      }
    }
    return { ...DEFAULT_AVATAR };
  }, [user.photoURL]);

  const [editAvatar, setEditAvatar] = useState<AvatarConfig>(initialAvatarConfig);
  const [savingSettings, setSavingSettings] = useState(false);

  // Update local settings if user profile changes from db
  useEffect(() => {
    setEditDisplayName(user.displayName);
    setEditLanguage(user.language || 'fr');
    setEditTheme(user.theme || 'light');
    if (user.photoURL) {
      try {
        setEditAvatar({ ...DEFAULT_AVATAR, ...JSON.parse(user.photoURL) });
      } catch (e) {}
    }
  }, [user]);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  // Fetch Wallet Transactions in real-time
  useEffect(() => {
    const fetchTx = async () => {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.uid)
        .order('date', { ascending: false });
      if (error) {
        console.error("Error fetching transactions:", error);
        setLoadingTransactions(false);
        return;
      }
      setWalletTransactions((data ?? []).map(mapWalletTransactionRow));
      setLoadingTransactions(false);
    };
    fetchTx();

    const channel = createChannel(`wallet-tx-${user.uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallet_transactions', filter: `user_id=eq.${user.uid}` },
        () => fetchTx()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user.uid]);

  const handleExportCSV = () => {
    if (walletTransactions.length === 0) {
      toast.error(t('prof_no_tx_export'));
      return;
    }
    
    // Headers
    const headers = [t('prof_type'), t('prof_description'), `${t('amount')} (FCFA)`, t('date'), t('prof_method'), t('status')];

    // Rows
    const rows = walletTransactions.map(tx => {
      const typeStr = tx.amount > 0 ? t('prof_credit') : t('prof_debit');
      const dateStr = format(new Date(tx.date), 'yyyy-MM-dd HH:mm');
      const methodStr = tx.paymentMethod || 'Paydunya';
      const statusStr = tx.status === 'completed' ? t('prof_completed') : tx.status;
      
      return [
        typeStr,
        `"${tx.description.replace(/"/g, '""')}"`,
        tx.amount,
        dateStr,
        methodStr,
        statusStr
      ];
    });
    
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `eganye_transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t('prof_csv_exported'));
  };

  const handleExportPDF = () => {
    if (walletTransactions.length === 0) {
      toast.error(t('prof_no_tx_export'));
      return;
    }
    
    // Calculate summaries
    const totalCredits = walletTransactions.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
    const totalDebits = walletTransactions.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const currentBalance = user.walletBalance || 0;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error(t('prof_allow_popups'));
      return;
    }
    
    const transactionsHtml = walletTransactions.map(tx => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px; font-weight: bold; color: ${tx.amount > 0 ? '#10b981' : '#f43f5e'}">
          ${tx.amount > 0 ? 'CRÉDIT' : 'DÉBIT'}
        </td>
        <td style="padding: 12px; font-weight: 600; color: #1e293b;">${tx.description}</td>
        <td style="padding: 12px; font-weight: bold; text-align: right; color: ${tx.amount > 0 ? '#10b981' : '#f43f5e'}">
          ${tx.amount > 0 ? '+' : ''}${tx.amount.toLocaleString()} FCFA
        </td>
        <td style="padding: 12px; color: #64748b; font-size: 12px;">
          ${format(new Date(tx.date), 'dd MMMM yyyy HH:mm', { locale: fr })}
        </td>
        <td style="padding: 12px; color: #64748b; font-size: 12px; text-transform: capitalize;">
          ${tx.paymentMethod || 'Paydunya'}
        </td>
        <td style="padding: 12px; font-weight: 500; text-align: right;">
          <span style="background-color: #d1fae5; color: #065f46; padding: 4px 8px; border-radius: 9999px; font-size: 11px;">
            ${tx.status === 'completed' ? 'Complété' : tx.status}
          </span>
        </td>
      </tr>
    `).join('');
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>eganyé - Relevé de Compte</title>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            color: #334155;
            line-height: 1.5;
            padding: 40px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: 900;
            color: #4b2e05;
            letter-spacing: -1px;
          }
          .logo-accent {
            color: #e67e22;
          }
          .title {
            font-size: 18px;
            font-weight: 800;
            text-align: right;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #64748b;
          }
          .details {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .details-col h4 {
            margin: 0 0 8px 0;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            color: #94a3b8;
            letter-spacing: 1px;
          }
          .details-col p {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: #1e293b;
          }
          .summary-card {
            background-color: #f8fafc;
            border: 1px solid #f1f5f9;
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 1px 2px 0 rgba(0,0,0,0.02);
          }
          .summary-card h5 {
            margin: 0 0 6px 0;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            color: #64748b;
          }
          .summary-card p {
            margin: 0;
            font-size: 20px;
            font-weight: 900;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 40px;
          }
          th {
            background-color: #f1f5f9;
            color: #475569;
            font-weight: 800;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 12px;
            text-align: left;
            border-bottom: 2px solid #cbd5e1;
          }
          .footer {
            text-align: center;
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
            font-size: 11px;
            color: #94a3b8;
            font-weight: 500;
          }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">eganyé<span class="logo-accent">.</span></div>
          <div class="title">${t('prof_wallet_statement')}</div>
        </div>

        <div class="details">
          <div class="details-col">
            <h4>${t('prof_account_holder')}</h4>
            <p>${user.displayName}</p>
            <p style="font-size: 12px; color: #64748b; font-weight: normal; margin-top: 2px;">${user.email || ''}</p>
          </div>
          <div class="details-col" style="text-align: right;">
            <h4>${t('prof_statement_period')}</h4>
            <p>${t('prof_up_to')} ${format(new Date(), 'dd MMMM yyyy', { locale: fr })}</p>
          </div>
        </div>

        <div style="display: flex; gap: 20px; margin-bottom: 35px;">
          <div class="summary-card" style="flex: 1;">
            <h5>${t('prof_total_credited')}</h5>
            <p style="color: #10b981; font-weight: bold;">+${totalCredits.toLocaleString()} FCFA</p>
          </div>
          <div class="summary-card" style="flex: 1;">
            <h5>${t('prof_total_debited')}</h5>
            <p style="color: #f43f5e; font-weight: bold;">-${totalDebits.toLocaleString()} FCFA</p>
          </div>
          <div class="summary-card" style="flex: 1; background-color: #fffbeb; border-color: #fef3c7;">
            <h5>${t('prof_current_balance')}</h5>
            <p style="color: #b45309; font-weight: bold;">${currentBalance.toLocaleString()} FCFA</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>${t('prof_movement')}</th>
              <th>${t('prof_description')}</th>
              <th style="text-align: right;">${t('amount')}</th>
              <th>${t('prof_date_time')}</th>
              <th>${t('prof_method')}</th>
              <th style="text-align: right;">${t('status')}</th>
            </tr>
          </thead>
          <tbody>
            ${transactionsHtml}
          </tbody>
        </table>

        <div class="footer">
          ${t('prof_pdf_footer')}<br>
          © ${new Date().getFullYear()} eganyé. ${t('prof_rights_reserved')}
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    toast.success(t('prof_pdf_generated'));
  };

  const handleToggleEmailNotifications = async () => {
    const next = !emailNotifEnabled;
    setEmailNotifEnabled(next);
    try {
      const { error } = await supabase.from('profiles').update({ email_notifications_enabled: next }).eq('id', user.uid);
      if (error) throw error;
    } catch (error) {
      console.error('Error toggling email notifications:', error);
      setEmailNotifEnabled(!next);
      toast.error(t('prof_email_error'));
    }
  };

  const handleRechargeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(rechargeAmount);
    if (isNaN(amt) || amt < 100) {
      toast.error(t('prof_min_100'));
      return;
    }
    setRechargeOpen(false);
    setIsConfirmRechargeOpen(true);
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error(t('prof_valid_amount'));
      return;
    }
    if (amountNum < 500) {
      toast.error(t('prof_min_withdraw_500'));
      return;
    }
    if (amountNum > (user.walletBalance || 0)) {
      toast.error(t('prof_insufficient_balance'));
      return;
    }
    if (enteredPin.length !== 4) {
      toast.error(t('prof_enter_pin_4'));
      return;
    }

    setIsWithdrawing(true);
    try {
      // 1. Verify PIN (with automatic lockout after repeated failures).
      // Failed-attempt audit logging happens server-side inside the RPC
      // itself (verify_user_pin), since direct client writes to audit_logs
      // are restricted to admins.
      const pinResult = await verifyUserPin(user.uid, enteredPin);
      if (!pinResult.ok) {
        toast.error(pinResult.message);
        setIsWithdrawing(false);
        return;
      }

      const idempotencyKey = `withdraw_${user.uid}_${Date.now()}`;

      // 2. Execute safe double-entry financial transaction
      const ledgerResult = await executeFinancialTransaction({
        idempotencyKey,
        userId: user.uid,
        amount: amountNum,
        currency: 'FCFA',
        description: `Retrait de fonds vers ${withdrawMethod.toUpperCase()} (${withdrawDetails})`,
        actionType: 'wallet_withdrawal',
        debitAccount: `user_wallet:${user.uid}`,
        creditAccount: `user_bank:${user.uid}`
      });

      if (!ledgerResult.success) {
        throw new Error(ledgerResult.message);
      }

      // 3. Create matching wallet transaction record for user display
      await supabase.from('wallet_transactions').insert({
        user_id: user.uid,
        amount: -amountNum,
        type: 'withdraw',
        description: `Retrait vers ${withdrawMethod.toUpperCase()}`,
        status: 'completed',
        payment_method: withdrawMethod,
        reference: ledgerResult.transactionId || `wdr_${Date.now()}`
      });

      // 4. Create User Notification
      await notifyUser({
        userId: user.uid,
        title: 'Retrait de fonds validé !',
        message: `Votre demande de retrait de ${amountNum.toLocaleString()} FCFA vers votre compte ${withdrawMethod.toUpperCase()} a été traitée de manière sécurisée et intègre.`,
        type: 'system'
      });

      toast.success(`${t('prof_withdraw_success')} (${amountNum.toLocaleString()} FCFA)`);
      setWithdrawOpen(false);
      setWithdrawAmount('');
      setWithdrawDetails('');
      setEnteredPin('');
    } catch (error: any) {
      console.error("Error executing withdrawal transaction:", error);
      toast.error(error.message || t('prof_withdraw_error'));
    } finally {
      setIsWithdrawing(false);
    }
  };

  const executeRecharge = async () => {
    const amt = parseFloat(rechargeAmount);
    setIsRedirecting(true);
    try {
      const response = await fetch('/api/create-paydunya-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amt,
          userId: user.uid,
          userName: user.displayName,
          userEmail: user.email
        })
      });
      const data = await response.json();
      if (data.url) {
        toast.info(t('prof_redirect_paydunya'));
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Une erreur s'est produite");
      }
    } catch (error: any) {
      console.error("Recharge Paydunya error:", error);
      toast.error(error.message || t('prof_recharge_error'));
    } finally {
      setIsRedirecting(false);
      setIsConfirmRechargeOpen(false);
    }
  };

  // Fetch + realtime subscription for the user's contributions across all groups
  useEffect(() => {
    if (!groups || groups.length === 0) {
      setContributions([]);
      setLoadingContributions(false);
      return;
    }

    setLoadingContributions(true);
    const groupIds = groups.map((g) => g.id);

    const fetchContributions = async () => {
      const { data, error } = await supabase
        .from('contributions')
        .select('*')
        .eq('user_id', user.uid)
        .in('group_id', groupIds)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching contributions:', error);
        setLoadingContributions(false);
        return;
      }

      setContributions((data ?? []).map(mapContributionRow));
      setLoadingContributions(false);
    };

    fetchContributions();

    const channel = createChannel(`profile-contributions-${user.uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contributions', filter: `user_id=eq.${user.uid}` },
        () => fetchContributions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groups, user.uid]);

  // Compute stats based on fetched contributions
  const stats = useMemo(() => {
    let paidCount = 0;
    let lateCount = 0;
    let pendingCount = 0;
    let pendingApprovalCount = 0;
    let computedTotalSaved = 0;

    contributions.forEach((c) => {
      if (c.status === 'paid') {
        paidCount++;
        computedTotalSaved += c.amount;
      } else if (c.status === 'late') {
        lateCount++;
      } else if (c.status === 'pending') {
        pendingCount++;
      } else if (c.status === 'pending_approval') {
        pendingApprovalCount++;
      }
    });

    const totalFinalisedType = paidCount + lateCount;
    const punctualityRate = totalFinalisedType > 0 
      ? Math.round((paidCount / totalFinalisedType) * 100) 
      : 100;

    // Reliability calculation: 
    // Start at 60 (standard starting trust)
    // Add 10 points for each paid/on-time transaction
    // Deduct 20 points for each late/delinquent transaction
    // Capped between 0 and 100. If no transactions exist, default to 75.
    let computedScore = 75;
    if (totalFinalisedType > 0) {
      computedScore = Math.min(100, Math.max(0, 60 + (paidCount * 8) - (lateCount * 18)));
    }

    return {
      paidCount,
      lateCount,
      pendingCount,
      pendingApprovalCount,
      punctualityRate,
      computedScore,
      computedTotalSaved,
      groupsJoinedCount: groups.length
    };
  }, [contributions, groups.length]);

  const {
    paidCount,
    lateCount,
    pendingCount,
    pendingApprovalCount,
    punctualityRate,
    computedScore,
    computedTotalSaved,
    groupsJoinedCount
  } = stats;

  // Synchronise calculated status back to firestore UserProfile document if out of sync
  useEffect(() => {
    const updateDbStats = async () => {
      if (
        computedScore !== user.reputationScore ||
        computedTotalSaved !== user.totalSaved ||
        groupsJoinedCount !== user.groupsJoined
      ) {
        try {
          const { error } = await supabase.from('profiles').update({
            reputation_score: computedScore,
            total_saved: computedTotalSaved,
            groups_joined: groupsJoinedCount,
          }).eq('id', user.uid);
          if (error) throw error;
        } catch (error) {
          console.error("Error updating user statistics in db:", error);
        }
      }
    };

    if (!loadingContributions) {
      updateDbStats();
    }
  }, [computedScore, computedTotalSaved, groupsJoinedCount, user.reputationScore, user.totalSaved, user.groupsJoined, user.uid, loadingContributions]);

  // SVG Circular Gauge calculation
  const radius = 50;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (computedScore / 100) * circumference;

  const getScoreInfo = (sc: number) => {
    if (sc >= 85) return {
      tier: "Tier S",
      color: "text-secondary stroke-secondary fill-success-soft",
      ringColor: "stroke-secondary/20",
      bgBadg: "bg-success-soft text-secondary border-secondary/20",
      name: t('prof_tier_s_name'),
      desc: t('prof_tier_s_desc')
    };
    if (sc >= 70) return {
      tier: "Tier A",
      color: "text-teal-500 stroke-teal-500 fill-teal-500/10",
      ringColor: "stroke-teal-500/20",
      bgBadg: "bg-teal-500/10 text-teal-500 border-teal-500/20",
      name: t('prof_tier_a_name'),
      desc: t('prof_tier_a_desc')
    };
    if (sc >= 50) return {
      tier: "Tier B",
      color: "text-brand stroke-brand fill-brand/10",
      ringColor: "stroke-brand/20",
      bgBadg: "bg-brand/10 text-brand border-brand/20",
      name: t('prof_tier_b_name'),
      desc: t('prof_tier_b_desc')
    };
    return {
      tier: "Tier C",
      color: "text-danger stroke-danger fill-danger-soft",
      ringColor: "stroke-danger/20",
      bgBadg: "bg-danger-soft text-danger border-danger/20",
      name: t('prof_tier_c_name'),
      desc: t('prof_tier_c_desc')
    };
  };

  const scoreInfo = getScoreInfo(computedScore);

  const getGroupName = (groupId: string) => {
    const gp = groups.find(g => g.id === groupId);
    return gp ? gp.name : t('prof_unknown_circle');
  };

  const getFilteredContributions = useMemo(() => {
    return contributions.filter((c) => {
      if (filterStatus === 'all') return true;
      return c.status === filterStatus;
    });
  }, [contributions, filterStatus]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 15 }}
      className="max-w-6xl mx-auto space-y-8"
    >
      
      {/* Header and User profile outline */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row gap-6 items-center justify-between bg-card p-6 rounded-2xl border shadow-sm"
      >
        <div className="flex flex-col sm:flex-row gap-6 items-center text-center sm:text-left">
          <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-brand/30 flex items-center justify-center bg-muted">
            {user.photoURL ? (
              <CustomAvatar config={user.photoURL} size={80} />
            ) : (
              <div className="text-2xl font-semibold text-brand bg-brand/10 w-full h-full flex items-center justify-center">
                {user.displayName.charAt(0)}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">{user.displayName}</h2>
              <Badge variant="outline" className={scoreInfo.bgBadg}>
                {scoreInfo.tier} • {scoreInfo.name}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">{user.email}</p>
            <p className="text-xs text-muted-foreground">
              {t('prof_registered_on')} {format(new Date(user.createdAt || Date.now()), 'dd MMMM yyyy', { locale: fr })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-xl flex items-center gap-1.5 hover:bg-muted cursor-pointer active:scale-95 transition-transform"
            onClick={() => setShowExplanation(!showExplanation)}
          >
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
            <span>{t('score_formula')}</span>
          </Button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showExplanation && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -15 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -15 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <Card className="bg-muted/80 border border-border shadow-sm rounded-3xl">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-md font-bold flex items-center gap-2 text-foreground">
                  <Sparkles className="w-5 h-5 text-brand" />
                  {t('prof_score_calculator')}
                </CardTitle>
                <CardDescription className="text-foreground/80 font-medium">
                  {t('prof_score_calc_desc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                
                {/* Visual Math Step Block */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-stretch text-center">
                  
                  {/* Step 1: Base Score */}
                  <div className="bg-card p-4 rounded-2xl border border-border flex flex-col justify-between shadow-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">{t('prof_trust_score')}</span>
                      <span className="text-3xl font-serif font-black text-foreground">60</span>
                      <span className="text-xs text-muted-foreground block mt-1">{t('prof_initial_capital')}</span>
                    </div>
                    <div className="text-lg font-bold text-eganye-gold mt-2">+</div>
                  </div>

                  {/* Step 2: On-time Bonuses */}
                  <div className="bg-success-soft/40 p-4 rounded-2xl border border-secondary/20 flex flex-col justify-between shadow-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-secondary block mb-1">{t('prof_payment_bonus')}</span>
                      <span className="text-3xl font-serif font-black text-secondary">+{paidCount * 8}</span>
                      <span className="text-xs text-muted-foreground block mt-1">
                        {paidCount} {t('prof_payments_paid_label')} (+8 pts)
                      </span>
                    </div>
                    <div className="text-lg font-bold text-eganye-gold mt-2">−</div>
                  </div>

                  {/* Step 3: Late Penalties */}
                  <div className="bg-danger-soft/40 p-4 rounded-2xl border border-danger/20 flex flex-col justify-between shadow-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-danger block mb-1">{t('prof_late_penalties')}</span>
                      <span className="text-3xl font-serif font-black text-danger">-{lateCount * 18}</span>
                      <span className="text-xs text-muted-foreground block mt-1">
                        {lateCount} {t('prof_lates_noted')} (-18 pts)
                      </span>
                    </div>
                    <div className="text-lg font-bold text-eganye-gold mt-2">=</div>
                  </div>

                  {/* Step 4: Final Reputation Score */}
                  <div className="bg-primary text-primary-foreground p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                    <div>
                      <span className="text-[10px] uppercase font-black text-primary-foreground block mb-1">{t('prof_current_score')}</span>
                      <span className="text-3xl font-serif font-black">{computedScore}</span>
                      <span className="text-[10px] font-bold block mt-1">{t('prof_live_updated')}</span>
                    </div>
                    <div className="text-xs font-bold mt-2 bg-white/20 px-2 py-0.5 rounded-full inline-block mx-auto">
                      {scoreInfo.tier}
                    </div>
                  </div>

                </div>

                {/* dynamic tips based on score */}
                <div className="bg-card/80 p-4 rounded-2xl border border-border space-y-2">
                  <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5 uppercase">
                    <Sparkles className="w-4 h-4 text-brand" />
                    {t('prof_improve_tip')}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {computedScore >= 85 && t('reputation_tip_s')}
                    {computedScore >= 70 && computedScore < 85 && t('reputation_tip_a')}
                    {computedScore >= 50 && computedScore < 70 && t('reputation_tip_b')}
                    {computedScore < 50 && t('reputation_tip_c')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid of Visualization and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Circle Visualization Gauge */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {t('prof_global_reliability')}
            </CardTitle>
            <CardDescription>
              {t('prof_instant_treasury')}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
            <div className="relative flex items-center justify-center h-32 w-32">
              <svg className="absolute transform -rotate-90 w-full h-full" viewBox="0 0 120 120">
                {/* Background track circle */}
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  className="stroke-muted fill-none"
                  strokeWidth={strokeWidth}
                />
                {/* Progress score circle */}
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  className={`fill-none transition-all duration-1000 ease-out ${scoreInfo.color}`}
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="text-center z-10">
                <span className="text-4xl font-extrabold tracking-tight">{computedScore}</span>
                <span className="text-xs block font-medium text-muted-foreground">/ 100</span>
              </div>
            </div>

            <div className="text-center space-y-1">
              <p className="font-bold text-lg">{scoreInfo.name}</p>
              <p className="text-xs text-muted-foreground px-4 leading-relaxed">{scoreInfo.desc}</p>
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Bento metrics */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Paydunya Virtual Wallet Card */}
          <Card className="flex flex-col justify-between border-brand/20 bg-brand/10 sm:col-span-2">
            <CardHeader className="pb-1">
              <div className="flex justify-between items-start">
                <CardTitle className="text-xs font-semibold text-brand uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-brand" />
                  {t('prof_virtual_wallet')}
                </CardTitle>
                <Badge className="bg-brand/15 text-brand border-brand/30">{t('prof_secured_paydunya')}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-3xl font-black text-foreground tracking-tight">
                    {(user.walletBalance || 0).toLocaleString()} <span className="text-lg font-bold text-muted-foreground">FCFA</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('prof_balance_available_desc')}
                  </p>
                </div>
                
                <div className="flex gap-2 items-center flex-wrap shrink-0">
                  <Dialog open={rechargeOpen} onOpenChange={setRechargeOpen}>
                    <DialogTrigger render={
                      <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl flex items-center gap-2 shadow-sm">
                        <Plus className="w-4 h-4" />
                        {t('prof_recharge_via_paydunya')}
                      </Button>
                    } />
                    <DialogContent className="sm:max-w-[425px]">
                      <form onSubmit={handleRechargeSubmit}>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 font-bold text-xl text-foreground">
                            <Wallet className="w-5 h-5 text-brand" />
                            {t('recharge_wallet_title')}
                          </DialogTitle>
                          <DialogDescription className="text-muted-foreground text-xs font-normal">
                            {t('prof_recharge_dialog_desc')}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-6">
                          <div className="space-y-2">
                            <Label htmlFor="amount" className="font-bold text-foreground text-sm">
                              {t('prof_recharge_amount')}
                            </Label>
                            <div className="relative">
                              <Input
                                id="amount"
                                type="number"
                                placeholder={t('prof_ex_5000')}
                                className="pr-14 font-extrabold text-lg text-foreground focus-visible:ring-primary"
                                value={rechargeAmount}
                                onChange={(e) => setRechargeAmount(e.target.value)}
                                min="100"
                                required
                              />
                              <span className="absolute right-3 top-2.5 font-bold text-muted-foreground">FCFA</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground font-normal">{t('prof_min_amount_100')}</p>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            className="rounded-xl text-muted-foreground hover:bg-muted"
                            onClick={() => setRechargeOpen(false)}
                            disabled={isRedirecting}
                          >
                            {t('cancel')}
                          </Button>
                          <Button 
                            type="submit" 
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl"
                            disabled={isRedirecting}
                          >
                            {isRedirecting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                {t('prof_redirecting')}
                              </>
                            ) : t('prof_proceed_payment')}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
                    <DialogTrigger render={
                      <Button variant="outline" className="border-border text-foreground hover:bg-muted font-bold rounded-xl flex items-center gap-2">
                        <ArrowDownLeft className="w-4 h-4 text-danger" />
                        {t('prof_withdraw_funds')}
                      </Button>
                    } />
                    <DialogContent className="sm:max-w-[425px]">
                      <form onSubmit={handleWithdrawSubmit}>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 font-bold text-xl text-foreground">
                            <ArrowDownLeft className="w-5 h-5 text-danger" />
                            {t('prof_withdraw_money')}
                          </DialogTitle>
                          <DialogDescription className="text-muted-foreground text-xs font-normal">
                            {t('prof_withdraw_dialog_desc')}
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="grid gap-4 py-4 text-xs">
                          <div className="space-y-1.5">
                            <Label htmlFor="w_amount" className="font-bold text-foreground">
                              {t('prof_amount_to_withdraw')}
                            </Label>
                            <div className="relative">
                              <Input
                                id="w_amount"
                                type="number"
                                placeholder={t('prof_ex_5000')}
                                className="pr-14 font-extrabold text-lg text-foreground focus-visible:ring-danger"
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                min="500"
                                max={user.walletBalance || 0}
                                required
                              />
                              <span className="absolute right-3 top-2.5 font-bold text-muted-foreground">FCFA</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">{t('prof_available_balance')} : {(user.walletBalance || 0).toLocaleString()} FCFA (Min: 500 FCFA)</p>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="font-bold text-foreground">{t('prof_withdraw_method')}</Label>
                            <div className="grid grid-cols-3 gap-2">
                              {['orange_money', 'wave', 'bank_card'].map((method) => (
                                <button
                                  key={method}
                                  type="button"
                                  onClick={() => setWithdrawMethod(method)}
                                  className={`p-2 rounded-xl border text-center transition-all font-bold ${withdrawMethod === method ? 'border-danger bg-danger-soft/30 text-danger' : 'border-border hover:bg-muted text-muted-foreground'}`}
                                >
                                  {method === 'orange_money' ? 'OM' : method === 'wave' ? 'Wave' : t('prof_card')}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="w_details" className="font-bold text-foreground">
                              {t('prof_dest_details')}
                            </Label>
                            <Input
                              id="w_details"
                              type="text"
                              placeholder={t('prof_ex_phone')}
                              className="rounded-xl border-border focus-visible:ring-danger font-semibold"
                              value={withdrawDetails}
                              onChange={(e) => setWithdrawDetails(e.target.value)}
                              required
                            />
                          </div>

                          <div className="space-y-1.5 border-t border-dashed pt-3 mt-1">
                            <Label htmlFor="w_pin" className="font-bold text-danger flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5" />
                              {t('prof_2fa_pin')}
                            </Label>
                            <Input
                              id="w_pin"
                              type="password"
                              maxLength={4}
                              placeholder="• • • •"
                              className="rounded-xl border-danger/20 focus-visible:ring-danger text-center tracking-[0.5em] font-extrabold text-lg"
                              value={enteredPin}
                              onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ''))}
                              required
                            />
                            <p className="text-[10px] text-muted-foreground text-center">{t('prof_wrong_pin_blocks')}</p>
                          </div>
                        </div>

                        <DialogFooter>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            className="rounded-xl text-muted-foreground"
                            onClick={() => {
                              setWithdrawOpen(false);
                              setEnteredPin('');
                            }}
                            disabled={isWithdrawing}
                          >
                            {t('cancel')}
                          </Button>
                          <Button 
                            type="submit" 
                            className="bg-danger hover:bg-danger/90 text-white font-bold rounded-xl"
                            disabled={isWithdrawing}
                          >
                            {isWithdrawing ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                {t('prof_secure_withdrawing')}
                              </>
                            ) : t('prof_confirm_withdraw')}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-between">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-secondary" />
                {t('prof_total_capital_saved')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="text-3xl font-extrabold tracking-tight">
                {computedTotalSaved.toLocaleString()} <span className="text-lg font-medium text-muted-foreground">{groups[0]?.currency || "FCFA"}</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-secondary font-medium">
                <TrendingUp className="w-4 h-4" />
                <span>{t('prof_all_circles_combined')}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-between">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" />
                {t('prof_punctuality_rate')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-2">
              <div className="text-3xl font-extrabold tracking-tight">
                {punctualityRate}%
              </div>
              <Progress value={punctualityRate} className="h-2" />
              <p className="text-xs text-muted-foreground pt-1">
                {t('prof_punctuality_desc')}
              </p>
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-between">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" />
                {t('prof_active_circles_joined')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="text-3xl font-extrabold tracking-tight">
                {groupsJoinedCount} <span className="text-lg font-medium text-muted-foreground">{t('circles_unit')}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {t('prof_member_of_prefix')} {groupsJoinedCount} {t('prof_member_of_suffix')}
              </p>
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-between col-span-1">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-brand" />
                {t('prof_contributions_dashboard')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="bg-success-soft/50 p-2 rounded-xl border border-secondary/20">
                  <span className="font-bold text-lg text-secondary block">{paidCount}</span>
                  <span className="text-muted-foreground">{t('prof_paid_plural')}</span>
                </div>
                <div className="bg-danger-soft/50 p-2 rounded-xl border border-danger/20">
                  <span className="font-bold text-lg text-danger block">{lateCount}</span>
                  <span className="text-muted-foreground">{t('prof_lates')}</span>
                </div>
                <div className="bg-blue-50/50 p-2 rounded-xl border border-blue-100">
                  <span className="font-bold text-md text-blue-600 block">{pendingApprovalCount}</span>
                  <span className="text-[10px] text-muted-foreground">{t('status_verification_short')}</span>
                </div>
                <div className="bg-muted p-2 rounded-xl border">
                  <span className="font-bold text-md block">{pendingCount}</span>
                  <span className="text-muted-foreground">{t('prof_to_pay')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Historical logs table card with Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex overflow-x-auto gap-2 mb-4 bg-transparent p-0 scrollbar-none snap-x max-w-full">
          <TabsTrigger value="contributions" className="rounded-xl font-bold py-2 px-4 data-[state=active]:bg-brand data-[state=active]:text-white bg-muted">{t('contributions')}</TabsTrigger>
          <TabsTrigger value="wallet" className="rounded-xl font-bold py-2 px-4 data-[state=active]:bg-brand data-[state=active]:text-white bg-muted">{t('my_wallet')}</TabsTrigger>
          <TabsTrigger value="referral" className="rounded-xl font-bold py-2 px-4 data-[state=active]:bg-brand data-[state=active]:text-white bg-muted flex items-center gap-1.5"><Gift className="w-4 h-4"/> Parrainage</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl font-bold py-2 px-4 data-[state=active]:bg-brand data-[state=active]:text-white bg-muted flex items-center gap-1.5">
            <Settings className="w-4 h-4" />
            {t('settings')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contributions">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 gap-4">
              <div>
                <CardTitle>{t('prof_contributions_registry')}</CardTitle>
                <CardDescription>
                  {t('prof_contributions_registry_desc')}
                </CardDescription>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <Button 
                  size="sm" 
                  variant={filterStatus === 'all' ? 'default' : 'outline'}
                  className="rounded-xl"
                  onClick={() => setFilterStatus('all')}
                >
                  {t('all')}
                </Button>
                <Button
                  size="sm"
                  variant={filterStatus === 'paid' ? 'default' : 'outline'}
                  className="rounded-xl"
                  onClick={() => setFilterStatus('paid')}
                >
                  {t('prof_paid_plural')}
                </Button>
                <Button
                  size="sm"
                  variant={filterStatus === 'pending_approval' ? 'default' : 'outline'}
                  className="rounded-xl"
                  onClick={() => setFilterStatus('pending_approval')}
                >
                  {t('prof_in_verification')}
                </Button>
                <Button
                  size="sm"
                  variant={filterStatus === 'late' ? 'default' : 'outline'}
                  className="rounded-xl font-medium"
                  onClick={() => setFilterStatus('late')}
                >
                  {t('status_late')}
                </Button>
              </div>
            </CardHeader>
            
            <CardContent>
              {loadingContributions ? (
                <div className="flex items-center justify-center py-20 text-muted-foreground">
                  <Clock className="w-6 h-6 animate-spin mr-2" />
                  {t('prof_fetching_ledger')}
                </div>
              ) : getFilteredContributions.length === 0 ? (
                <EmptyState
                  icon={AlertTriangle}
                  title={t('prof_no_contribution')}
                  description={t('prof_no_contribution_desc')}
                  variant="amber"
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('prof_circle_col')}</TableHead>
                        <TableHead>{t('prof_call_period_col')}</TableHead>
                        <TableHead>{t('amount')}</TableHead>
                        <TableHead>{t('prof_due_date_col')}</TableHead>
                        <TableHead>{t('status')}</TableHead>
                        <TableHead>{t('prof_id_ref_col')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getFilteredContributions.map((c) => (
                        <TableRow key={c.id} className="hover:bg-muted/50">
                          <TableCell className="font-semibold">{getGroupName(c.groupId)}</TableCell>
                          <TableCell className="font-medium text-foreground">{c.period || "-"}</TableCell>
                          <TableCell className="font-bold">
                            {c.amount.toLocaleString()} {groups[0]?.currency || "FCFA"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(c.date), 'dd MMMM yyyy HH:mm', { locale: fr })}
                          </TableCell>
                          <TableCell>
                            {c.status === 'paid' && (
                              <Badge className="bg-success-soft text-secondary border-secondary/20">{t('status_paid')}</Badge>
                            )}
                            {c.status === 'pending_approval' && (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-200 animate-pulse">{t('status_verification_short')}</Badge>
                            )}
                            {c.status === 'pending' && (
                              <Badge variant="outline" className="text-brand border-brand/20 bg-brand/10">{t('status_pending')}</Badge>
                            )}
                            {c.status === 'late' && (
                              <Badge variant="destructive">{t('status_late')}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {c.proofOfPayment?.reference ? (
                              <span className="flex items-center gap-1.5 text-blue-600 bg-blue-50/50 py-1 px-2.5 rounded-lg border border-blue-100 max-w-max">
                                <Clock className="w-3.5 h-3.5" />
                                {c.proofOfPayment.reference}
                              </span>
                            ) : c.status === 'paid' ? (
                              <span className="flex items-center gap-1 text-secondary bg-success-soft/50 py-1 px-2.5 rounded-lg border border-secondary/20 max-w-max">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {t('prof_direct_validation')}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wallet">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 gap-4">
              <div>
                <CardTitle>{t('prof_wallet_transactions')}</CardTitle>
                <CardDescription>
                  {t('prof_wallet_transactions_desc')}
                </CardDescription>
              </div>
              {walletTransactions.length > 0 && (
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportCSV}
                    className="rounded-xl flex items-center gap-1.5 h-8 text-xs font-bold border-border hover:bg-muted text-foreground"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-secondary" />
                    <span>{t('prof_export_csv')}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportPDF}
                    className="rounded-xl flex items-center gap-1.5 h-8 text-xs font-bold border-border hover:bg-muted text-foreground"
                  >
                    <FileText className="w-3.5 h-3.5 text-danger" />
                    <span>{t('prof_statement_pdf')}</span>
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {walletTransactions.length > 0 && (
                <div className="h-48 mb-6 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...walletTransactions].reverse().map(t => ({ date: format(new Date(t.created_at), 'dd/MM'), amount: t.amount }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                      <YAxis hide domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                      <Line type="monotone" dataKey="amount" stroke="#16a34a" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {loadingTransactions ? (
                <div className="flex items-center justify-center py-20 text-muted-foreground">
                  <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                  {t('prof_fetching_wallet')}
                </div>
              ) : walletTransactions.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title={t('prof_no_transaction')}
                  description={t('prof_no_transaction_desc')}
                  actionText={t('recharge_wallet_title')}
                  onAction={() => setRechargeOpen(true)}
                  variant="emerald"
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('prof_type')}</TableHead>
                        <TableHead>{t('prof_description')}</TableHead>
                        <TableHead>{t('amount')}</TableHead>
                        <TableHead>{t('prof_date_time')}</TableHead>
                        <TableHead>{t('prof_method')}</TableHead>
                        <TableHead>{t('status')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {walletTransactions.map((tx) => (
                        <TableRow key={tx.id} className="hover:bg-muted/50">
                          <TableCell>
                            {tx.amount > 0 ? (
                              <Badge className="bg-success-soft text-secondary border-secondary/20 flex items-center gap-1 max-w-max">
                                <ArrowUpRight className="w-3 h-3" />
                                {t('prof_credit')}
                              </Badge>
                            ) : (
                              <Badge className="bg-danger-soft text-danger border-danger/20 flex items-center gap-1 max-w-max">
                                <ArrowDownRight className="w-3 h-3" />
                                {t('prof_debit')}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold text-foreground">
                            {tx.description}
                          </TableCell>
                          <TableCell className={`font-black ${tx.amount > 0 ? 'text-secondary' : 'text-danger'}`}>
                            {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} FCFA
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs font-medium">
                            {format(new Date(tx.date), 'dd MMMM yyyy HH:mm', { locale: fr })}
                          </TableCell>
                          <TableCell>
                            <span className="capitalize text-xs bg-muted py-1 px-2.5 rounded-lg border font-semibold text-muted-foreground">
                              {tx.paymentMethod || 'Paydunya'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-success-soft0 text-white font-semibold">
                              {tx.status === 'completed' ? t('prof_completed') : tx.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referral">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-brand">
                <Gift className="w-6 h-6" />
                Invitez vos proches, gagnez plus !
              </CardTitle>
              <CardDescription>
                Parrainez vos amis et gagnez 1000 FCFA pour chaque ami qui rejoint un cercle de tontine.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted p-6 rounded-2xl border border-border text-center space-y-4">
                <h4 className="font-bold text-foreground">Votre code de parrainage</h4>
                <div className="flex items-center justify-center gap-3">
                  <div className="bg-background border-2 border-dashed border-brand/50 px-6 py-3 rounded-xl font-mono text-2xl font-black text-brand tracking-widest">
                    EGANYE-{user.uid.substring(0, 5).toUpperCase()}
                  </div>
                  <Button variant="outline" size="icon" className="rounded-xl h-12 w-12" onClick={() => {
                    navigator.clipboard.writeText(`EGANYE-${user.uid.substring(0, 5).toUpperCase()}`);
                    toast.success('Code copié !');
                  }}>
                    <Copy className="w-5 h-5 text-muted-foreground" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">Partagez ce code avec vos contacts</p>
                <Button className="mt-4 rounded-xl font-bold bg-brand hover:bg-brand-deep w-full sm:w-auto">
                  <Share2 className="w-4 h-4 mr-2" />
                  Partager l'application
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-success-soft border border-secondary/20">
                  <p className="text-xs font-bold uppercase text-secondary">Amis parrainés</p>
                  <p className="text-3xl font-black text-secondary mt-1">0</p>
                </div>
                <div className="p-4 rounded-2xl bg-brand/10 border border-brand/20">
                  <p className="text-xs font-bold uppercase text-brand">Gains générés</p>
                  <p className="text-3xl font-black text-brand mt-1">0 FCFA</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <Settings className="w-5 h-5 text-brand" />
                {t('prof_general_settings')}
              </CardTitle>
              <CardDescription>
                {t('prof_general_settings_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left Column: Traditional Forms */}
                <div className="lg:col-span-6 space-y-6 min-w-0 w-full overflow-hidden">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-widest border-b pb-1">{t('prof_security_identity')}</h3>

                    <div className="space-y-1.5">
                      <Label htmlFor="set_name" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-brand" />
                        {t('prof_username_nickname')}
                      </Label>
                      <Input
                        id="set_name"
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                        className="rounded-xl border-border focus-visible:ring-primary"
                        placeholder={t('prof_ex_name')}
                      />
                    </div>

                    {canChangePassword && (
                      <div className="space-y-1.5">
                        <Label htmlFor="set_pass" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-brand" />
                          {t('prof_new_password')}
                        </Label>
                        <Input
                          id="set_pass"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="rounded-xl border-border focus-visible:ring-primary"
                          placeholder={t('prof_leave_blank')}
                          minLength={6}
                        />
                        <p className="text-[10px] text-muted-foreground">{t('prof_leave_blank_pw_desc')}</p>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="set_pin" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Lock className="text-danger w-3.5 h-3.5 animate-pulse" />
                        {t('prof_withdrawal_pin')}
                      </Label>
                      <Input
                        id="set_pin"
                        type="text"
                        maxLength={4}
                        pattern="\d{4}"
                        value={editSecurityPin}
                        onChange={(e) => setEditSecurityPin(e.target.value.replace(/\D/g, ''))}
                        className="rounded-xl border-border focus-visible:ring-danger font-mono tracking-[0.25em] font-bold text-foreground"
                        placeholder={user.securityPin ? t('prof_pin_placeholder_set') : t('prof_pin_placeholder_define')}
                      />
                      <p className="text-[10px] text-muted-foreground">{t('prof_pin_desc')}</p>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-widest border-b pb-1">{t('display_preferences')}</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-brand" />
                          {t('app_language')}
                        </Label>
                        <div className="grid grid-cols-4 gap-1 bg-muted p-1 rounded-xl border border-border">
                          <button
                            type="button"
                            onClick={() => setEditLanguage('fr')}
                            className={`text-[10px] font-bold py-1.5 rounded-lg transition-all ${editLanguage === 'fr' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            FR
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditLanguage('en')}
                            className={`text-[10px] font-bold py-1.5 rounded-lg transition-all ${editLanguage === 'en' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            EN
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditLanguage('wo')}
                            className={`text-[10px] font-bold py-1.5 rounded-lg transition-all ${editLanguage === 'wo' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            WO
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditLanguage('bm')}
                            className={`text-[10px] font-bold py-1.5 rounded-lg transition-all ${editLanguage === 'bm' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            BM
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-brand" />
                          {t('visual_theme')}
                        </Label>
                        <div className="flex gap-1.5 bg-muted p-1 rounded-xl border border-border">
                          <button
                            type="button"
                            onClick={() => {
                              setEditTheme('light');
                              document.documentElement.classList.remove('dark');
                              document.documentElement.classList.add('light');
                            }}
                            className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-all ${editTheme === 'light' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            {t('light_mode')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditTheme('dark');
                              document.documentElement.classList.remove('light');
                              document.documentElement.classList.add('dark');
                            }}
                            className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-all ${editTheme === 'dark' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            {t('dark_mode')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-widest border-b pb-1">{t('prof_notifications_section')}</h3>

                    <div className="flex items-center justify-between bg-muted p-3.5 rounded-2xl border border-border">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-500/10 rounded-xl text-blue-500">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-foreground">{t('prof_email_notif')}</h4>
                          <p className="text-[10px] text-muted-foreground font-medium">{t('prof_email_notif_desc')}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        title={emailNotifEnabled ? t('prof_disable_email') : t('prof_enable_email')}
                        aria-label={emailNotifEnabled ? t('prof_disable_email') : t('prof_enable_email')}
                        onClick={handleToggleEmailNotifications}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          emailNotifEnabled ? 'bg-secondary' : 'bg-border'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                            emailNotifEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: Dynamic Reusable SVG Avatar Workshop */}
                <div className="lg:col-span-6 bg-muted/50 p-2 sm:p-4 rounded-2xl border border-border min-w-0 w-full overflow-hidden">
                  <AvatarWorkshop 
                    value={editAvatar} 
                    onChange={setEditAvatar} 
                  />
                </div>

              </div>
            </CardContent>
            <CardFooter className="flex justify-end border-t pt-4">
              <Button 
                onClick={async () => {
                  if (!editDisplayName.trim()) {
                    toast.error(t('prof_valid_username'));
                    return;
                  }
                  if (editSecurityPin && editSecurityPin.length !== 4) {
                    toast.error(t('prof_pin_exactly_4'));
                    return;
                  }
                  if (newPassword && newPassword.length < 6) {
                    toast.error(t('prof_pw_min_6'));
                    return;
                  }
                  setSavingSettings(true);
                  try {
                    if (newPassword) {
                      const { error: pwError } = await changePassword(newPassword);
                      if (pwError) {
                        if (pwError.message?.toLowerCase().includes('session')) {
                          toast.error(t('prof_pw_relogin'));
                        } else {
                          toast.error(t('prof_pw_change_failed') + pwError.message);
                        }
                        setSavingSettings(false);
                        return;
                      }
                    }

                    const { error: profileError } = await supabase.from('profiles').update({
                      display_name: editDisplayName,
                      language: editLanguage,
                      theme: editTheme,
                      avatar_config: editAvatar,
                    }).eq('id', user.uid);
                    if (profileError) throw profileError;

                    if (editSecurityPin) {
                      const { error: pinError } = await supabase.rpc('set_user_pin', {
                        p_user_id: user.uid,
                        p_new_pin: editSecurityPin,
                      });
                      if (pinError) throw pinError;
                    }

                    // Sync to global context
                    await setLanguage(editLanguage as any);

                    // Apply theme setting dynamically to document body/html class list
                    if (editTheme === 'dark') {
                      document.documentElement.classList.add('dark');
                      localStorage.setItem('eganye_theme', 'dark');
                    } else {
                      document.documentElement.classList.remove('dark');
                      localStorage.setItem('eganye_theme', 'light');
                    }

                    setNewPassword('');
                    setEditSecurityPin('');
                    toast.success(t('prof_settings_saved'));
                  } catch (error) {
                    console.error("Error saving settings:", error);
                    toast.error(t('prof_settings_error'));
                  } finally {
                    setSavingSettings(false);
                  }
                }}
                disabled={savingSettings}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl px-8 flex items-center gap-2"
              >
                {savingSettings ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {t('prof_save_settings')}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Wallet recharge confirmation bottom sheet */}
      <ConfirmationBottomSheet
        isOpen={isConfirmRechargeOpen}
        onClose={() => setIsConfirmRechargeOpen(false)}
        onConfirm={executeRecharge}
        title={t('prof_confirm_recharge_title')}
        description={t('prof_confirm_recharge_desc')}
        amount={parseFloat(rechargeAmount) || 0}
        type="recharge"
        isLoading={isRedirecting}
      />
    </motion.div>
  );
}
