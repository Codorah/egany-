import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  User, 
  Users,
  CreditCard, 
  Landmark, 
  ArrowDownCircle, 
  Tag, 
  History, 
  Shield, 
  Bell, 
  Ban, 
  Award, 
  HelpCircle, 
  Lightbulb, 
  Bug, 
  ShieldCheck, 
  BookOpen, 
  Mail, 
  LogOut, 
  ChevronRight, 
  Wallet, 
  Copy, 
  Check, 
  Download, 
  FileText, 
  FileSpreadsheet, 
  Sparkles, 
  Plus, 
  Key, 
  Lock, 
  Fingerprint, 
  Globe, 
  Send,
  Loader2,
  ArrowLeft,
  Smartphone,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  PhoneCall
} from 'lucide-react';
import { UserProfile, Group, Contribution, WalletTransaction } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { mapWalletTransactionRow, mapContributionRow } from '@/lib/mappers';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { executeFinancialTransaction, verifyUserPin } from '@/lib/ledger';
import { CustomAvatar, AvatarConfig, DEFAULT_AVATAR } from './CustomAvatar';
import { AvatarWorkshop } from './AvatarWorkshop';

interface ProfileProps {
  user: UserProfile;
  groups: Group[];
  defaultTab?: string;
  onLogout?: () => void;
}

export function Profile({ user, groups, defaultTab, onLogout }: ProfileProps) {
  const { t, setLanguage } = useLanguage();
  
  // Navigation state: null = Root settings, string = active sub-category screen
  const [activeSection, setActiveSection] = useState<string | null>(defaultTab === 'wallet' ? 'payments' : null);
  const [activeSubTab, setActiveSubTab] = useState<string>('personal_info');

  // Form states
  const [editDisplayName, setEditDisplayName] = useState(user.displayName);
  const [editPhone, setEditPhone] = useState('90 00 00 00');
  const [editLanguage, setEditLanguage] = useState(user.language || 'fr');
  const [savingSettings, setSavingSettings] = useState(false);
  const [showBalance, setShowBalance] = useState(true);

  // Avatar state
  const initialAvatarConfig = useMemo(() => {
    if (user.photoURL) {
      try {
        return { ...DEFAULT_AVATAR, ...JSON.parse(user.photoURL) };
      } catch (e) {}
    }
    return { ...DEFAULT_AVATAR };
  }, [user.photoURL]);
  const [editAvatar, setEditAvatar] = useState<AvatarConfig>(initialAvatarConfig);

  // Security & Toggles states
  const [newPin, setNewPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [biometricsEnabled, setBiometricsEnabled] = useState(user.biometricsEnabled || true);
  const [pushNotif, setPushNotif] = useState(user.pushEnabled ?? true);
  const [smsNotif, setSmsNotif] = useState(true);
  const [emailNotif, setEmailNotif] = useState(user.emailNotificationsEnabled ?? true);
  const [whatsAppNotif, setWhatsAppNotif] = useState(false);
  const [showScorePublic, setShowScorePublic] = useState(true);
  const [allowInvitations, setAllowInvitations] = useState(true);

  // Wallet & Transactions
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [isRecharging, setIsRecharging] = useState(false);

  // Withdrawal states
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('flooz');
  const [withdrawPhone, setWithdrawPhone] = useState('+228 90 00 00 00');
  const [withdrawPin, setWithdrawPin] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Delete account confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const fetchTx = async () => {
      const { data } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.uid)
        .order('date', { ascending: false });
      if (data) setWalletTransactions(data.map(mapWalletTransactionRow));
    };
    const fetchContribs = async () => {
      const { data } = await supabase
        .from('contributions')
        .select('*')
        .eq('user_id', user.uid)
        .order('date', { ascending: false });
      if (data) setContributions(data.map(mapContributionRow));
    };
    fetchTx();
    fetchContribs();
  }, [user.uid]);

  const handleSaveProfile = async () => {
    setSavingSettings(true);
    try {
      const { error } = await supabase.from('profiles').update({
        display_name: editDisplayName,
        language: editLanguage,
        avatar_config: editAvatar,
      }).eq('id', user.uid);
      if (error) throw error;
      toast.success("Informations personnelles enregistrées !");
    } catch (err: any) {
      toast.error("Erreur lors de la sauvegarde.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRecharge = async () => {
    const amount = parseFloat(rechargeAmount);
    if (!amount || amount < 100) {
      toast.error("Veuillez saisir un montant valide (minimum 100 FCFA).");
      return;
    }
    setIsRecharging(true);
    try {
      const result = await executeFinancialTransaction({
        idempotencyKey: `recharge_${user.uid}_${Date.now()}`,
        userId: user.uid,
        amount,
        currency: 'FCFA',
        description: `Recharge de portefeuille via Mobile Money (${amount.toLocaleString()} FCFA)`,
        actionType: 'wallet_recharge',
        debitAccount: 'mobile_money_gateway',
        creditAccount: `user_wallet:${user.uid}`
      });
      if (!result.success) throw new Error(result.message);
      toast.success(`Portefeuille rechargé avec succès (+${amount.toLocaleString()} FCFA) !`);
      setRechargeAmount('');
    } catch (err: any) {
      toast.error(err.message || "Échec de la recharge.");
    } finally {
      setIsRecharging(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      toast.error("Montant de retrait invalide.");
      return;
    }
    if (amount > (user.walletBalance || 0)) {
      toast.error("Solde insuffisant dans votre portefeuille.");
      return;
    }
    if (!withdrawPin) {
      toast.error("Veuillez saisir votre code PIN de retrait.");
      return;
    }
    setIsWithdrawing(true);
    try {
      const pinResult = await verifyUserPin(user.uid, withdrawPin);
      if (!pinResult.ok) {
        toast.error(pinResult.message);
        setIsWithdrawing(false);
        return;
      }
      const result = await executeFinancialTransaction({
        idempotencyKey: `withdraw_${user.uid}_${Date.now()}`,
        userId: user.uid,
        amount,
        currency: 'FCFA',
        description: `Retrait vers ${withdrawMethod.toUpperCase()} (${withdrawPhone})`,
        actionType: 'wallet_withdrawal',
        debitAccount: `user_wallet:${user.uid}`,
        creditAccount: `mobile_money_${withdrawMethod}`
      });
      if (!result.success) throw new Error(result.message);
      toast.success(`Retrait de ${amount.toLocaleString()} FCFA effectué !`);
      setWithdrawAmount('');
      setWithdrawPin('');
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du retrait.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Main Categories array matching exact mockup design
  const mainCategories = [
    {
      id: 'account',
      title: 'Mon compte',
      description: 'Gérez vos informations personnelles et votre identité.',
      icon: <User className="w-6 h-6 text-amber-500" />,
      color: 'bg-amber-500/10 border-amber-500/20'
    },
    {
      id: 'payments',
      title: 'Argent & paiements',
      description: 'Gérez vos moyens de paiement, transferts et retraits.',
      icon: <Wallet className="w-6 h-6 text-emerald-500" />,
      color: 'bg-emerald-500/10 border-emerald-500/20'
    },
    {
      id: 'circles',
      title: 'Mes cercles',
      description: 'Gérez vos tontines, vos préférences et invitations.',
      icon: <Users className="w-6 h-6 text-orange-500" />,
      color: 'bg-orange-500/10 border-orange-500/20'
    },
    {
      id: 'security',
      title: 'Sécurité & confidentialité',
      description: 'Sécurisez votre compte et gérez vos données.',
      icon: <Shield className="w-6 h-6 text-blue-500" />,
      color: 'bg-blue-500/10 border-blue-500/20'
    },
    {
      id: 'notifications',
      title: 'Notifications & communication',
      description: 'Choisissez comment vous recevez les notifications.',
      icon: <Bell className="w-6 h-6 text-amber-500" />,
      color: 'bg-amber-500/10 border-amber-500/20'
    },
    {
      id: 'subscription',
      title: 'Abonnement & récompenses',
      description: 'Gérez votre abonnement et vos avantages.',
      icon: <Award className="w-6 h-6 text-purple-500" />,
      color: 'bg-purple-500/10 border-purple-500/20'
    },
    {
      id: 'support',
      title: 'Aide & support',
      description: 'Trouvez de l\'aide, des tutoriels ou contactez le support.',
      icon: <HelpCircle className="w-6 h-6 text-teal-500" />,
      color: 'bg-teal-500/10 border-teal-500/20'
    },
    {
      id: 'legal',
      title: 'Légal & informations',
      description: 'Consultez les conditions, politiques et documents légaux.',
      icon: <BookOpen className="w-6 h-6 text-slate-500" />,
      color: 'bg-slate-500/10 border-slate-500/20'
    }
  ];

  return (
    <div className="space-y-8 pb-20 max-w-6xl mx-auto">
      {/* HEADER BAR FOR SUB-SECTIONS */}
      {activeSection && (
        <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border/80 shadow-xs">
          <Button
            onClick={() => setActiveSection(null)}
            variant="ghost"
            className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer hover:bg-muted"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour aux Paramètres</span>
          </Button>
          <span className="text-xs font-serif font-black text-primary uppercase tracking-wider">
            {mainCategories.find(c => c.id === activeSection)?.title || 'Paramètres'}
          </span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. ROOT VIEW (DESKTOP & MOBILE HOME PROFILE MATCHING MOCKUP) */}
      {/* ========================================================================= */}
      {!activeSection && (
        <div className="space-y-8">
          {/* DESKTOP WEB LAYOUT (GRID VIEW MATCHING BOTTOM HALF OF MOCKUP) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left User Identity Card */}
            <Card className="glass-card rounded-3xl overflow-hidden shadow-soft border border-border/80 lg:col-span-1 h-fit space-y-6 p-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="relative group cursor-pointer" onClick={() => setActiveSection('account')}>
                  <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-primary/20 shadow-md">
                    <CustomAvatar config={JSON.stringify(editAvatar)} size={96} />
                  </div>
                  <div className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full shadow-xs">
                    <User className="w-4 h-4" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <h2 className="text-xl font-serif font-black text-foreground">{user.displayName}</h2>
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold">
                      Compte vérifié
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">+228 90 00 00 00</p>
                  <p className="text-xs text-muted-foreground font-medium">{user.email}</p>
                </div>
              </div>

              {/* User Balance & Reputation */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-muted/40 p-3 rounded-2xl border border-border/60 text-center space-y-0.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Solde disponible</span>
                  <p className="text-sm font-black text-primary">
                    {(user.walletBalance || 0).toLocaleString()} FCFA
                  </p>
                </div>
                <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 text-center space-y-0.5">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Score de fiabilité</span>
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {user.reputationScore} / 100
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-border/60 text-xs text-muted-foreground flex justify-between items-center">
                <span>Membre depuis</span>
                <span className="font-bold text-foreground">12 Mai 2024</span>
              </div>

              {/* Support Card in Sidebar */}
              <div className="p-4 bg-muted/40 rounded-2xl border border-border/60 space-y-2">
                <div className="flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">Besoin d'aide ?</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Contactez notre support disponible 7j/7.</p>
                <Button
                  onClick={() => setActiveSection('support')}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-bold rounded-xl h-8 border-border text-foreground hover:bg-muted"
                >
                  Contacter le support
                </Button>
              </div>
            </Card>

            {/* Right Main Category Cards (9 Cards Grid on Desktop / List on Mobile) */}
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {mainCategories.map((cat) => (
                  <motion.div
                    key={cat.id}
                    whileHover={{ y: -3 }}
                    onClick={() => setActiveSection(cat.id)}
                    className="cursor-pointer"
                  >
                    <Card className="glass-card rounded-3xl p-5 border border-border/80 shadow-soft hover:shadow-elevated hover:border-primary/40 transition-all flex items-start gap-4 h-full">
                      <div className={`p-3 rounded-2xl ${cat.color} shrink-0`}>
                        {cat.icon}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-center">
                          <h3 className="font-serif font-bold text-base text-foreground">{cat.title}</h3>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          {cat.description}
                        </p>
                      </div>
                    </Card>
                  </motion.div>
                ))}

                {/* Red Card: Supprimer mon compte */}
                <motion.div
                  whileHover={{ y: -3 }}
                  onClick={() => setShowDeleteConfirm(true)}
                  className="cursor-pointer"
                >
                  <Card className="rounded-3xl p-5 border border-rose-300 dark:border-rose-950 bg-rose-50/50 dark:bg-rose-950/20 shadow-soft hover:shadow-elevated transition-all flex items-start gap-4 h-full">
                    <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 shrink-0">
                      <Trash2 className="w-6 h-6" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-center">
                        <h3 className="font-serif font-bold text-base text-rose-600 dark:text-rose-400">Supprimer mon compte</h3>
                        <ChevronRight className="w-4 h-4 text-rose-400" />
                      </div>
                      <p className="text-xs text-rose-600/80 dark:text-rose-400/80 leading-relaxed">
                        Supprimez définitivement votre compte Eganyé.
                      </p>
                    </div>
                  </Card>
                </motion.div>
              </div>

              {/* Full-width Logout Button */}
              <Button
                onClick={() => onLogout?.()}
                variant="outline"
                className="w-full h-12 rounded-2xl border-border text-foreground font-bold hover:bg-muted flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <LogOut className="w-4 h-4 text-muted-foreground" />
                <span>Se déconnecter</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SUB-SECTION SCREEN 1: MON COMPTE */}
      {/* ========================================================================= */}
      {activeSection === 'account' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl mx-auto">
          {/* Sub-tabs header */}
          <div className="flex gap-2 border-b border-border pb-2 overflow-x-auto">
            <button
              onClick={() => setActiveSubTab('personal_info')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeSubTab === 'personal_info' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              1. Informations personnelles
            </button>
            <button
              onClick={() => setActiveSubTab('kyc')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeSubTab === 'kyc' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              2. Vérification d'identité (KYC)
            </button>
            <button
              onClick={() => setActiveSubTab('mandate')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeSubTab === 'mandate' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              3. Mandataire numérique
            </button>
          </div>

          {/* Sub-Tab 1: Informations Personnelles */}
          {activeSubTab === 'personal_info' && (
            <Card className="glass-card rounded-3xl p-6 border border-border/80 space-y-5">
              <div className="flex justify-center py-2">
                <AvatarWorkshop
                  value={editAvatar}
                  onChange={(newAvatar) => setEditAvatar(newAvatar)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Prénom</Label>
                  <Input defaultValue="Codorah" className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Nom</Label>
                  <Input defaultValue="Kodjo" className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Nom d'utilisateur / Pseudo</Label>
                  <Input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Adresse Email</Label>
                  <Input value={user.email} disabled className="rounded-xl h-11 bg-muted/50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Téléphone</Label>
                  <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Date de naissance</Label>
                  <Input type="date" defaultValue="1998-06-12" className="rounded-xl h-11" />
                </div>
              </div>
              <Button onClick={handleSaveProfile} disabled={savingSettings} className="gradient-sunset text-white font-bold rounded-2xl h-12 w-full">
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer'}
              </Button>
            </Card>
          )}

          {/* Sub-Tab 2: Verification identity KYC */}
          {activeSubTab === 'kyc' && (
            <Card className="glass-card rounded-3xl p-6 border border-border/80 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-serif font-bold text-lg text-foreground">Vérification d'identité</h3>
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold text-xs">
                  Niveau 2 sur 3
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Augmentez vos limites financières en vérifiant votre identité.</p>

              <div className="space-y-3 pt-2">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex justify-between items-center">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">🪪 Pièce d'Identité</p>
                    <p className="text-[11px] text-muted-foreground">Carte nationale d'identité</p>
                  </div>
                  <Badge className="bg-emerald-500 text-white text-[10px]">Vérifiée ✅</Badge>
                </div>

                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex justify-between items-center">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">👤 Selfie (Contrôle de vivacité)</p>
                    <p className="text-[11px] text-muted-foreground">Vérifié le 12/07/2026</p>
                  </div>
                  <Badge className="bg-emerald-500 text-white text-[10px]">Vérifiée ✅</Badge>
                </div>

                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex justify-between items-center">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-300">🏠 Adresse & Domicile</p>
                    <p className="text-[11px] text-muted-foreground">Non fournie</p>
                  </div>
                  <Badge className="bg-amber-500 text-white text-[10px]">En attente</Badge>
                </div>
              </div>

              <Button onClick={() => toast.info("Demande de mise à niveau KYC transmise.")} className="gradient-sunset text-white font-bold rounded-2xl h-12 w-full mt-4">
                Améliorer mon niveau
              </Button>
            </Card>
          )}

          {/* Sub-Tab 3: Mandataire numérique */}
          {activeSubTab === 'mandate' && (
            <Card className="glass-card rounded-3xl p-6 border border-border/80 space-y-4">
              <h3 className="font-serif font-bold text-lg text-foreground">Mandataire numérique</h3>
              <p className="text-xs text-muted-foreground">Désignez une personne de confiance pour vous aider à suivre vos cotisations (sans droit de retrait).</p>

              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Nom complet du mandataire</Label>
                  <Input defaultValue="Ama Akou" className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Numéro de téléphone</Label>
                  <Input defaultValue="+228 90 12 34 56" className="rounded-xl h-11" />
                </div>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                  🛡️ Le mandataire reçoit uniquement les notifications et le suivi de vos cercles. Il ne possède <strong>aucun accès à votre portefeuille ni aux retraits</strong>.
                </div>
              </div>

              <Button onClick={() => toast.success("Mandataire enregistré !")} className="gradient-sunset text-white font-bold rounded-2xl h-12 w-full mt-2">
                Enregistrer le mandataire
              </Button>
            </Card>
          )}
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* 3. SUB-SECTION SCREEN 2: ARGENT & PAIEMENTS */}
      {/* ========================================================================= */}
      {activeSection === 'payments' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl mx-auto">
          {/* Wallet Balance Header */}
          <Card className="gradient-sunset text-white rounded-3xl p-6 shadow-soft space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-200">Portefeuille & Paiements</span>
              <button onClick={() => setShowBalance(!showBalance)} className="text-white/80 hover:text-white">
                {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-serif font-black">
                {showBalance ? `${(user.walletBalance || 0).toLocaleString()} FCFA` : '•••••••• FCFA'}
              </p>
              <span className="text-xs text-white/80">Solde disponible immédiatement</span>
            </div>
          </Card>

          {/* Action Cards: Recharger, Retirer, Moyens de paiement */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Recharge Card */}
            <Card className="glass-card rounded-3xl p-5 border border-border/80 space-y-3">
              <h4 className="font-serif font-bold text-sm text-foreground flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-500" /> Recharger le portefeuille
              </h4>
              <Input
                type="number"
                placeholder="Montant en FCFA (ex: 5000)"
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(e.target.value)}
                className="rounded-xl h-11 text-xs"
              />
              <Button onClick={handleRecharge} disabled={isRecharging} className="gradient-sunset text-white font-bold rounded-xl h-10 w-full text-xs">
                {isRecharging ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Recharger via Mobile Money'}
              </Button>
            </Card>

            {/* Withdraw Card */}
            <Card className="glass-card rounded-3xl p-5 border border-border/80 space-y-3">
              <h4 className="font-serif font-bold text-sm text-foreground flex items-center gap-1.5">
                <ArrowDownCircle className="w-4 h-4 text-primary" /> Retirer des fonds
              </h4>
              <Input
                type="number"
                placeholder="Montant en FCFA"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="rounded-xl h-11 text-xs"
              />
              <Input
                type="password"
                placeholder="PIN 4 chiffres"
                maxLength={4}
                value={withdrawPin}
                onChange={(e) => setWithdrawPin(e.target.value)}
                className="rounded-xl h-11 text-xs"
              />
              <Button onClick={handleWithdraw} disabled={isWithdrawing} variant="outline" className="border-primary text-primary font-bold rounded-xl h-10 w-full text-xs">
                {isWithdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmer le retrait'}
              </Button>
            </Card>
          </div>

          {/* Payment Methods List */}
          <Card className="glass-card rounded-3xl p-6 border border-border/80 space-y-3">
            <h4 className="font-serif font-bold text-base text-foreground">Moyens de paiement enregistrés</h4>
            <div className="space-y-2">
              <div className="p-3 bg-card border border-border/60 rounded-2xl flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-600 font-black text-xs flex items-center justify-center">F</div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Flooz (Moov Africa)</p>
                    <p className="text-[10px] text-muted-foreground">+228 90 00 00 00</p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Principal</Badge>
              </div>

              <div className="p-3 bg-card border border-border/60 rounded-2xl flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-500/10 text-yellow-600 font-black text-xs flex items-center justify-center">T</div>
                  <div>
                    <p className="text-xs font-bold text-foreground">TMoney (Togocom)</p>
                    <p className="text-[10px] text-muted-foreground">+228 91 00 00 00</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-[10px] text-primary">Définir principal</Button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* 4. SUB-SECTION SCREEN 4: SÉCURITÉ & CONFIDENTIALITÉ */}
      {/* ========================================================================= */}
      {activeSection === 'security' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl mx-auto">
          <Card className="glass-card rounded-3xl p-6 border border-border/80 space-y-5">
            <h3 className="font-serif font-bold text-lg text-foreground">Sécurité & Confidentialité</h3>

            {/* PIN Code Setting */}
            <div className="p-4 bg-muted/30 rounded-2xl space-y-2 border border-border/60">
              <Label className="text-xs font-bold">Modifier le PIN Eganyé (4 chiffres)</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  maxLength={4}
                  placeholder="Nouveau PIN"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="rounded-xl h-10 text-xs"
                />
                <Button onClick={() => { toast.success("Code PIN mis à jour !"); setNewPin(''); }} className="gradient-sunset text-white font-bold rounded-xl h-10 text-xs px-4">
                  Modifier
                </Button>
              </div>
            </div>

            {/* Biometrics Toggle */}
            <div className="flex items-center justify-between p-4 bg-card border border-border/60 rounded-2xl">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground">Biométrie (Empreinte / FaceID)</p>
                <p className="text-[11px] text-muted-foreground">Utiliser l'empreinte pour déverrouiller l'application.</p>
              </div>
              <Switch checked={biometricsEnabled} onCheckedChange={setBiometricsEnabled} />
            </div>

            {/* Connected Devices */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Appareils Connectés & Sessions</h4>
              <div className="p-3 bg-card border border-border/60 rounded-2xl flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold text-foreground">iPhone de Codorah (Actuel)</p>
                  <p className="text-[10px] text-muted-foreground">Activité : aujourd'hui, 16:18 • Lomé, Togo</p>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-600 text-[9px]">Actif</Badge>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* 5. SUB-SECTION SCREEN 5: NOTIFICATIONS */}
      {/* ========================================================================= */}
      {activeSection === 'notifications' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl mx-auto">
          <Card className="glass-card rounded-3xl p-6 border border-border/80 space-y-4">
            <h3 className="font-serif font-bold text-lg text-foreground">Préférences de Notification</h3>
            <p className="text-xs text-muted-foreground">Choisissez les canaux par lesquels vous souhaitez recevoir vos rappels de cotisation.</p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-2xl">
                <div>
                  <p className="text-xs font-bold text-foreground">Notifications Push</p>
                  <p className="text-[10px] text-muted-foreground">Sur votre téléphone mobile</p>
                </div>
                <Switch checked={pushNotif} onCheckedChange={setPushNotif} />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-2xl">
                <div>
                  <p className="text-xs font-bold text-foreground">SMS</p>
                  <p className="text-[10px] text-muted-foreground">Rappels directs par SMS</p>
                </div>
                <Switch checked={smsNotif} onCheckedChange={setSmsNotif} />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-2xl">
                <div>
                  <p className="text-xs font-bold text-foreground">Email</p>
                  <p className="text-[10px] text-muted-foreground">Reçus et récapitulatifs mensuels</p>
                </div>
                <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-2xl">
                <div>
                  <p className="text-xs font-bold text-foreground">WhatsApp</p>
                  <p className="text-[10px] text-muted-foreground">Alertes et rappels automatisés</p>
                </div>
                <Switch checked={whatsAppNotif} onCheckedChange={setWhatsAppNotif} />
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* 6. SUB-SECTION SCREEN 7: AIDE & LÉGAL */}
      {/* ========================================================================= */}
      {(activeSection === 'support' || activeSection === 'legal') && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl mx-auto">
          <Card className="glass-card rounded-3xl p-6 border border-border/80 space-y-4">
            <h3 className="font-serif font-bold text-lg text-foreground">Aide, Support & Documents Légaux</h3>
            <p className="text-xs text-muted-foreground">Consultez la réglementation des tontines collaboratives et contactez notre assistance.</p>
            
            <div className="space-y-2 pt-2 text-xs">
              <div className="p-3 bg-card border border-border/60 rounded-2xl flex justify-between items-center cursor-pointer hover:bg-muted/40" onClick={() => toast.info("Consulter les CGU.")}>
                <span className="font-bold">Conditions Générales d'Utilisation (CGU)</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="p-3 bg-card border border-border/60 rounded-2xl flex justify-between items-center cursor-pointer hover:bg-muted/40" onClick={() => toast.info("Consulter le Règlement des tontines.")}>
                <span className="font-bold">Règlement Officiel des Tontines</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="p-3 bg-card border border-border/60 rounded-2xl flex justify-between items-center cursor-pointer hover:bg-muted/40" onClick={() => toast.info("Consulter la Politique de confidentialité.")}>
                <span className="font-bold">Politique de Confidentialité & Données</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* DELETE ACCOUNT CONFIRMATION MODAL */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-rose-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Supprimer définitivement mon compte ?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cette action est irréversible. Toutes vos données seront effacées.
            </DialogDescription>
          </DialogHeader>

          {groups.length > 0 ? (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 dark:text-rose-300 rounded-2xl text-xs font-medium space-y-1">
              ⚠️ Vous avez actuellement <strong>{groups.length} cercle(s) actif(s)</strong>. Veuillez quitter ou régler vos cotisations avant de supprimer votre compte.
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-2">
              Confirmez-vous la suppression immédiate de votre compte Eganyé ?
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} className="rounded-xl text-xs">
              Annuler
            </Button>
            <Button
              disabled={groups.length > 0}
              onClick={() => {
                toast.success("Compte supprimé.");
                setShowDeleteConfirm(false);
                onLogout?.();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold"
            >
              Supprimer mon compte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
