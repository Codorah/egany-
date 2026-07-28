import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  User, 
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
  Loader2
} from 'lucide-react';
import { UserProfile, Group, Contribution, WalletTransaction } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase, createChannel, isPasswordProviderUser } from '@/lib/supabase';
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
  
  // Modals visibility state
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // User Profile edit states
  const [editDisplayName, setEditDisplayName] = useState(user.displayName);
  const [editPhone, setEditPhone] = useState('90 00 00 00');
  const [editLanguage, setEditLanguage] = useState(user.language || 'fr');
  const [savingSettings, setSavingSettings] = useState(false);

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

  // Security states
  const [newPin, setNewPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [biometricsEnabled, setBiometricsEnabled] = useState(user.biometricsEnabled || false);
  const [emailNotif, setEmailNotif] = useState(user.emailNotificationsEnabled ?? true);
  const [pushNotif, setPushNotif] = useState(user.pushEnabled ?? false);

  // Wallet & Transactions states
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [isRecharging, setIsRecharging] = useState(false);
  const [copiedPromo, setCopiedPromo] = useState(false);

  // Withdrawal states
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('wave');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawPin, setWithdrawPin] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Support / Feedback states
  const [feedbackText, setFeedbackText] = useState('');
  const [bugSubject, setBugSubject] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [isSendingTicket, setIsSendingTicket] = useState(false);

  // Saved Payment accounts
  const [waveAccount, setWaveAccount] = useState('90 12 34 56');
  const [orangeAccount, setOrangeAccount] = useState('96 78 90 12');

  // Load transactions and contributions
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

  // Handle Profile Save
  const handleSaveProfile = async () => {
    setSavingSettings(true);
    try {
      const { error } = await supabase.from('profiles').update({
        display_name: editDisplayName,
        language: editLanguage,
        avatar_config: editAvatar,
      }).eq('id', user.uid);
      if (error) throw error;
      toast.success("Informations personnelles mises à jour avec succès !");
      setActiveModal(null);
    } catch (err: any) {
      toast.error("Erreur lors de la sauvegarde du profil.");
    } finally {
      setSavingSettings(false);
    }
  };

  // Handle PIN update
  const handleSavePin = async () => {
    if (!/^\d{4}$/.test(newPin)) {
      toast.error("Le code PIN doit comporter 4 chiffres.");
      return;
    }
    try {
      const { error } = await supabase.rpc('set_user_pin', { p_user_id: user.uid, p_new_pin: newPin });
      if (error) throw error;
      toast.success("Code PIN de sécurité mis à jour !");
      setNewPin('');
      setActiveModal(null);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour du code PIN.");
    }
  };

  // Handle Wallet Recharge Simulation
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
      setActiveModal(null);
    } catch (err: any) {
      toast.error(err.message || "Échec de la recharge.");
    } finally {
      setIsRecharging(false);
    }
  };

  // Handle Withdrawal
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
      toast.success(`Retrait de ${amount.toLocaleString()} FCFA effectué avec succès !`);
      setWithdrawAmount('');
      setWithdrawPin('');
      setActiveModal(null);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du retrait.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Handle Ticket / Support Submission
  const handleSendTicket = async () => {
    if (!bugSubject || !bugDescription) {
      toast.error("Veuillez remplir le sujet et la description.");
      return;
    }
    setIsSendingTicket(true);
    try {
      const { error } = await supabase.from('support_tickets').insert({
        user_id: user.uid,
        user_name: user.displayName,
        user_email: user.email,
        subject: bugSubject,
        message: bugDescription,
        status: 'open'
      });
      if (error) throw error;
      toast.success("Votre message a été transmis à l'équipe support eganyé !");
      setBugSubject('');
      setBugDescription('');
      setActiveModal(null);
    } catch (err: any) {
      toast.error("Erreur lors de l'envoi du message.");
    } finally {
      setIsSendingTicket(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-2xl mx-auto">
      {/* User Header Profile Card */}
      <Card className="glass-card rounded-3xl overflow-hidden shadow-soft border border-border/80">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative group cursor-pointer" onClick={() => setActiveModal('personal_info')}>
              <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-primary/20 shadow-md">
                <CustomAvatar config={JSON.stringify(editAvatar)} size={80} />
              </div>
              <div className="absolute bottom-0 right-0 bg-primary text-white p-1.5 rounded-full shadow-xs">
                <User className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="flex-1 text-center sm:text-left space-y-1">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl font-serif font-black text-foreground">{user.displayName}</h2>
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold">
                  Compte Vérifié
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-medium">{user.email}</p>
              
              <div className="flex items-center justify-center sm:justify-start gap-4 pt-2">
                <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-1 rounded-xl">
                  <Wallet className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    {(user.walletBalance || 0).toLocaleString()} FCFA
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-xl">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold">Score {user.reputationScore}/100</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 1: MON COMPTE */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2">
          👤 MON COMPTE
        </h3>
        <Card className="glass-card rounded-3xl overflow-hidden border border-border/80 divide-y divide-border/60">
          <MenuRow
            icon={<User className="w-5 h-5 text-primary" />}
            title="Informations personnelles"
            onClick={() => setActiveModal('personal_info')}
          />
          <MenuRow
            icon={<ShieldCheck className="w-5 h-5 text-emerald-500" />}
            title="Vérification d'identité (KYC Niveaux 1-3)"
            onClick={() => setActiveModal('kyc_verification')}
          />
          <MenuRow
            icon={<Users className="w-5 h-5 text-amber-500" />}
            title="Mandataire Numérique"
            onClick={() => setActiveModal('digital_mandate')}
          />
        </Card>
      </div>

      {/* SECTION 2: ARGENT & PAIEMENTS */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2">
          💰 ARGENT & PAIEMENTS
        </h3>
        <Card className="glass-card rounded-3xl overflow-hidden border border-border/80 divide-y divide-border/60">
          <MenuRow
            icon={<Wallet className="w-5 h-5 text-primary" />}
            title="Portefeuille & Moyens de paiement"
            onClick={() => setActiveModal('payment_info')}
          />
          <MenuRow
            icon={<CreditCard className="w-5 h-5 text-primary" />}
            title="Historique des transactions"
            onClick={() => setActiveModal('payments_transfers')}
          />
          <MenuRow
            icon={<ArrowDownCircle className="w-5 h-5 text-primary" />}
            title="Retirer des fonds"
            onClick={() => setActiveModal('withdraw_funds')}
          />
        </Card>
      </div>

      {/* SECTION 3: MES CERCLES */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2">
          🔄 MES CERCLES
        </h3>
        <Card className="glass-card rounded-3xl overflow-hidden border border-border/80 divide-y divide-border/60">
          <MenuRow
            icon={<History className="w-5 h-5 text-primary" />}
            title="Historique des tontines"
            onClick={() => setActiveModal('tontine_history')}
          />
        </Card>
      </div>

      {/* SECTION 4: SÉCURITÉ & CONFIDENTIALITÉ */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2">
          🔐 SÉCURITÉ & CONFIDENTIALITÉ
        </h3>
        <Card className="glass-card rounded-3xl overflow-hidden border border-border/80 divide-y divide-border/60">
          <MenuRow
            icon={<Shield className="w-5 h-5 text-primary" />}
            title="Sécurité du compte & Code PIN"
            onClick={() => setActiveModal('security_settings')}
          />
          <MenuRow
            icon={<Globe className="w-5 h-5 text-primary" />}
            title="Appareils connectés & Sessions"
            onClick={() => setActiveModal('connected_devices')}
          />
          <MenuRow
            icon={<Ban className="w-5 h-5 text-primary" />}
            title="Utilisateurs bloqués"
            onClick={() => setActiveModal('blocked_users')}
          />
        </Card>
      </div>

      {/* SECTION 5: NOTIFICATIONS */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2">
          🔔 NOTIFICATIONS
        </h3>
        <Card className="glass-card rounded-3xl overflow-hidden border border-border/80 divide-y divide-border/60">
          <MenuRow
            icon={<Bell className="w-5 h-5 text-primary" />}
            title="Préférences de notification (Push / SMS / Email)"
            onClick={() => setActiveModal('notifications_settings')}
          />
        </Card>
      </div>

      {/* ABONNEMENT BANNER */}
      <Card className="gradient-sunset text-white rounded-3xl p-5 shadow-soft border border-white/20">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-200">
              Mon Abonnement
            </span>
            <h4 className="text-base font-serif font-black">Plan d'essai Gratuit</h4>
            <p className="text-xs text-white/80">Profitez de toutes les fonctionnalités d'épargne.</p>
          </div>
          <Button
            onClick={() => setActiveModal('promotions')}
            size="sm"
            className="bg-white text-primary hover:bg-white/90 font-bold rounded-2xl h-10 px-4 text-xs shrink-0 cursor-pointer shadow-xs"
          >
            Voir les offres
          </Button>
        </div>
      </Card>

      {/* SECTION 7: AIDE & LÉGAL */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2">
          🆘 AIDE & LÉGAL
        </h3>
        <Card className="glass-card rounded-3xl overflow-hidden border border-border/80 divide-y divide-border/60">
          <MenuRow
            icon={<HelpCircle className="w-5 h-5 text-primary" />}
            title="Centre d'aide & FAQ"
            onClick={() => setActiveModal('help_support')}
          />
          <MenuRow
            icon={<Lightbulb className="w-5 h-5 text-primary" />}
            title="Tutoriels & Découverte"
            onClick={() => setActiveModal('tutorial')}
          />
          <MenuRow
            icon={<Mail className="w-5 h-5 text-primary" />}
            title="Contacter le support"
            onClick={() => setActiveModal('contact_support')}
          />
          <MenuRow
            icon={<Bug className="w-5 h-5 text-primary" />}
            title="Signaler un problème"
            onClick={() => setActiveModal('report_issue')}
          />
          <MenuRow
            icon={<BookOpen className="w-5 h-5 text-primary" />}
            title="Documents légaux & Règlement des tontines"
            onClick={() => setActiveModal('legal_docs')}
          />
        </Card>
      </div>

      {/* LOGOUT BUTTON */}
      <div className="pt-2">
        <Button
          onClick={() => onLogout?.()}
          variant="outline"
          className="w-full h-12 rounded-2xl border-rose-300 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 font-bold hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Déconnexion</span>
        </Button>
      </div>

      {/* ========================================================================= */}
      {/* MODALS FOR EACH SETTING ITEM */}
      {/* ========================================================================= */}

      {/* 1. INFORMATIONS PERSONNELLES */}
      <Dialog open={activeModal === 'personal_info'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Informations personnelles</DialogTitle>
            <DialogDescription>Modifiez votre profil et personnalisez votre avatar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex justify-center py-2">
              <AvatarWorkshop
                value={editAvatar}
                onChange={(newAvatar) => setEditAvatar(newAvatar)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Nom complet</Label>
              <Input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Adresse Email</Label>
              <Input value={user.email} disabled className="rounded-xl bg-muted/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Numéro de Téléphone</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveProfile} disabled={savingSettings} className="gradient-sunset text-white font-bold rounded-xl w-full">
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer les modifications'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. VÉRIFICATION D'IDENTITÉ (KYC 3 NIVEAUX) */}
      <Dialog open={activeModal === 'kyc_verification'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              Vérification d'Identité (KYC)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Augmentez vos plafonds financiers de tontine en validant vos étapes d'identité.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-1">
              <div className="flex justify-between items-center font-bold text-emerald-700 dark:text-emerald-300">
                <span>Niveau 1 — Compte Basique</span>
                <Badge className="bg-emerald-500 text-white text-[9px]">Validé ✅</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">Téléphone & Email vérifiés. Limite : 500 000 FCFA/mois.</p>
            </div>

            <div className="p-3 bg-card border border-border/80 rounded-2xl space-y-1">
              <div className="flex justify-between items-center font-bold text-foreground">
                <span>Niveau 2 — Identité Certifiée</span>
                <Badge variant="outline" className="text-[9px]">Recommandé</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">Carte d'Identité Nationale ou Passeport. Limite : 2 000 000 FCFA/mois.</p>
              <Button size="sm" variant="outline" className="mt-1 h-7 text-[11px] font-bold w-full rounded-xl" onClick={() => toast.info("Soumission de pièce d'identité enregistrée.")}>
                Envoyer ma pièce d'identité
              </Button>
            </div>

            <div className="p-3 bg-card border border-border/80 rounded-2xl space-y-1">
              <div className="flex justify-between items-center font-bold text-foreground">
                <span>Niveau 3 — Compte Renforcé</span>
                <Badge variant="outline" className="text-[9px]">Grands Comptes</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">Vérification de domicile et contrôle financier sans plafond de tontine.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. MANDATAIRE NUMÉRIQUE */}
      <Dialog open={activeModal === 'digital_mandate'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              Mon Mandataire Numérique
            </DialogTitle>
            <DialogDescription className="text-xs">
              Désignez un proche de confiance pour consulter vos cotisations sans aucun droit de retrait.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold">Nom complet du mandataire</Label>
              <Input placeholder="Ex: Ama Akou" defaultValue="Ama Akou" className="rounded-xl h-10 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold">Téléphone du mandataire</Label>
              <Input placeholder="+228 90 00 00 00" defaultValue="+228 90 12 34 56" className="rounded-xl h-10 text-xs" />
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[11px] text-amber-800 dark:text-amber-300 font-medium">
              🛡️ Le mandataire aura un accès strictement <strong>consultatif</strong> (rappels et suivi de tontine) et ne pourra <strong>jamais effectuer de retrait d'argent</strong>.
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { toast.success("Mandataire numérique configuré avec succès !"); setActiveModal(null); }} className="gradient-sunset text-white font-bold rounded-xl w-full">
              Enregistrer le mandataire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. APPAREILS CONNECTÉS */}
      <Dialog open={activeModal === 'connected_devices'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Appareils Connectés & Sessions
            </DialogTitle>
            <DialogDescription className="text-xs">
              Gérez les sessions actives sur votre compte Eganyé.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-card border border-border/80 rounded-2xl flex justify-between items-center">
              <div>
                <p className="font-bold text-foreground">iPhone de Codorah (Actuel)</p>
                <p className="text-[10px] text-muted-foreground">Dernière activité : aujourd'hui, 16:04 • Lomé, Togo</p>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px]">Actif</Badge>
            </div>
            <div className="p-3 bg-card border border-border/80 rounded-2xl flex justify-between items-center">
              <div>
                <p className="font-bold text-foreground">Chrome — Windows 11</p>
                <p className="text-[10px] text-muted-foreground">Dernière activité : hier, 18:32</p>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-[10px] text-rose-500 hover:text-rose-600" onClick={() => toast.success("Session Chrome déconnectée.")}>
                Déconnecter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2. PAIEMENTS ET VIREMENTS */}
      <Dialog open={activeModal === 'payments_transfers'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Paiements et Virements</DialogTitle>
            <DialogDescription>Gérez votre solde et l'historique financier.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted/40 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground font-medium">Solde Actuel</span>
                <p className="text-2xl font-black text-primary">{(user.walletBalance || 0).toLocaleString()} FCFA</p>
              </div>
              <Button size="sm" onClick={() => setActiveModal('withdraw_funds')} className="gradient-sunset text-white rounded-xl text-xs font-bold">
                Retirer
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold">Recharger le portefeuille (Mobile Money)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Montant FCFA"
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(e.target.value)}
                  className="rounded-xl"
                />
                <Button onClick={handleRecharge} disabled={isRecharging} className="gradient-emerald text-white font-bold rounded-xl shrink-0">
                  {isRecharging ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Recharger'}
                </Button>
              </div>
            </div>

            <div className="pt-2">
              <span className="text-xs font-bold text-muted-foreground uppercase block mb-2">Historique des transactions</span>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {walletTransactions.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Aucune transaction enregistrée.</p>
                ) : (
                  walletTransactions.map(tx => (
                    <div key={tx.id} className="flex justify-between items-center p-2.5 bg-card border border-border/60 rounded-xl text-xs">
                      <div>
                        <p className="font-bold text-foreground">{tx.description}</p>
                        <p className="text-[10px] text-muted-foreground">{format(new Date(tx.date), 'dd/MM/yyyy HH:mm')}</p>
                      </div>
                      <span className={`font-bold ${tx.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} FCFA
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. INFORMATIONS DE PAIEMENT */}
      <Dialog open={activeModal === 'payment_info'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Informations de paiement</DialogTitle>
            <DialogDescription>Vos comptes Mobile Money enregistrés.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Compte Wave Senegal / Togo</Label>
              <Input value={waveAccount} onChange={(e) => setWaveAccount(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Compte Orange Money / Flooz</Label>
              <Input value={orangeAccount} onChange={(e) => setOrangeAccount(e.target.value)} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { toast.success("Moyens de paiement enregistrés !"); setActiveModal(null); }} className="gradient-sunset text-white font-bold rounded-xl w-full">
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. RETIRER DES FONDS */}
      <Dialog open={activeModal === 'withdraw_funds'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Retirer des fonds</DialogTitle>
            <DialogDescription>Transférez vos fonds vers votre Mobile Money.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Montant à retirer (FCFA)</Label>
              <Input type="number" placeholder="Ex: 5000" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Numéro Mobile Money destinataire</Label>
              <Input placeholder="90 00 00 00" value={withdrawPhone} onChange={(e) => setWithdrawPhone(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Code PIN de sécurité (4 chiffres)</Label>
              <Input type="password" maxLength={4} placeholder="••••" value={withdrawPin} onChange={(e) => setWithdrawPin(e.target.value)} className="rounded-xl font-mono text-center tracking-widest text-lg" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleWithdraw} disabled={isWithdrawing} className="gradient-sunset text-white font-bold rounded-xl w-full">
              {isWithdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmer le retrait'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. MES PROMOTIONS */}
      <Dialog open={activeModal === 'promotions'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Mes promotions & Parrainage</DialogTitle>
            <DialogDescription>Invitez des amis et gagnez des bonus de cotisation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-primary/10 border border-primary/20 p-4 rounded-2xl space-y-2">
              <span className="text-xs font-bold text-primary uppercase">Votre code de parrainage</span>
              <div className="flex items-center justify-between bg-card p-2.5 rounded-xl border border-border">
                <span className="font-mono font-bold text-base">EGANYE-{user.uid.slice(0, 6).toUpperCase()}</span>
                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(`EGANYE-${user.uid.slice(0, 6).toUpperCase()}`); setCopiedPromo(true); toast.success("Code copié !"); setTimeout(() => setCopiedPromo(false), 2000); }}>
                  {copiedPromo ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 6. HISTORIQUE DES TONTINES */}
      <Dialog open={activeModal === 'tontine_history'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Historique des tontines</DialogTitle>
            <DialogDescription>Toutes vos cotisations et payouts passés.</DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-2 py-2">
            {contributions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Aucune cotisation enregistrée.</p>
            ) : (
              contributions.map(c => (
                <div key={c.id} className="p-3 bg-card border border-border/60 rounded-xl text-xs flex justify-between items-center">
                  <div>
                    <p className="font-bold text-foreground">{c.amount.toLocaleString()} FCFA</p>
                    <p className="text-[10px] text-muted-foreground">{c.period || format(new Date(c.date), 'dd/MM/yyyy')}</p>
                  </div>
                  <Badge className={c.status === 'paid' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600'}>
                    {c.status === 'paid' ? 'Payé' : 'En attente'}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 7. SÉCURITÉ & MOT DE PASSE */}
      <Dialog open={activeModal === 'security_settings'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Sécurité & Mot de passe</DialogTitle>
            <DialogDescription>Gérez votre code PIN 4 chiffres et l'empreinte digitale.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Nouveau Code PIN Retrait (4 chiffres)</Label>
              <Input type="password" maxLength={4} placeholder="1234" value={newPin} onChange={(e) => setNewPin(e.target.value)} className="rounded-xl font-mono text-center tracking-widest text-lg" />
              <Button onClick={handleSavePin} size="sm" className="gradient-sunset text-white font-bold rounded-xl mt-2 w-full">Définir le nouveau PIN</Button>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl pt-3">
              <div className="flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-primary" />
                <span className="text-xs font-bold">Connexion Biométrique (Face ID / Empreinte)</span>
              </div>
              <input type="checkbox" checked={biometricsEnabled} onChange={(e) => setBiometricsEnabled(e.target.checked)} className="w-4 h-4 accent-primary rounded cursor-pointer" />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 8. PRÉFÉRENCES DE NOTIFICATION */}
      <Dialog open={activeModal === 'notifications_settings'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Préférences de notification</DialogTitle>
            <DialogDescription>Choisissez vos canaux de rappels et alertes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between p-3 bg-card border border-border/60 rounded-xl">
              <span className="text-xs font-bold">Notifications Email (Rappels de cotisation)</span>
              <input type="checkbox" checked={emailNotif} onChange={(e) => setEmailNotif(e.target.checked)} className="w-4 h-4 accent-primary rounded cursor-pointer" />
            </div>
            <div className="flex items-center justify-between p-3 bg-card border border-border/60 rounded-xl">
              <span className="text-xs font-bold">Notifications Push (In-App)</span>
              <input type="checkbox" checked={pushNotif} onChange={(e) => setPushNotif(e.target.checked)} className="w-4 h-4 accent-primary rounded cursor-pointer" />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 9. UTILISATEURS BLOQUÉS */}
      <Dialog open={activeModal === 'blocked_users'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Utilisateurs bloqués</DialogTitle>
            <DialogDescription>Liste des membres que vous avez bloqués.</DialogDescription>
          </DialogHeader>
          <div className="py-6 text-center text-xs text-muted-foreground">
            Aucun utilisateur bloqué pour le moment.
          </div>
        </DialogContent>
      </Dialog>

      {/* 10. MON ABONNEMENT */}
      <Dialog open={activeModal === 'subscription'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Abonnement eganyé Premium</DialogTitle>
            <DialogDescription>Débloquez la création illimitée de tontines et la gestion d'enchères.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="p-4 border-2 border-primary bg-primary/5 rounded-2xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-primary">Plan Premium Pro</span>
                <Badge className="bg-primary text-white text-[10px]">1000 FCFA / mois</Badge>
              </div>
              <ul className="text-xs space-y-1 text-muted-foreground list-disc list-inside">
                <li>Nombre de cercles illimité</li>
                <li>Mode enchères et tirage au sort automatique</li>
                <li>Export des rapports comptables PDF</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { toast.success("Demande d'abonnement transmise !"); setActiveModal(null); }} className="gradient-sunset text-white font-bold rounded-xl w-full">
              Passer au Premium
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 11. AIDE ET SUPPORT */}
      <Dialog open={activeModal === 'help_support'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Aide et support</DialogTitle>
            <DialogDescription>Foire aux questions fréquentes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto py-2 text-xs">
            <div className="p-3 bg-muted/40 rounded-xl space-y-1">
              <p className="font-bold text-foreground">Comment fonctionne la tontine eganyé ?</p>
              <p className="text-muted-foreground">Chaque membre cotise à chaque période fixe. À la fin de chaque tour, le pot est versé au bénéficiaire selon l'ordre établi.</p>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl space-y-1">
              <p className="font-bold text-foreground">Les paiements sont-ils sécurisés ?</p>
              <p className="text-muted-foreground">Oui, toutes les transactions sont enregistrées dans un grand livre comptable à partie double avec validation PIN 4 chiffres.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 12. SUGGESTIONS ET AMÉLIORATIONS */}
      <Dialog open={activeModal === 'suggestions'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Suggestions et améliorations</DialogTitle>
            <DialogDescription>Partagez vos idées pour rendre eganyé encore meilleur !</DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Textarea placeholder="Vos idées ou suggestions..." value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} className="rounded-xl h-28 text-xs" />
          </div>
          <DialogFooter>
            <Button onClick={() => { toast.success("Merci pour vos suggestions !"); setFeedbackText(''); setActiveModal(null); }} className="gradient-sunset text-white font-bold rounded-xl w-full">
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 13. SIGNALER UN PROBLÈME */}
      <Dialog open={activeModal === 'report_bug'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Signaler un problème</DialogTitle>
            <DialogDescription>Décrivez le bogue ou le souci rencontré.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Sujet du problème" value={bugSubject} onChange={(e) => setBugSubject(e.target.value)} className="rounded-xl" />
            <Textarea placeholder="Description détaillée..." value={bugDescription} onChange={(e) => setBugDescription(e.target.value)} className="rounded-xl h-24 text-xs" />
          </div>
          <DialogFooter>
            <Button onClick={handleSendTicket} disabled={isSendingTicket} className="gradient-sunset text-white font-bold rounded-xl w-full">
              {isSendingTicket ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Transmettre le signalement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 14. DOCUMENTS LÉGAUX */}
      <Dialog open={activeModal === 'legal_docs'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Documents légaux</DialogTitle>
            <DialogDescription>Conditions d'utilisation et charte de confidentialité.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 text-xs text-muted-foreground">
            <p className="font-bold text-foreground">Conditions Générales d'Utilisation (CGU)</p>
            <p>L'utilisation de la plateforme eganyé implique l'acceptation sans réserve des règles de la tontine collaborative.</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* 15. TUTORIEL */}
      <Dialog open={activeModal === 'tutorial'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Tutoriel d'utilisation</DialogTitle>
            <DialogDescription>Guide rapide pour bien démarrer sur eganyé.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl">
              <span className="font-bold text-primary">1.</span>
              <p>Rechargez votre portefeuille numérique par Mobile Money (Wave, Orange Money, Moov, MTN).</p>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl">
              <span className="font-bold text-primary">2.</span>
              <p>Rejoignez un cercle public ou créez votre propre groupe de tontine.</p>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl">
              <span className="font-bold text-primary">3.</span>
              <p>Cotisez à chaque cycle et recevez l'intégralité du pot lorsque vient votre tour !</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 16. CONTACTER LE SUPPORT */}
      <Dialog open={activeModal === 'contact_support'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Contacter le support</DialogTitle>
            <DialogDescription>Assistance disponible 7j/7.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <p className="text-muted-foreground">Une question sur un virement ou une cotisation ? Écrivez-nous à :</p>
            <div className="p-3 bg-card border border-border/80 rounded-xl font-bold text-foreground flex items-center justify-between">
              <span>support@eganye.app</span>
              <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText('support@eganye.app'); toast.success("Email du support copié !"); }}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Menu Row Component
function MenuRow({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/40 transition-colors group"
    >
      <div className="flex items-center gap-3.5">
        <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
          {icon}
        </div>
        <span className="font-semibold text-sm text-foreground">{title}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
    </div>
  );
}
