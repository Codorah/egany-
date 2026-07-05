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
  FileText
} from 'lucide-react';
import { UserProfile, Group, Contribution, WalletTransaction } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { executeFinancialTransaction, verifyUserPin } from '@/lib/ledger';
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
  const [editPassword, setEditPassword] = useState(user.password || '');
  const [editLanguage, setEditLanguage] = useState(user.language || 'fr');
  const [editTheme, setEditTheme] = useState(user.theme || 'light');
  const [editSecurityPin, setEditSecurityPin] = useState(user.securityPin || '0000');

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
    setEditPassword(user.password || '');
    setEditLanguage(user.language || 'fr');
    setEditTheme(user.theme || 'light');
    setEditSecurityPin(user.securityPin || '0000');
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
    const unsub = onSnapshot(collection(db, 'users', user.uid, 'walletTransactions'), (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WalletTransaction[];
      txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setWalletTransactions(txs);
      setLoadingTransactions(false);
    }, (error) => {
      console.error("Error fetching transactions:", error);
      setLoadingTransactions(false);
    });
    return () => unsub();
  }, [user.uid]);

  const handleExportCSV = () => {
    if (walletTransactions.length === 0) {
      toast.error("Aucune transaction disponible pour l'export.");
      return;
    }
    
    // Headers
    const headers = ['Type', 'Description', 'Montant (FCFA)', 'Date', 'Methode', 'Statut'];
    
    // Rows
    const rows = walletTransactions.map(tx => {
      const typeStr = tx.amount > 0 ? 'Crédit' : 'Débit';
      const dateStr = format(new Date(tx.date), 'yyyy-MM-dd HH:mm');
      const methodStr = tx.paymentMethod || 'Paydunya';
      const statusStr = tx.status === 'completed' ? 'Complété' : tx.status;
      
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
    toast.success("Historique exporté au format CSV !");
  };

  const handleExportPDF = () => {
    if (walletTransactions.length === 0) {
      toast.error("Aucune transaction disponible pour l'export.");
      return;
    }
    
    // Calculate summaries
    const totalCredits = walletTransactions.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
    const totalDebits = walletTransactions.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const currentBalance = user.walletBalance || 0;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Veuillez autoriser les popups pour pouvoir exporter en PDF.");
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
          <div class="title">Relevé de Portefeuille</div>
        </div>
        
        <div class="details">
          <div class="details-col">
            <h4>Titulaire du compte</h4>
            <p>${user.displayName}</p>
            <p style="font-size: 12px; color: #64748b; font-weight: normal; margin-top: 2px;">${user.email || ''}</p>
          </div>
          <div class="details-col" style="text-align: right;">
            <h4>Période du Relevé</h4>
            <p>Jusqu'au ${format(new Date(), 'dd MMMM yyyy', { locale: fr })}</p>
          </div>
        </div>

        <div style="display: flex; gap: 20px; margin-bottom: 35px;">
          <div class="summary-card" style="flex: 1;">
            <h5>Total Crédité</h5>
            <p style="color: #10b981; font-weight: bold;">+${totalCredits.toLocaleString()} FCFA</p>
          </div>
          <div class="summary-card" style="flex: 1;">
            <h5>Total Débité</h5>
            <p style="color: #f43f5e; font-weight: bold;">-${totalDebits.toLocaleString()} FCFA</p>
          </div>
          <div class="summary-card" style="flex: 1; background-color: #fffbeb; border-color: #fef3c7;">
            <h5>Solde Actuel</h5>
            <p style="color: #b45309; font-weight: bold;">${currentBalance.toLocaleString()} FCFA</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Mouvement</th>
              <th>Description</th>
              <th style="text-align: right;">Montant</th>
              <th>Date & Heure</th>
              <th>Méthode</th>
              <th style="text-align: right;">Statut</th>
            </tr>
          </thead>
          <tbody>
            ${transactionsHtml}
          </tbody>
        </table>

        <div class="footer">
          Document généré électroniquement par eganyé - Votre tontine numérique fiable et solidaire.<br>
          © ${new Date().getFullYear()} eganyé. Tous droits réservés.
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
    toast.success("Document PDF généré ! Lancez l'impression ou enregistrez au format PDF.");
  };

  const handleRechargeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(rechargeAmount);
    if (isNaN(amt) || amt < 100) {
      toast.error("Veuillez saisir un montant minimum de 100 FCFA.");
      return;
    }
    setRechargeOpen(false);
    setIsConfirmRechargeOpen(true);
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Veuillez entrer un montant valide.");
      return;
    }
    if (amountNum < 500) {
      toast.error("Le montant minimum de retrait est de 500 FCFA.");
      return;
    }
    if (amountNum > (user.walletBalance || 0)) {
      toast.error("Solde insuffisant dans votre portefeuille virtuel.");
      return;
    }
    if (enteredPin.length !== 4) {
      toast.error("Veuillez entrer un code PIN à 4 chiffres.");
      return;
    }

    setIsWithdrawing(true);
    try {
      // 1. Verify PIN
      const pinCorrect = await verifyUserPin(user.uid, enteredPin);
      if (!pinCorrect) {
        // Create Failed Audit Entry in firestore
        await addDoc(collection(db, 'auditLogs'), {
          id: `audit_failed_${Date.now()}`,
          userId: user.uid,
          action: 'withdrawal_failed_pin',
          details: `Tentative de retrait de ${amountNum.toLocaleString()} FCFA avec un code PIN erroné`,
          ip: '197.234.34.82', // Simulated West-African IP
          device: navigator.userAgent || 'WebBrowser',
          status: 'failed',
          timestamp: new Date().toISOString()
        });

        toast.error("Code PIN de sécurité incorrect. Retrait refusé.");
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

      // 3. Create matching wallet transaction subcollection entry for user display
      await addDoc(collection(db, 'users', user.uid, 'walletTransactions'), {
        userId: user.uid,
        amount: -amountNum,
        type: 'withdraw',
        description: `Retrait vers ${withdrawMethod.toUpperCase()}`,
        date: new Date().toISOString(),
        status: 'completed',
        paymentMethod: withdrawMethod,
        reference: ledgerResult.transactionId || `wdr_${Date.now()}`
      });

      // 4. Create User Notification
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        title: 'Retrait de fonds validé !',
        message: `Votre demande de retrait de ${amountNum.toLocaleString()} FCFA vers votre compte ${withdrawMethod.toUpperCase()} a été traitée de manière sécurisée et intègre.`,
        type: 'system',
        read: false,
        createdAt: serverTimestamp()
      });

      toast.success(`Retrait de ${amountNum.toLocaleString()} FCFA effectué avec succès !`);
      setWithdrawOpen(false);
      setWithdrawAmount('');
      setWithdrawDetails('');
      setEnteredPin('');
    } catch (error: any) {
      console.error("Error executing withdrawal transaction:", error);
      toast.error(error.message || "Une erreur est survenue lors de l'enregistrement de votre retrait.");
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
        toast.info("Redirection vers le portail sécurisé Paydunya...");
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Une erreur s'est produite");
      }
    } catch (error: any) {
      console.error("Recharge Paydunya error:", error);
      toast.error(error.message || "Erreur lors de l'initiation de la recharge.");
    } finally {
      setIsRedirecting(false);
      setIsConfirmRechargeOpen(false);
    }
  };

  // Live snapshot listener to fetch user's contributions across all groups
  useEffect(() => {
    if (!groups || groups.length === 0) {
      setContributions([]);
      setLoadingContributions(false);
      return;
    }

    setLoadingContributions(true);
    const unsubscribes: (() => void)[] = [];
    const contributionsMap: { [groupId: string]: Contribution[] } = {};
    let activeListeners = groups.length;

    groups.forEach((group) => {
      const q = query(
        collection(db, 'groups', group.id, 'contributions'),
        where('userId', '==', user.uid)
      );

      const unsub = onSnapshot(q, (snapshot) => {
        const groupConts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Contribution[];

        contributionsMap[group.id] = groupConts;

        // Flatten and combine all contributions
        const allConts = Object.values(contributionsMap).flat().sort((a, b) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });

        setContributions(allConts);
        setLoadingContributions(false);
      }, (error) => {
        console.error(`Error fetching contributions for group ${group.id}:`, error);
        activeListeners--;
        if (activeListeners === 0) {
          setLoadingContributions(false);
        }
      });

      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
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
          await updateDoc(doc(db, 'users', user.uid), {
            reputationScore: computedScore,
            totalSaved: computedTotalSaved,
            groupsJoined: groupsJoinedCount,
            updatedAt: new Date().toISOString()
          });
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
      color: "text-emerald-600 stroke-emerald-600 fill-emerald-50", 
      ringColor: "stroke-emerald-100",
      bgBadg: "bg-emerald-100 text-emerald-800 border-emerald-200",
      name: "Fiabilité Exemplaire", 
      desc: "Excellent gestionnaire. Vos cotisations sont toujours payées à temps ou en avance." 
    };
    if (sc >= 70) return { 
      tier: "Tier A", 
      color: "text-teal-600 stroke-teal-600 fill-teal-50", 
      ringColor: "stroke-teal-100",
      bgBadg: "bg-teal-100 text-teal-800 border-teal-200",
      name: "Membre de Confiance", 
      desc: "Trésorier et adhérent performant. Vous honorez vos échéances avec régularité." 
    };
    if (sc >= 50) return { 
      tier: "Tier B", 
      color: "text-amber-600 stroke-amber-600 fill-amber-50", 
      ringColor: "stroke-amber-100",
      bgBadg: "bg-amber-100 text-amber-800 border-amber-200",
      name: "Profil Régulier", 
      desc: "Membre correct. Essayez de régler vos cotisations un peu plus tôt pour remonter de Tier." 
    };
    return { 
      tier: "Tier C", 
      color: "text-rose-600 stroke-rose-600 fill-rose-50", 
      ringColor: "stroke-rose-100",
      bgBadg: "bg-rose-100 text-rose-800 border-rose-200",
      name: "Score Fragile", 
      desc: "Des retards répétés ont affecté votre fiabilité financière. Réglez les cotisations en suspens." 
    };
  };

  const scoreInfo = getScoreInfo(computedScore);

  const getGroupName = (groupId: string) => {
    const gp = groups.find(g => g.id === groupId);
    return gp ? gp.name : "Cercle inconnu";
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
          <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-amber-500/30 flex items-center justify-center bg-slate-50">
            {user.photoURL ? (
              <CustomAvatar config={user.photoURL} size={80} />
            ) : (
              <div className="text-2xl font-semibold text-amber-700 bg-amber-100 w-full h-full flex items-center justify-center">
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
              Inscrit le {format(new Date(user.createdAt || Date.now()), 'dd MMMM yyyy', { locale: fr })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-xl flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer active:scale-95 transition-transform"
            onClick={() => setShowExplanation(!showExplanation)}
          >
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
            <span>Formule du Score</span>
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
            <Card className="bg-[#FBF8F3]/80 border border-[#D4A574]/30 shadow-sm rounded-3xl">
              <CardHeader className="pb-3 border-b border-[#D4A574]/15">
                <CardTitle className="text-md font-bold flex items-center gap-2 text-[#4B2E05]">
                  <Sparkles className="w-5 h-5 text-[#E67E22]" />
                  Calculateur de Score de Réputation en Temps Réel
                </CardTitle>
                <CardDescription className="text-[#4B2E05]/80 font-medium">
                  Le score récompense la rigueur de vos dépôts pour sécuriser le cercle d'épargne.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                
                {/* Visual Math Step Block */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-stretch text-center">
                  
                  {/* Step 1: Base Score */}
                  <div className="bg-white p-4 rounded-2xl border border-[#D4A574]/20 flex flex-col justify-between shadow-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Score de Confiance</span>
                      <span className="text-3xl font-serif font-black text-slate-700">60</span>
                      <span className="text-xs text-muted-foreground block mt-1">Capital initial octroyé</span>
                    </div>
                    <div className="text-lg font-bold text-[#D4A574] mt-2">+</div>
                  </div>

                  {/* Step 2: On-time Bonuses */}
                  <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100 flex flex-col justify-between shadow-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-600 block mb-1">Bonus Versements</span>
                      <span className="text-3xl font-serif font-black text-emerald-600">+{paidCount * 8}</span>
                      <span className="text-xs text-slate-500 block mt-1">
                        {paidCount} versement{paidCount > 1 ? 's' : ''} payé{paidCount > 1 ? 's' : ''} (+8 pts / dépôt)
                      </span>
                    </div>
                    <div className="text-lg font-bold text-[#D4A574] mt-2">−</div>
                  </div>

                  {/* Step 3: Late Penalties */}
                  <div className="bg-rose-50/40 p-4 rounded-2xl border border-rose-100 flex flex-col justify-between shadow-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-rose-600 block mb-1">Pénalités Retards</span>
                      <span className="text-3xl font-serif font-black text-rose-600">-{lateCount * 18}</span>
                      <span className="text-xs text-slate-500 block mt-1">
                        {lateCount} retard{lateCount > 1 ? 's' : ''} constaté{lateCount > 1 ? 's' : ''} (-18 pts / retard)
                      </span>
                    </div>
                    <div className="text-lg font-bold text-[#D4A574] mt-2">=</div>
                  </div>

                  {/* Step 4: Final Reputation Score */}
                  <div className="bg-amber-500 text-slate-950 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-900 block mb-1">Score Actuel</span>
                      <span className="text-3xl font-serif font-black">{computedScore}</span>
                      <span className="text-[10px] font-bold block mt-1">Cliqué & mis à jour en direct</span>
                    </div>
                    <div className="text-xs font-bold mt-2 bg-white/20 px-2 py-0.5 rounded-full inline-block mx-auto">
                      {scoreInfo.tier}
                    </div>
                  </div>

                </div>

                {/* dynamic tips based on score */}
                <div className="bg-white/80 p-4 rounded-2xl border border-[#D4A574]/20 space-y-2">
                  <h4 className="font-bold text-xs text-[#4B2E05] flex items-center gap-1.5 uppercase">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Conseil d'amélioration personnalisé
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {computedScore >= 85 && (
                      "Félicitations ! Votre score exemplaire (Tier S) vous confère la priorité absolue pour être désigné premier bénéficiaire des fonds des tontines auxquelles vous postulez."
                    )}
                    {computedScore >= 70 && computedScore < 85 && (
                      "Excellent ! Vous êtes un membre de confiance (Tier A). Pour passer au Tier S, assurez-vous d'anticiper le rechargement de votre portefeuille virtuel 24h avant chaque échéance."
                    )}
                    {computedScore >= 50 && computedScore < 70 && (
                      "Votre réputation est correcte (Tier B) mais perfectible. Astuce : Pour éviter les oublis, effectuez des recharges régulières de votre compte via Wave ou Orange Money."
                    )}
                    {computedScore < 50 && (
                      "Attention ! Votre score est critique (Tier C) à cause de retards répétés. Pour restaurer votre réputation, alimentez immédiatement votre solde de portefeuille et réglez vos cotisations en attente."
                    )}
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
              Fiabilité Globale
            </CardTitle>
            <CardDescription>
              Performance instantanée de trésorerie
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
                <span className="text-xs block font-medium text-slate-400">/ 100</span>
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
          <Card className="flex flex-col justify-between border-amber-200 bg-amber-50/20 sm:col-span-2">
            <CardHeader className="pb-1">
              <div className="flex justify-between items-start">
                <CardTitle className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-amber-600" />
                  Portefeuille Virtuel Tontine
                </CardTitle>
                <Badge className="bg-amber-600/15 text-amber-700 border-amber-300">Sécurisé par Paydunya</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-3xl font-black text-slate-900 tracking-tight">
                    {(user.walletBalance || 0).toLocaleString()} <span className="text-lg font-bold text-slate-500">FCFA</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Solde disponible pour vos prélèvements et versements automatiques.
                  </p>
                </div>
                
                <div className="flex gap-2 items-center flex-wrap shrink-0">
                  <Dialog open={rechargeOpen} onOpenChange={setRechargeOpen}>
                    <DialogTrigger render={
                      <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl flex items-center gap-2 shadow-sm">
                        <Plus className="w-4 h-4" />
                        Recharger via Paydunya
                      </Button>
                    } />
                    <DialogContent className="sm:max-w-[425px]">
                      <form onSubmit={handleRechargeSubmit}>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 font-bold text-xl text-slate-900">
                            <Wallet className="w-5 h-5 text-amber-500" />
                            Recharger mon Portefeuille
                          </DialogTitle>
                          <DialogDescription className="text-slate-500 text-xs font-normal">
                            Alimentez votre portefeuille virtuel via Paydunya (Wave, Orange Money, MTN, Carte Bancaire) pour automatiser vos cotisations quotidiennes de tontine.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-6">
                          <div className="space-y-2">
                            <Label htmlFor="amount" className="font-bold text-slate-700 text-sm">
                              Montant de la recharge (FCFA)
                            </Label>
                            <div className="relative">
                              <Input
                                id="amount"
                                type="number"
                                placeholder="Ex: 5000"
                                className="pr-14 font-extrabold text-lg text-slate-900 focus-visible:ring-amber-500"
                                value={rechargeAmount}
                                onChange={(e) => setRechargeAmount(e.target.value)}
                                min="100"
                                required
                              />
                              <span className="absolute right-3 top-2.5 font-bold text-slate-400">FCFA</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-normal">Montant minimum : 100 FCFA</p>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            className="rounded-xl text-slate-500 hover:bg-slate-100"
                            onClick={() => setRechargeOpen(false)}
                            disabled={isRedirecting}
                          >
                            Annuler
                          </Button>
                          <Button 
                            type="submit" 
                            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl"
                            disabled={isRedirecting}
                          >
                            {isRedirecting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Redirection...
                              </>
                            ) : "Procéder au paiement"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
                    <DialogTrigger render={
                      <Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50 font-bold rounded-xl flex items-center gap-2">
                        <ArrowDownLeft className="w-4 h-4 text-rose-500" />
                        Retirer mes fonds
                      </Button>
                    } />
                    <DialogContent className="sm:max-w-[425px]">
                      <form onSubmit={handleWithdrawSubmit}>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 font-bold text-xl text-slate-900">
                            <ArrowDownLeft className="w-5 h-5 text-rose-500" />
                            Retirer de l'argent
                          </DialogTitle>
                          <DialogDescription className="text-slate-500 text-xs font-normal">
                            Transférez vos gains ou fonds disponibles de votre portefeuille virtuel vers votre compte externe (Mobile Money ou Carte Bancaire).
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="grid gap-4 py-4 text-xs">
                          <div className="space-y-1.5">
                            <Label htmlFor="w_amount" className="font-bold text-slate-700">
                              Montant à retirer (FCFA)
                            </Label>
                            <div className="relative">
                              <Input
                                id="w_amount"
                                type="number"
                                placeholder="Ex: 5000"
                                className="pr-14 font-extrabold text-lg text-slate-900 focus-visible:ring-rose-500"
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                min="500"
                                max={user.walletBalance || 0}
                                required
                              />
                              <span className="absolute right-3 top-2.5 font-bold text-slate-400">FCFA</span>
                            </div>
                            <p className="text-[10px] text-slate-400">Solde disponible : {(user.walletBalance || 0).toLocaleString()} FCFA (Min: 500 FCFA)</p>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="font-bold text-slate-700">Moyen de retrait</Label>
                            <div className="grid grid-cols-3 gap-2">
                              {['orange_money', 'wave', 'bank_card'].map((method) => (
                                <button
                                  key={method}
                                  type="button"
                                  onClick={() => setWithdrawMethod(method)}
                                  className={`p-2 rounded-xl border text-center transition-all font-bold ${withdrawMethod === method ? 'border-rose-500 bg-rose-50/30 text-rose-600' : 'border-slate-200 hover:bg-slate-50 text-slate-500'}`}
                                >
                                  {method === 'orange_money' ? 'OM' : method === 'wave' ? 'Wave' : 'Carte'}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="w_details" className="font-bold text-slate-700">
                              Numéro de téléphone / Coordonnées de destination
                            </Label>
                            <Input
                              id="w_details"
                              type="text"
                              placeholder="Ex: +221 77 123 45 67"
                              className="rounded-xl border-slate-200 focus-visible:ring-rose-500 font-semibold"
                              value={withdrawDetails}
                              onChange={(e) => setWithdrawDetails(e.target.value)}
                              required
                            />
                          </div>

                          <div className="space-y-1.5 border-t border-dashed pt-3 mt-1">
                            <Label htmlFor="w_pin" className="font-bold text-rose-600 flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5" />
                              2FA : Entrez votre code PIN de Retrait
                            </Label>
                            <Input
                              id="w_pin"
                              type="password"
                              maxLength={4}
                              placeholder="• • • •"
                              className="rounded-xl border-rose-200 focus-visible:ring-rose-500 text-center tracking-[0.5em] font-extrabold text-lg"
                              value={enteredPin}
                              onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ''))}
                              required
                            />
                            <p className="text-[10px] text-muted-foreground text-center">Un code PIN incorrect bloquera l'opération (Par défaut: 0000).</p>
                          </div>
                        </div>

                        <DialogFooter>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            className="rounded-xl text-slate-500"
                            onClick={() => {
                              setWithdrawOpen(false);
                              setEnteredPin('');
                            }}
                            disabled={isWithdrawing}
                          >
                            Annuler
                          </Button>
                          <Button 
                            type="submit" 
                            className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl"
                            disabled={isWithdrawing}
                          >
                            {isWithdrawing ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Retrait sécurisé...
                              </>
                            ) : "Confirmer le retrait"}
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
                <Wallet className="w-4 h-4 text-emerald-500" />
                Capital Total Épargné
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="text-3xl font-extrabold tracking-tight">
                {computedTotalSaved.toLocaleString()} <span className="text-lg font-medium text-muted-foreground">{groups[0]?.currency || "FCFA"}</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                <TrendingUp className="w-4 h-4" />
                <span>Tous les cercles d'épargne confondus</span>
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-between">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Taux de Ponctualité
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-2">
              <div className="text-3xl font-extrabold tracking-tight">
                {punctualityRate}%
              </div>
              <Progress value={punctualityRate} className="h-2" />
              <p className="text-xs text-muted-foreground pt-1">
                Mesure la part de paiements faits à temps sans dépassement ou pénalités de retard.
              </p>
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-between">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" />
                Cercles Actifs Rejoints
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="text-3xl font-extrabold tracking-tight">
                {groupsJoinedCount} <span className="text-lg font-medium text-muted-foreground">cercles</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Vous êtes membre de {groupsJoinedCount} différents cercles d'épargne tontine actifs.
              </p>
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-between col-span-1">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-500" />
                Tableau de bord des cotisations
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="bg-emerald-50/50 p-2 rounded-xl border border-emerald-100">
                  <span className="font-bold text-lg text-emerald-600 block">{paidCount}</span>
                  <span className="text-muted-foreground">Payés</span>
                </div>
                <div className="bg-rose-50/50 p-2 rounded-xl border border-rose-100">
                  <span className="font-bold text-lg text-rose-600 block">{lateCount}</span>
                  <span className="text-muted-foreground">Retards</span>
                </div>
                <div className="bg-blue-50/50 p-2 rounded-xl border border-blue-100">
                  <span className="font-bold text-md text-blue-600 block">{pendingApprovalCount}</span>
                  <span className="text-[10px] text-muted-foreground">Vérification</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border">
                  <span className="font-bold text-md block">{pendingCount}</span>
                  <span className="text-muted-foreground">À payer</span>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Historical logs table card with Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 max-w-[550px] mb-4 bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="contributions" className="rounded-lg font-bold py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Contributions</TabsTrigger>
          <TabsTrigger value="wallet" className="rounded-lg font-bold py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Portefeuille</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg font-bold py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-1.5">
            <Settings className="w-4 h-4" />
            Paramètres
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contributions">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 gap-4">
              <div>
                <CardTitle>Registre des Contributions</CardTitle>
                <CardDescription>
                  Historique complet de toutes vos transactions et justificatifs de versement
                </CardDescription>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <Button 
                  size="sm" 
                  variant={filterStatus === 'all' ? 'default' : 'outline'}
                  className="rounded-xl"
                  onClick={() => setFilterStatus('all')}
                >
                  Tous
                </Button>
                <Button 
                  size="sm" 
                  variant={filterStatus === 'paid' ? 'default' : 'outline'}
                  className="rounded-xl"
                  onClick={() => setFilterStatus('paid')}
                >
                  Payés
                </Button>
                <Button 
                  size="sm" 
                  variant={filterStatus === 'pending_approval' ? 'default' : 'outline'}
                  className="rounded-xl"
                  onClick={() => setFilterStatus('pending_approval')}
                >
                  En vérification
                </Button>
                <Button 
                  size="sm" 
                  variant={filterStatus === 'late' ? 'default' : 'outline'}
                  className="rounded-xl font-medium"
                  onClick={() => setFilterStatus('late')}
                >
                  En retard
                </Button>
              </div>
            </CardHeader>
            
            <CardContent>
              {loadingContributions ? (
                <div className="flex items-center justify-center py-20 text-muted-foreground">
                  <Clock className="w-6 h-6 animate-spin mr-2" />
                  Récupération du registre de trésorerie...
                </div>
              ) : getFilteredContributions.length === 0 ? (
                <EmptyState
                  icon={AlertTriangle}
                  title="Aucune contribution"
                  description="Aucune contribution n'a été enregistrée dans cette catégorie pour le moment. Vos cotisations s'afficheront ici automatiquement."
                  variant="amber"
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cercle d'épargne</TableHead>
                        <TableHead>Période d'appel</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Date d'échéance</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Identifiant / Réf de transaction</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getFilteredContributions.map((c) => (
                        <TableRow key={c.id} className="hover:bg-slate-50/50">
                          <TableCell className="font-semibold">{getGroupName(c.groupId)}</TableCell>
                          <TableCell className="font-medium text-slate-700">{c.period || "-"}</TableCell>
                          <TableCell className="font-bold">
                            {c.amount.toLocaleString()} {groups[0]?.currency || "FCFA"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(c.date), 'dd MMMM yyyy HH:mm', { locale: fr })}
                          </TableCell>
                          <TableCell>
                            {c.status === 'paid' && (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Payé</Badge>
                            )}
                            {c.status === 'pending_approval' && (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-200 animate-pulse">Vérification</Badge>
                            )}
                            {c.status === 'pending' && (
                              <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">En attente</Badge>
                            )}
                            {c.status === 'late' && (
                              <Badge variant="destructive">En retard</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-500">
                            {c.proofOfPayment?.reference ? (
                              <span className="flex items-center gap-1.5 text-blue-600 bg-blue-50/50 py-1 px-2.5 rounded-lg border border-blue-100 max-w-max">
                                <Clock className="w-3.5 h-3.5" />
                                {c.proofOfPayment.reference}
                              </span>
                            ) : c.status === 'paid' ? (
                              <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50/50 py-1 px-2.5 rounded-lg border border-emerald-100 max-w-max">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Validation direct
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
                <CardTitle>Transactions du Portefeuille</CardTitle>
                <CardDescription>
                  Historique complet de vos recharges Paydunya, prélèvements automatiques et payouts de tontine.
                </CardDescription>
              </div>
              {walletTransactions.length > 0 && (
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportCSV}
                    className="rounded-xl flex items-center gap-1.5 h-8 text-xs font-bold border-slate-200 hover:bg-slate-50 text-slate-700"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Export CSV</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportPDF}
                    className="rounded-xl flex items-center gap-1.5 h-8 text-xs font-bold border-slate-200 hover:bg-slate-50 text-slate-700"
                  >
                    <FileText className="w-3.5 h-3.5 text-rose-600" />
                    <span>Statement PDF</span>
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {loadingTransactions ? (
                <div className="flex items-center justify-center py-20 text-muted-foreground">
                  <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                  Récupération de l'historique du portefeuille...
                </div>
              ) : walletTransactions.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="Aucune transaction"
                  description="Votre portefeuille virtuel n'a encore enregistré aucun mouvement financier. Effectuez un rechargement pour commencer !"
                  actionText="Recharger mon portefeuille"
                  onAction={() => setRechargeOpen(true)}
                  variant="emerald"
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Date & Heure</TableHead>
                        <TableHead>Méthode</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {walletTransactions.map((tx) => (
                        <TableRow key={tx.id} className="hover:bg-slate-50/50">
                          <TableCell>
                            {tx.amount > 0 ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 flex items-center gap-1 max-w-max">
                                <ArrowUpRight className="w-3 h-3" />
                                Crédit
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-100 text-rose-800 border-rose-200 flex items-center gap-1 max-w-max">
                                <ArrowDownRight className="w-3 h-3" />
                                Débit
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold text-slate-800">
                            {tx.description}
                          </TableCell>
                          <TableCell className={`font-black ${tx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} FCFA
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs font-medium">
                            {format(new Date(tx.date), 'dd MMMM yyyy HH:mm', { locale: fr })}
                          </TableCell>
                          <TableCell>
                            <span className="capitalize text-xs bg-slate-100 py-1 px-2.5 rounded-lg border font-semibold text-slate-600">
                              {tx.paymentMethod || 'Paydunya'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-emerald-500 text-white font-semibold">
                              {tx.status === 'completed' ? 'Complété' : tx.status}
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

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-950">
                <Settings className="w-5 h-5 text-[#E67E22]" />
                Paramètres généraux d'eganyé
              </CardTitle>
              <CardDescription>
                Personnalisez vos identifiants de connexion, la langue de l'application, et dessinez votre avatar vectoriel unique.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left Column: Traditional Forms */}
                <div className="lg:col-span-6 space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest border-b pb-1">Sécurité & Identité</h3>
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="set_name" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-amber-500" />
                        Nom d'utilisateur / Surnom
                      </Label>
                      <Input 
                        id="set_name"
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                        className="rounded-xl border-slate-200 focus-visible:ring-amber-500"
                        placeholder="Ex: Fatou Sy"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="set_pass" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-500" />
                        Nouveau mot de passe
                      </Label>
                      <Input 
                        id="set_pass"
                        type="password"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        className="rounded-xl border-slate-200 focus-visible:ring-amber-500"
                        placeholder="Entrez un nouveau mot de passe"
                      />
                      <p className="text-[10px] text-muted-foreground">Laissé vide si vous ne voulez pas changer vos identifiants.</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="set_pin" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Lock className="text-rose-500 w-3.5 h-3.5 animate-pulse" />
                        Code PIN de Retrait Secouru (4 chiffres)
                      </Label>
                      <Input 
                        id="set_pin"
                        type="text"
                        maxLength={4}
                        pattern="\d{4}"
                        value={editSecurityPin}
                        onChange={(e) => setEditSecurityPin(e.target.value.replace(/\D/g, ''))}
                        className="rounded-xl border-slate-200 focus-visible:ring-rose-500 font-mono tracking-[0.25em] font-bold text-slate-900"
                        placeholder="0000"
                      />
                      <p className="text-[10px] text-muted-foreground">Sert d'authentification 2FA pour toutes vos actions de retrait (Défaut: 0000).</p>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest border-b pb-1">{t('display_preferences')}</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-amber-500" />
                          {t('app_language')}
                        </Label>
                        <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                          <button
                            type="button"
                            onClick={() => setEditLanguage('fr')}
                            className={`text-[10px] font-bold py-1.5 rounded-lg transition-all ${editLanguage === 'fr' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                          >
                            FR
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditLanguage('en')}
                            className={`text-[10px] font-bold py-1.5 rounded-lg transition-all ${editLanguage === 'en' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                          >
                            EN
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditLanguage('wo')}
                            className={`text-[10px] font-bold py-1.5 rounded-lg transition-all ${editLanguage === 'wo' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                          >
                            WO
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditLanguage('bm')}
                            className={`text-[10px] font-bold py-1.5 rounded-lg transition-all ${editLanguage === 'bm' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                          >
                            BM
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          {t('visual_theme')}
                        </Label>
                        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                          <button
                            type="button"
                            onClick={() => setEditTheme('light')}
                            className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-all ${editTheme === 'light' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                          >
                            {t('light_mode')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditTheme('dark')}
                            className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-all ${editTheme === 'dark' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                          >
                            {t('dark_mode')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Dynamic Reusable SVG Avatar Workshop */}
                <div className="lg:col-span-6 bg-slate-50/50 dark:bg-slate-900/30 p-2 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
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
                    toast.error("Veuillez entrer un nom d'utilisateur valide.");
                    return;
                  }
                  if (editSecurityPin && editSecurityPin.length !== 4) {
                    toast.error("Le code PIN de retrait doit comporter exactement 4 chiffres.");
                    return;
                  }
                  setSavingSettings(true);
                  try {
                    const userRef = doc(db, 'users', user.uid);
                    await updateDoc(userRef, {
                      displayName: editDisplayName,
                      password: editPassword,
                      language: editLanguage,
                      theme: editTheme,
                      photoURL: JSON.stringify(editAvatar),
                      securityPin: editSecurityPin || '0000',
                      updatedAt: new Date().toISOString()
                    });
                    
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

                    toast.success("Paramètres enregistrés avec succès !");
                  } catch (error) {
                    console.error("Error saving settings:", error);
                    toast.error("Erreur lors de la sauvegarde des paramètres.");
                  } finally {
                    setSavingSettings(false);
                  }
                }}
                disabled={savingSettings}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl px-8 flex items-center gap-2"
              >
                {savingSettings ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Enregistrer les paramètres
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
        title="Confirmer la recharge"
        description="Vous allez être redirigé vers l'interface de paiement sécurisée Paydunya afin d'approvisionner votre portefeuille virtuel d'un montant de :"
        amount={parseFloat(rechargeAmount) || 0}
        type="recharge"
        isLoading={isRedirecting}
      />
    </motion.div>
  );
}
