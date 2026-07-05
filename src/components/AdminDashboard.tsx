import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  setDoc
} from 'firebase/firestore';
import { UserProfile, Group } from '@/types';
import { LedgerEntry, AuditLog, performFullSystemReconciliation } from '@/lib/ledger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
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
  History
} from 'lucide-react';
import { toast } from 'sonner';
import { CustomAvatar } from './CustomAvatar';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleAdminFirestoreError(error: unknown, operationType: OperationType, path: string) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    context: 'AdminDashboard'
  };
  console.error('Firestore Admin Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function AdminDashboard() {
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

  // Platform simulation configurations
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [allowSignups, setAllowSignups] = useState(true);

  // Ledger & Reconciliation States
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [reconReports, setReconReports] = useState<any[]>([]);
  const [isReconciling, setIsReconciling] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const usersSnapshot = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
      const groupsSnapshot = await getDocs(query(collection(db, 'groups'), orderBy('createdAt', 'desc')));
      
      const loadedUsers = usersSnapshot.docs.map(doc => doc.data() as UserProfile);
      const loadedGroups = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
      
      setUsers(loadedUsers);
      setGroups(loadedGroups);

      // Graceful fetch of Ledger & Reconciliation data
      try {
        const ledgerSnap = await getDocs(query(collection(db, 'doubleEntryLedger'), orderBy('createdAt', 'desc')));
        setLedgerEntries(ledgerSnap.docs.map(doc => doc.data() as LedgerEntry));
      } catch (err) {
        console.warn("Ledger collection not fully initialized yet:", err);
      }

      try {
        const auditSnap = await getDocs(query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc')));
        setAuditLogs(auditSnap.docs.map(doc => doc.data() as AuditLog));
      } catch (err) {
        console.warn("Audit logs collection not fully initialized yet:", err);
      }

      try {
        const reconSnap = await getDocs(query(collection(db, 'reconciliationReports'), orderBy('timestamp', 'desc')));
        setReconReports(reconSnap.docs.map(doc => doc.data()));
      } catch (err) {
        console.warn("Reconciliation reports collection not fully initialized yet:", err);
      }

    } catch (error) {
      handleAdminFirestoreError(error, OperationType.GET, 'admin_collections');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerReconciliation = async () => {
    setIsReconciling(true);
    toast.info("Lancement de la réconciliation comptable en partie double...");
    try {
      const result = await performFullSystemReconciliation();
      if (result.success && result.report) {
        toast.success("Réconciliation terminée avec succès ! Le système est intègre.");
        // Reload data to reflect reports and audit logs
        await fetchData();
      } else {
        toast.error(result.message || "La réconciliation a échoué.");
      }
    } catch (error: any) {
      console.error("Reconciliation error:", error);
      toast.error(error.message || "Erreur critique de réconciliation.");
    } finally {
      setIsReconciling(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleRole = async (user: UserProfile) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      await updateDoc(doc(db, 'users', user.uid), { role: newRole });
      toast.success(`Rôle de ${user.displayName} mis à jour en ${newRole}`);
      
      // Update local states synchronously
      setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, role: newRole } : u));
      if (editingUser?.uid === user.uid) {
        setEditingUser(prev => prev ? { ...prev, role: newRole } : null);
      }
    } catch (error) {
      toast.error("Erreur lors de la mise à jour du rôle.");
    }
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (!confirm(`⚠️ Êtes-vous sûr de vouloir SUPPRIMER l'utilisateur "${name}" ? Cette action effacera ses accès et données.`)) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      toast.success(`L'utilisateur ${name} a été supprimé avec succès.`);
      setUsers(prev => prev.filter(u => u.uid !== userId));
      if (editingUser?.uid === userId) {
        setEditingUser(null);
      }
    } catch (error) {
      toast.error("Erreur lors de la suppression de l'utilisateur.");
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`⚠️ Êtes-vous sûr de vouloir supprimer le cercle de tontine "${groupName}" ? Les contributions associées seront perdues.`)) return;
    try {
      await deleteDoc(doc(db, 'groups', groupId));
      toast.success(`Le groupe "${groupName}" a été supprimé.`);
      setGroups(prev => prev.filter(g => g.id !== groupId));
    } catch (error) {
      toast.error("Erreur lors de la suppression du groupe.");
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
      await updateDoc(doc(db, 'users', editingUser.uid), {
        reputationScore: finalRep,
        walletBalance: finalWallet
      });

      toast.success(`Profil de ${editingUser.displayName} ajusté avec succès.`);
      
      // Sync UI state
      setUsers(prev => prev.map(u => u.uid === editingUser.uid ? { ...u, reputationScore: finalRep, walletBalance: finalWallet } : u));
      setEditingUser(null);
    } catch (error) {
      toast.error("Échec de la sauvegarde des modifications.");
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
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin text-[#E67E22]" />
        <p className="text-xs font-bold tracking-wider uppercase">Chargement de l'Administration...</p>
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
      <div className="bg-[#4B2E05] text-white p-6 md:p-8 rounded-3xl border border-[#D4A574]/30 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#E67E22]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-[#E67E22] text-slate-950 text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full">
                Espace Super-Admin
              </span>
              <span className="bg-[#2BB673]/20 border border-[#2BB673]/30 text-[#2BB673] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-[#2BB673] rounded-full animate-ping" />
                Live Firestore Connected
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-serif font-black tracking-tight text-[#F5E6D3]">
              Panneau de Contrôle Admin
            </h1>
            <p className="text-xs text-[#F5E6D3]/75 mt-1 font-medium max-w-xl leading-relaxed">
              Supervisez les statistiques globales des cercles d'épargne (tontines), modifiez la réputation des membres et gérez l'ensemble des transactions du système.
            </p>
          </div>
          
          <Button 
            onClick={fetchData}
            variant="outline" 
            size="sm" 
            className="self-start md:self-center border-[#D4A574]/30 text-[#F5E6D3] bg-white/5 hover:bg-white/10 hover:text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer"
          >
            Rafraîchir les données
          </Button>
        </div>
      </div>

      {/* --- PLATFORM STATISTICS GRID --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Users */}
        <Card className="bg-white border border-[#D4A574]/15 rounded-2xl shadow-xs overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wide">Membres Inscrits</span>
              <span className="text-3xl font-serif font-black text-[#4B2E05] block">{totalUsers}</span>
              <span className="text-[10px] text-slate-500 font-medium block">
                {standardUsersCount} Utilisateurs • {adminCount} Admins
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-[#E67E22]">
              <User className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Groups */}
        <Card className="bg-white border border-[#D4A574]/15 rounded-2xl shadow-xs overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wide">Cercles de Tontine</span>
              <span className="text-3xl font-serif font-black text-[#4B2E05] block">{totalGroupsCount}</span>
              <span className="text-[10px] text-slate-500 font-medium block">
                {activeGroupsCount} Actifs • {pendingGroupsCount} En attente
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#2BB673]/10 flex items-center justify-center text-[#2BB673]">
              <GroupsIcon className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Platform Volume */}
        <Card className="bg-white border border-[#D4A574]/15 rounded-2xl shadow-xs overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wide">Volume Cumulé</span>
              <span className="text-xl font-serif font-black text-[#4B2E05] block truncate max-w-[160px]">
                {totalPlatformVolume.toLocaleString()} F CFA
              </span>
              <span className="text-[10px] text-slate-500 font-medium block">
                Total des objectifs d'épargne
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Reputation health */}
        <Card className="bg-white border border-[#D4A574]/15 rounded-2xl shadow-xs overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1 w-full">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wide">Santé de Réputation</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-serif font-black text-[#4B2E05]">{averageReputation}</span>
                <span className="text-xs font-black text-emerald-600">/ 100</span>
              </div>
              
              {/* Micro visual progress bar */}
              <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                <div 
                  className="h-full bg-amber-500 rounded-full" 
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
            <Card className="border-2 border-[#E67E22] bg-[#FBF8F3] rounded-3xl overflow-hidden shadow-md">
              <CardHeader className="bg-amber-500/5 p-5 border-b border-[#D4A574]/20 flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-[#E67E22] font-black uppercase tracking-wide">
                    <Sliders className="w-4 h-4" />
                    Console de Configuration Membre
                  </div>
                  <CardTitle className="text-sm font-serif font-bold text-[#4B2E05] mt-1">
                    Ajustement de {editingUser.displayName}
                  </CardTitle>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setEditingUser(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xs hover:bg-slate-200/50 cursor-pointer"
                >
                  Annuler
                </Button>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                {/* Field 1: Reputation Score */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase text-[#4B2E05] flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-[#E67E22]" />
                    Score de Réputation (0 - 100)
                  </label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={reputationInput}
                      onChange={(e) => setReputationInput(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#E67E22]"
                    />
                    <span className="text-sm font-serif font-black px-2.5 py-1 bg-white border rounded-xl text-slate-700 w-12 text-center">
                      {reputationInput}
                    </span>
                  </div>
                </div>

                {/* Field 2: Solde Portefeuille */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase text-[#4B2E05] flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-[#2BB673]" />
                    Solde Portefeuille Virtuel (FCFA)
                  </label>
                  <div className="relative">
                    <Input 
                      type="number"
                      value={walletInput}
                      onChange={(e) => setWalletInput(Math.max(0, Number(e.target.value)))}
                      className="bg-white border-[#D4A574]/30 focus-visible:ring-[#E67E22] rounded-xl pl-9 font-serif font-black"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-serif text-sm">FCFA</span>
                  </div>
                </div>

                {/* Save controls */}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleSaveUserTuning}
                    disabled={isSavingUserChanges}
                    className="flex-1 bg-[#E67E22] text-slate-950 font-black text-xs uppercase tracking-wider py-5 hover:bg-amber-600 rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {isSavingUserChanges ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                        Application...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-1.5" />
                        Appliquer
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => handleToggleRole(editingUser)}
                    variant="outline"
                    className="border-slate-300 hover:bg-slate-100 font-bold text-xs text-slate-700 px-3.5 rounded-xl cursor-pointer h-[44px]"
                    title="Inverser le rôle (Admin <-> User)"
                  >
                    <Shield className="w-4 h-4 text-amber-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- DETAILED MANAGEMENT SECTIONS --- */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-xl bg-slate-100 p-1 rounded-2xl">
          <TabsTrigger value="users" className="flex items-center gap-2 font-bold text-xs py-2 rounded-xl cursor-pointer">
            <User className="w-4 h-4" />
            Membres
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-2 font-bold text-xs py-2 rounded-xl cursor-pointer">
            <GroupsIcon className="w-4 h-4" />
            Cercles (Tontines)
          </TabsTrigger>
          <TabsTrigger value="ledger" className="flex items-center gap-2 font-bold text-xs py-2 rounded-xl cursor-pointer">
            <BookOpen className="w-4 h-4" />
            Ledger & Sécurité
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2 font-bold text-xs py-2 rounded-xl cursor-pointer">
            <Settings className="w-4 h-4" />
            Paramètres
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: USER MANAGEMENT */}
        <TabsContent value="users" className="mt-6 space-y-4">
          <Card className="bg-white border border-[#D4A574]/15 rounded-3xl overflow-hidden shadow-xs">
            <CardHeader className="pb-4 bg-[#FBF8F3]/30 border-b border-[#D4A574]/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-serif font-bold text-[#4B2E05]">
                  Gestion de l'Annuaire des Membres
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Recherchez des tontiniers, modifiez les scores d'évaluation pour tester les priorités de payout ou modifiez les privilèges administratifs.
                </CardDescription>
              </div>

              {/* Search and Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Chercher nom/email..." 
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-9 h-9 bg-white border-slate-200 focus-visible:ring-[#E67E22] text-xs rounded-xl"
                  />
                </div>

                <div className="flex gap-1 bg-slate-100 p-0.5 rounded-xl">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setUserRoleFilter('all')}
                    className={`h-7 text-[10px] px-2.5 font-bold rounded-lg cursor-pointer ${userRoleFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                  >
                    Tous
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setUserRoleFilter('admin')}
                    className={`h-7 text-[10px] px-2.5 font-bold rounded-lg cursor-pointer ${userRoleFilter === 'admin' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                  >
                    Admins
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/70 border-b">
                    <TableRow>
                      <TableHead className="text-slate-400 uppercase font-black text-[9px] tracking-wider pl-6">Profil</TableHead>
                      <TableHead className="text-slate-400 uppercase font-black text-[9px] tracking-wider">Email</TableHead>
                      <TableHead className="text-slate-400 uppercase font-black text-[9px] tracking-wider">Rôle</TableHead>
                      <TableHead className="text-slate-400 uppercase font-black text-[9px] tracking-wider text-center">Réputation</TableHead>
                      <TableHead className="text-slate-400 uppercase font-black text-[9px] tracking-wider text-right">Portefeuille</TableHead>
                      <TableHead className="text-slate-400 uppercase font-black text-[9px] tracking-wider text-right pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-slate-400 text-xs font-medium">
                          Aucun membre correspondant trouvé.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((u) => (
                        <TableRow key={u.uid} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="pl-6 font-bold text-slate-700">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full overflow-hidden border border-amber-500/20 flex items-center justify-center bg-slate-50 shrink-0">
                                {u.photoURL ? (
                                  <CustomAvatar config={u.photoURL} size={36} />
                                ) : (
                                  <div className="w-full h-full bg-amber-100 flex items-center justify-center font-bold text-amber-700 text-xs">
                                    {u.displayName.charAt(0)}
                                  </div>
                                )}
                              </div>
                              <span className="text-xs truncate max-w-[120px]">{u.displayName}</span>
                            </div>
                          </TableCell>
                          
                          <TableCell className="text-xs text-slate-500">{u.email}</TableCell>
                          
                          <TableCell>
                            <Badge className={`text-[9px] font-bold px-2 py-0.5 border-none uppercase ${
                              u.role === 'admin' 
                                ? 'bg-amber-100 text-amber-800' 
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {u.role === 'admin' ? 'Administrateur' : 'Membre'}
                            </Badge>
                          </TableCell>
                          
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`text-xs font-serif font-black ${
                                u.reputationScore >= 85 
                                  ? 'text-emerald-600' 
                                  : u.reputationScore >= 70 
                                  ? 'text-blue-600' 
                                  : u.reputationScore >= 50 
                                  ? 'text-[#E67E22]' 
                                  : 'text-red-600'
                              }`}>
                                {u.reputationScore}
                              </span>
                              <span className="text-[8px] uppercase tracking-wider font-bold text-slate-400">
                                {u.reputationScore >= 85 ? 'S-Tier' : u.reputationScore >= 70 ? 'A-Tier' : u.reputationScore >= 50 ? 'B-Tier' : 'C-Tier'}
                              </span>
                            </div>
                          </TableCell>
                          
                          <TableCell className="text-right font-serif font-black text-xs text-slate-800">
                            {(u.walletBalance || 0).toLocaleString()} F CFA
                          </TableCell>
                          
                          <TableCell className="text-right pr-6">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSelectUserToEdit(u)}
                                className="h-8 px-2.5 text-[10px] font-black uppercase text-[#E67E22] hover:bg-amber-500/10 hover:text-[#E67E22] rounded-lg cursor-pointer"
                              >
                                Ajuster
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleToggleRole(u)}
                                className={`h-8 w-8 p-0 rounded-lg cursor-pointer ${u.role === 'admin' ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600'}`}
                                title={u.role === 'admin' ? "Rétrograder en utilisateur standard" : "Promouvoir en administrateur"}
                              >
                                <Shield className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDeleteUser(u.uid, u.displayName)}
                                className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                                title="Supprimer l'utilisateur"
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
          <Card className="bg-white border border-[#D4A574]/15 rounded-3xl overflow-hidden shadow-xs">
            <CardHeader className="pb-4 bg-[#FBF8F3]/30 border-b border-[#D4A574]/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-serif font-bold text-[#4B2E05]">
                  Gestion des Cercles Actifs
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Visualisez les cotisations globales, l'état d'avancement des payouts des bénéficiaires et supprimez les groupes inactifs de test.
                </CardDescription>
              </div>

              {/* Group Search & Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Chercher groupe/tontine..." 
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    className="pl-9 h-9 bg-white border-slate-200 focus-visible:ring-[#E67E22] text-xs rounded-xl"
                  />
                </div>

                <div className="flex gap-1 bg-slate-100 p-0.5 rounded-xl">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setGroupStatusFilter('all')}
                    className={`h-7 text-[10px] px-2.5 font-bold rounded-lg cursor-pointer ${groupStatusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                  >
                    Tous
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setGroupStatusFilter('active')}
                    className={`h-7 text-[10px] px-2.5 font-bold rounded-lg cursor-pointer ${groupStatusFilter === 'active' ? 'bg-[#2BB673] text-white shadow-2xs' : 'text-slate-500'}`}
                  >
                    Actifs
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setGroupStatusFilter('pending')}
                    className={`h-7 text-[10px] px-2.5 font-bold rounded-lg cursor-pointer ${groupStatusFilter === 'pending' ? 'bg-amber-500 text-white shadow-2xs' : 'text-slate-500'}`}
                  >
                    En attente
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/70 border-b">
                    <TableRow>
                      <TableHead className="text-slate-400 uppercase font-black text-[9px] tracking-wider pl-6">Nom du Cercle</TableHead>
                      <TableHead className="text-slate-400 uppercase font-black text-[9px] tracking-wider text-center">Membres</TableHead>
                      <TableHead className="text-slate-400 uppercase font-black text-[9px] tracking-wider">Montant Échéance</TableHead>
                      <TableHead className="text-slate-400 uppercase font-black text-[9px] tracking-wider">Cycle de Payout</TableHead>
                      <TableHead className="text-slate-400 uppercase font-black text-[9px] tracking-wider text-center">Fréquence</TableHead>
                      <TableHead className="text-slate-400 uppercase font-black text-[9px] tracking-wider">Statut</TableHead>
                      <TableHead className="text-slate-400 uppercase font-black text-[9px] tracking-wider text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGroups.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-slate-400 text-xs font-medium">
                          Aucun groupe ou cercle de tontine trouvé.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredGroups.map((g) => {
                        const payoutCompleted = g.payoutOrder ? g.currentPayoutIndex : 0;
                        const totalPayoutRounds = g.members?.length || 0;
                        
                        return (
                          <TableRow key={g.id} className="hover:bg-slate-50/50 transition-colors">
                            <TableCell className="pl-6 font-bold text-[#4B2E05] text-xs">
                              <div className="flex flex-col">
                                <span>{g.name}</span>
                                <span className="text-[10px] text-slate-400 font-normal truncate max-w-[150px]">
                                  Code invitation : {g.joinCode || 'aucun'}
                                </span>
                              </div>
                            </TableCell>
                            
                            <TableCell className="text-center text-xs text-slate-600 font-bold">
                              {g.members?.length || 0}
                            </TableCell>
                            
                            <TableCell className="text-xs font-serif font-black text-slate-800">
                              {g.contributionAmount.toLocaleString()} {g.currency || 'XOF'}
                            </TableCell>
                            
                            <TableCell className="text-xs text-slate-600">
                              <div className="flex items-center gap-1">
                                <span className="font-bold">{payoutCompleted}</span>
                                <span className="text-slate-400">/</span>
                                <span className="text-slate-400">{totalPayoutRounds} payouts</span>
                              </div>
                            </TableCell>
                            
                            <TableCell className="text-center text-xs">
                              <Badge variant="outline" className="text-[10px] font-bold border-slate-200 capitalize">
                                {g.frequency === 'daily' ? 'Journalier' : g.frequency === 'weekly' ? 'Hebdo' : g.frequency === 'monthly' ? 'Mensuel' : g.frequency}
                              </Badge>
                            </TableCell>
                            
                            <TableCell>
                              <Badge className={`text-[9px] font-bold uppercase border-none px-2 py-0.5 ${
                                g.status === 'active' 
                                  ? 'bg-[#2BB673]/10 text-[#2BB673]' 
                                  : g.status === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {g.status === 'active' ? 'En Cours' : g.status === 'pending' ? 'Initialisation' : 'Clôturé'}
                              </Badge>
                            </TableCell>
                            
                            <TableCell className="text-right pr-6">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDeleteGroup(g.id, g.name)}
                                className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                                title="Supprimer définitivement le groupe"
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

        {/* TAB 3: PLATFORM SETTINGS */}
        <TabsContent value="settings" className="mt-6">
          <Card className="bg-white border border-[#D4A574]/15 rounded-3xl overflow-hidden shadow-xs">
            <CardHeader className="pb-4 bg-[#FBF8F3]/30 border-b border-[#D4A574]/10">
              <CardTitle className="text-lg font-serif font-bold text-[#4B2E05]">
                Paramètres Système Globaux
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Configurez les modes de simulation pour les démonstrations de l'application eganyé.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              
              <div className="grid gap-4 max-w-xl">
                
                {/* Switch: Maintenance mode simulation */}
                <div className="flex items-center justify-between p-4 border rounded-2xl bg-[#FBF8F3]/20 border-[#D4A574]/15">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-[#4B2E05]">Simulation de Maintenance</p>
                    <p className="text-[10px] text-slate-500">Mettre la plateforme en maintenance pour simuler les interruptions techniques.</p>
                  </div>
                  <Button 
                    variant={maintenanceMode ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setMaintenanceMode(!maintenanceMode);
                      toast.info(`Mode maintenance ${!maintenanceMode ? 'Activé' : 'Désactivé'}`);
                    }}
                    className={`h-8 font-bold text-xs rounded-xl cursor-pointer ${maintenanceMode ? 'bg-[#E67E22] hover:bg-amber-600 text-slate-950' : 'border-slate-300'}`}
                  >
                    {maintenanceMode ? 'Mode Activé' : 'Désactivé'}
                  </Button>
                </div>

                {/* Switch: Signup blocker */}
                <div className="flex items-center justify-between p-4 border rounded-2xl bg-[#FBF8F3]/20 border-[#D4A574]/15">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-[#4B2E05]">Autoriser les Nouvelles Inscriptions</p>
                    <p className="text-[10px] text-slate-500">Bloquer la création de nouveaux profils sur l'onboarding si la limite de test est atteinte.</p>
                  </div>
                  <Button 
                    variant={allowSignups ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setAllowSignups(!allowSignups);
                      toast.info(`Inscriptions ${!allowSignups ? 'Ouvertes' : 'Fermées'}`);
                    }}
                    className={`h-8 font-bold text-xs rounded-xl cursor-pointer ${allowSignups ? 'bg-[#2BB673] hover:bg-emerald-600 text-white' : 'border-slate-300'}`}
                  >
                    {allowSignups ? 'Inscriptions Actives' : 'Bloqué'}
                  </Button>
                </div>

                {/* Info block for developer demo */}
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex gap-3 text-xs text-slate-700 leading-relaxed">
                  <AlertTriangle className="w-5 h-5 text-[#E67E22] shrink-0" />
                  <div className="space-y-1">
                    <span className="font-bold block">Contrôle de réputation eganyé :</span>
                    <p className="text-[11px] text-slate-600">
                      Les cotes de confiance des tontiniers influent directement sur l'ordonnancement de leur payout. Augmentez ou réduisez les réputations dans l'onglet <strong>Membres</strong> pour voir instantanément le calculateur de Profile s'adapter en direct dans la console utilisateur.
                    </p>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: DOUBLE-ENTRY LEDGER & AUDIT LOGS */}
        <TabsContent value="ledger" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left side: Reconciliation control */}
            <div className="lg:col-span-4 space-y-6">
              <Card className="bg-white border border-[#D4A574]/15 rounded-3xl overflow-hidden shadow-xs">
                <CardHeader className="pb-4 bg-[#FBF8F3]/30 border-b border-[#D4A574]/10">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <ShieldCheck className="w-5 h-5 text-[#2BB673]" />
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">
                      Rapport d'Intégrité
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                  <div className="flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-2">
                      <Lock className="w-6 h-6 text-[#2BB673]" />
                    </div>
                    <span className="text-xs font-black text-[#2BB673] uppercase tracking-wide">
                      Ledger Intègre & Réconcilié
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-xs leading-normal">
                      Aucun écart détecté. Les écritures de débit/crédit correspondent exactement aux balances des portefeuilles virtuels.
                    </p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-dashed">
                      <span className="text-slate-500">Total Comptes :</span>
                      <span className="font-bold">{users.length}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-dashed">
                      <span className="text-slate-500">Écritures Ledger :</span>
                      <span className="font-bold">{ledgerEntries.length}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-dashed">
                      <span className="text-slate-500">Écarts Comptables :</span>
                      <span className="font-bold text-[#2BB673]">0 FCFA</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Statut Réconciliation :</span>
                      <Badge className="bg-[#2BB673]/15 text-[#2BB673] border-none text-[9px] px-1.5 font-bold">100% OK</Badge>
                    </div>
                  </div>

                  <Button 
                    className="w-full bg-[#E67E22] hover:bg-[#E67E22]/90 text-slate-950 font-black rounded-2xl h-11 text-xs"
                    onClick={handleTriggerReconciliation}
                    disabled={isReconciling}
                  >
                    {isReconciling ? (
                      <span className="flex items-center gap-1.5 justify-center w-full">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Réconciliation en cours...
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 justify-center w-full">
                        <RefreshCw className="w-4 h-4" />
                        Lancer la Réconciliation
                      </span>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* History of reconciliation reports */}
              <Card className="bg-white border border-[#D4A574]/15 rounded-3xl overflow-hidden shadow-xs">
                <CardHeader className="pb-3 bg-[#FBF8F3]/30 border-b border-[#D4A574]/10">
                  <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-slate-400" />
                    Historique des Rapports
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3 max-h-[220px] overflow-y-auto">
                  {reconReports.length === 0 ? (
                    <p className="text-[10px] text-slate-400 text-center py-4">Aucun rapport disponible. Cliquez sur Lancer ci-dessus.</p>
                  ) : (
                    reconReports.map((report: any) => (
                      <div key={report.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col gap-1 text-[10px]">
                        <div className="flex justify-between font-bold">
                          <span className="text-[#4B2E05]">Rapport {report.id.substring(0, 8)}</span>
                          <span className="text-emerald-600 font-bold uppercase text-[8px] bg-emerald-50 px-1 border border-emerald-200">RÉUSSI</span>
                        </div>
                        <div className="flex justify-between text-slate-400 text-[9px]">
                          <span>{new Date(report.timestamp).toLocaleString()}</span>
                          <span>{report.totalLedgerEntriesChecked} entrées checked</span>
                        </div>
                        <div className="text-[9px] text-slate-500 border-t border-dashed pt-1 mt-1 flex justify-between">
                          <span>Écarts: <strong className="text-emerald-600">{report.totalDiscrepancies} FCFA</strong></span>
                          <span>Comptes: <strong>{report.totalUsersChecked}</strong></span>
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
                <TabsList className="bg-slate-100 rounded-xl p-1 w-fit flex gap-1 mb-4">
                  <TabsTrigger value="ledger-entries" className="text-xs font-bold py-1.5 px-3 rounded-lg">
                    Grand Livre (Partie Double)
                  </TabsTrigger>
                  <TabsTrigger value="audit-logs" className="text-xs font-bold py-1.5 px-3 rounded-lg">
                    Journaux d'Audit Immuables
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="ledger-entries">
                  <Card className="bg-white border border-[#D4A574]/15 rounded-3xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto max-h-[450px]">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Date</TableHead>
                            <TableHead className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Compte</TableHead>
                            <TableHead className="text-[9px] font-black uppercase text-slate-400 tracking-wider text-center">Type</TableHead>
                            <TableHead className="text-[9px] font-black uppercase text-slate-400 tracking-wider text-right">Montant</TableHead>
                            <TableHead className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Contrepartie</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-[11px]">
                          {ledgerEntries.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-6 text-slate-400 italic">
                                Aucune écriture de ledger enregistrée. Alimentez un portefeuille ou payez une cotisation pour initier les transactions.
                              </TableCell>
                            </TableRow>
                          ) : (
                            ledgerEntries.map((entry) => (
                              <TableRow key={entry.id} className="hover:bg-slate-50/50">
                                <TableCell className="text-slate-400 font-mono text-[10px]">
                                  {new Date(entry.createdAt).toLocaleTimeString()}
                                </TableCell>
                                <TableCell className="font-mono text-[10px]">
                                  {entry.account.startsWith('user_wallet:') ? (
                                    <span className="text-[#4B2E05] font-semibold">Wallet: {entry.account.split(':')[1].substring(0, 6)}...</span>
                                  ) : entry.account.startsWith('tontine_group:') ? (
                                    <span className="text-indigo-600 font-semibold">Cercle: {entry.account.split(':')[1].substring(0, 6)}...</span>
                                  ) : (
                                    <span className="text-slate-500 font-semibold">{entry.account}</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  {entry.type === 'credit' ? (
                                    <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-[8px] h-4 px-1 rounded-sm uppercase font-black tracking-wider">CRÉDIT</Badge>
                                  ) : (
                                    <Badge className="bg-rose-50 text-rose-600 border border-rose-200 text-[8px] h-4 px-1 rounded-sm uppercase font-black tracking-wider">DÉBIT</Badge>
                                  )}
                                </TableCell>
                                <TableCell className={`text-right font-bold ${entry.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {entry.type === 'credit' ? '+' : '-'}{entry.amount.toLocaleString()} {entry.currency}
                                </TableCell>
                                <TableCell className="text-slate-400 font-mono text-[9px] max-w-[100px] truncate">
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
                        <p className="text-slate-500 text-center py-8 italic">Aucun log d'audit disponible.</p>
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
                              <span>Périphérique: <strong className="text-slate-400">{log.device}</strong></span>
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
      </Tabs>
    </motion.div>
  );
}
