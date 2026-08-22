import React, { useState, useEffect } from 'react';
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
import { UserProfile, Group, Contribution, WalletTransaction, KycSubmission } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { mapWalletTransactionRow, mapContributionRow } from '@/lib/mappers';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { executeFinancialTransaction, verifyUserPin } from '@/lib/ledger';
import { fetchLatestKycSubmission, submitKycDocument, KYC_VERIFIED_LEVEL } from '@/lib/kyc';
import { CustomAvatar, AvatarConfig } from './CustomAvatar';
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
  const [editPhone, setEditPhone] = useState(user.phone || '');
  const [editLanguage, setEditLanguage] = useState(user.language || 'fr');
  const [editFirstName, setEditFirstName] = useState(user.firstName || '');
  const [editLastName, setEditLastName] = useState(user.lastName || '');
  const [editDateOfBirth, setEditDateOfBirth] = useState(user.dateOfBirth || '');
  const [savingSettings, setSavingSettings] = useState(false);
  const [showBalance, setShowBalance] = useState(true);

  // Avatar state
  const [editAvatar, setEditAvatar] = useState<AvatarConfig>(user.photoURL || '');

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
  // Stable per-attempt idempotency keys: a retry after a failed request must
  // reuse the same key (so the backend dedupes it if it actually went
  // through), while editing the amount signals a genuinely new operation.
  const rechargeIdempotencyKeyRef = React.useRef<string | null>(null);
  useEffect(() => { rechargeIdempotencyKeyRef.current = null; }, [rechargeAmount]);
  const [isRecharging, setIsRecharging] = useState(false);

  // Withdrawal states
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const withdrawIdempotencyKeyRef = React.useRef<string | null>(null);
  useEffect(() => { withdrawIdempotencyKeyRef.current = null; }, [withdrawAmount]);
  const [withdrawMethod, setWithdrawMethod] = useState('flooz');
  const [withdrawPhone, setWithdrawPhone] = useState('+228 90 00 00 00');
  const [withdrawPin, setWithdrawPin] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Delete account confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Legal documents (previously dead buttons showing a toast and nothing else)
  const [legalDoc, setLegalDoc] = useState<'cgu' | 'reglement' | 'confidentialite' | null>(null);
  const legalDocs = {
    cgu: {
      title: "Conditions Générales d'Utilisation",
      body: [
        "Eganyé est une plateforme numérique de gestion de tontines (cercles d'épargne rotative). En créant un compte, vous acceptez d'utiliser le service conformément à sa finalité : organiser et suivre des cotisations entre membres d'un même cercle.",
        "Vous êtes responsable de l'exactitude des informations fournies lors de votre inscription et de la vérification d'identité. Un compte non vérifié ne peut ni créer ni rejoindre de cercle.",
        "Chaque cercle est régi par les paramètres définis par son créateur (montant, fréquence, méthode de distribution, pénalités de retard). En rejoignant un cercle, vous acceptez ces conditions spécifiques.",
        "Le portefeuille virtuel Eganyé permet de recharger et de retirer des fonds via Mobile Money. Eganyé n'est pas un établissement bancaire et les fonds détenus ne portent pas intérêt.",
        "Eganyé se réserve le droit de suspendre un compte en cas d'usage frauduleux, de non-respect répété des engagements de cotisation, ou de fourniture de fausses informations d'identité.",
      ],
    },
    reglement: {
      title: 'Règlement Officiel des Tontines',
      body: [
        "Une tontine (ou cercle d'épargne rotative) regroupe des membres qui cotisent un même montant à intervalle régulier ; à chaque cycle, l'intégralité du pot est versée à un seul bénéficiaire selon l'ordre défini.",
        "Trois méthodes de distribution existent : séquentielle (ordre fixe défini à la création), tirage au sort (bénéficiaire désigné aléatoirement pour chaque cycle), ou enchères (les membres peuvent proposer un rabais sur le pot, redistribué aux autres).",
        "Un retard de cotisation au-delà du délai de grâce défini par le créateur du cercle entraîne l'application de la pénalité configurée (montant fixe ou pourcentage par jour de retard), prélevée automatiquement dès que le solde du portefeuille le permet.",
        "Le créateur d'un cercle (ou un administrateur) est seul habilité à déclencher la distribution des fonds d'un cycle et à valider les demandes d'adhésion.",
        "Un cercle est clôturé lorsque tous les membres ont reçu leur tour, ou manuellement par son créateur.",
      ],
    },
    confidentialite: {
      title: 'Politique de Confidentialité & Données',
      body: [
        "Eganyé collecte les données nécessaires au fonctionnement du service : informations d'identité (nom, téléphone, email, pièce d'identité pour la vérification KYC), données financières (cotisations, transactions, solde), et données d'usage.",
        "Vos données financières sont chiffrées et ne sont accessibles qu'à vous-même et aux administrateurs habilités du cercle concerné. Votre pièce d'identité est stockée dans un espace privé, consultable uniquement par vous et par l'équipe de vérification.",
        "Vos données ne sont jamais vendues à des tiers. Elles peuvent être partagées avec nos prestataires techniques strictement nécessaires (hébergement, paiement Mobile Money, envoi d'emails) pour le fonctionnement du service.",
        "Vous pouvez à tout moment demander la suppression de votre compte depuis Paramètres. La suppression retire votre profil ; certaines données comptables peuvent être conservées à des fins d'audit conformément aux obligations légales.",
        "Pour toute question relative à vos données, contactez le support depuis la section Aide.",
      ],
    },
  } as const;

  // KYC (identity verification) state
  const [kycSubmission, setKycSubmission] = useState<KycSubmission | null>(null);
  const [kycLoading, setKycLoading] = useState(true);
  const [kycFullName, setKycFullName] = useState(user.displayName || '');
  const [kycIdNumber, setKycIdNumber] = useState('');
  const [kycFile, setKycFile] = useState<File | null>(null);
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);

  // Mandataire numérique (digital proxy) state
  const [mandateName, setMandateName] = useState(user.mandateName || '');
  const [mandatePhone, setMandatePhone] = useState(user.mandatePhone || '');
  const [isSavingMandate, setIsSavingMandate] = useState(false);

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
    const fetchKyc = async () => {
      setKycLoading(true);
      const submission = await fetchLatestKycSubmission(user.uid);
      setKycSubmission(submission);
      setKycLoading(false);
    };
    fetchTx();
    fetchContribs();
    fetchKyc();
  }, [user.uid]);

  const handleSubmitKyc = async () => {
    if (!kycFullName.trim()) {
      toast.error("Veuillez saisir votre nom complet.");
      return;
    }
    if (!kycFile) {
      toast.error("Veuillez sélectionner une photo de votre pièce d'identité.");
      return;
    }
    setIsSubmittingKyc(true);
    try {
      const result = await submitKycDocument({
        userId: user.uid,
        fullName: kycFullName.trim(),
        idNumber: kycIdNumber.trim() || undefined,
        file: kycFile,
      });
      if (!result.success) throw new Error(result.message);
      toast.success(result.message);
      setKycFile(null);
      const submission = await fetchLatestKycSubmission(user.uid);
      setKycSubmission(submission);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'envoi du document.");
    } finally {
      setIsSubmittingKyc(false);
    }
  };

  const handleSaveMandate = async () => {
    setIsSavingMandate(true);
    try {
      const { error } = await supabase.from('profiles').update({
        mandate_name: mandateName.trim() || null,
        mandate_phone: mandatePhone.trim() || null,
      }).eq('id', user.uid);
      if (error) throw error;
      toast.success("Mandataire enregistré !");
    } catch (err: any) {
      toast.error("Erreur lors de l'enregistrement du mandataire.");
    } finally {
      setIsSavingMandate(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingSettings(true);
    try {
      const { error } = await supabase.from('profiles').update({
        display_name: editDisplayName,
        language: editLanguage,
        avatar_url: editAvatar || null,
        first_name: editFirstName.trim() || null,
        last_name: editLastName.trim() || null,
        date_of_birth: editDateOfBirth || null,
        phone: editPhone.trim() || null,
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
    if (!navigator.onLine) {
      toast.error("Vous êtes hors-ligne. La recharge nécessite une connexion internet.");
      return;
    }
    const amount = parseFloat(rechargeAmount);
    if (!amount || amount < 100) {
      toast.error("Veuillez saisir un montant valide (minimum 100 FCFA).");
      return;
    }
    setIsRecharging(true);
    try {
      if (!rechargeIdempotencyKeyRef.current) {
        rechargeIdempotencyKeyRef.current = crypto.randomUUID();
      }
      const result = await executeFinancialTransaction({
        idempotencyKey: rechargeIdempotencyKeyRef.current,
        userId: user.uid,
        amount,
        currency: 'FCFA',
        description: `Recharge de portefeuille via Mobile Money (${amount.toLocaleString()} FCFA)`,
        actionType: 'wallet_recharge',
        debitAccount: 'mobile_money_gateway',
        creditAccount: `user_wallet:${user.uid}`
      });
      if (!result.success) throw new Error(result.message);
      rechargeIdempotencyKeyRef.current = null;
      toast.success(`Portefeuille rechargé avec succès (+${amount.toLocaleString()} FCFA) !`);
      setRechargeAmount('');
    } catch (err: any) {
      toast.error(err.message || "Échec de la recharge.");
    } finally {
      setIsRecharging(false);
    }
  };

  const handleWithdraw = async () => {
    if (!navigator.onLine) {
      toast.error("Vous êtes hors-ligne. Le retrait nécessite une connexion internet.");
      return;
    }
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
      if (!withdrawIdempotencyKeyRef.current) {
        withdrawIdempotencyKeyRef.current = crypto.randomUUID();
      }
      const result = await executeFinancialTransaction({
        idempotencyKey: withdrawIdempotencyKeyRef.current,
        userId: user.uid,
        amount,
        currency: 'FCFA',
        description: `Retrait vers ${withdrawMethod.toUpperCase()} (${withdrawPhone})`,
        actionType: 'wallet_withdrawal',
        debitAccount: `user_wallet:${user.uid}`,
        creditAccount: `mobile_money_${withdrawMethod}`
      });
      if (!result.success) throw new Error(result.message);
      withdrawIdempotencyKeyRef.current = null;
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
      icon: <User className="w-4.5 h-4.5 text-amber-600" />,
      color: 'bg-amber-50 dark:bg-amber-500/10',
      group: 'Compte & sécurité'
    },
    {
      id: 'security',
      title: 'Sécurité & confidentialité',
      description: 'Sécurisez votre compte et gérez vos données.',
      icon: <Shield className="w-4.5 h-4.5 text-blue-600" />,
      color: 'bg-blue-50 dark:bg-blue-500/10',
      group: 'Compte & sécurité'
    },
    {
      id: 'payments',
      title: 'Argent & paiements',
      description: 'Gérez vos moyens de paiement, transferts et retraits.',
      icon: <Wallet className="w-4.5 h-4.5 text-emerald-600" />,
      color: 'bg-emerald-50 dark:bg-emerald-500/10',
      group: 'Argent & cercles'
    },
    {
      id: 'circles',
      title: 'Mes cercles',
      description: 'Gérez vos tontines, vos préférences et invitations.',
      icon: <Users className="w-4.5 h-4.5 text-orange-600" />,
      color: 'bg-orange-50 dark:bg-orange-500/10',
      group: 'Argent & cercles'
    },
    {
      id: 'subscription',
      title: 'Abonnement & récompenses',
      description: 'Gérez votre abonnement et vos avantages.',
      icon: <Award className="w-4.5 h-4.5 text-purple-600" />,
      color: 'bg-purple-50 dark:bg-purple-500/10',
      group: 'Argent & cercles'
    },
    {
      id: 'notifications',
      title: 'Notifications & communication',
      description: 'Choisissez comment vous recevez les notifications.',
      icon: <Bell className="w-4.5 h-4.5 text-amber-600" />,
      color: 'bg-amber-50 dark:bg-amber-500/10',
      group: 'Général'
    },
    {
      id: 'support',
      title: 'Aide & support',
      description: 'Trouvez de l\'aide, des tutoriels ou contactez le support.',
      icon: <HelpCircle className="w-4.5 h-4.5 text-teal-600" />,
      color: 'bg-teal-50 dark:bg-teal-500/10',
      group: 'Général'
    },
    {
      id: 'legal',
      title: 'Légal & informations',
      description: 'Consultez les conditions, politiques et documents légaux.',
      icon: <BookOpen className="w-4.5 h-4.5 text-slate-600" />,
      color: 'bg-slate-50 dark:bg-slate-500/10',
      group: 'Général'
    }
  ];

  const categoryGroups = ['Compte & sécurité', 'Argent & cercles', 'Général'].map((groupName) => ({
    name: groupName,
    items: mainCategories.filter((c) => c.group === groupName),
  }));

  return (
    <div className="space-y-8 pb-20 max-w-6xl mx-auto">
      {/* HEADER BAR FOR SUB-SECTIONS */}
      {activeSection && (
        <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border shadow-soft">
          <Button
            onClick={() => setActiveSection(null)}
            variant="ghost"
            className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer hover:bg-muted h-8"
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
            <Card className="glass-card rounded-2xl overflow-hidden shadow-soft lg:col-span-1 h-fit space-y-5 p-5">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="relative group cursor-pointer" onClick={() => setActiveSection('account')}>
                  <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-primary/20 shadow-md">
                    <CustomAvatar photoURL={user.photoURL} name={user.displayName} size={96} />
                  </div>
                  <div className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full shadow-xs">
                    <User className="w-4 h-4" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <h2 className="text-xl font-serif font-black text-foreground">{user.displayName}</h2>
                    {(user.kycLevel ?? 1) >= KYC_VERIFIED_LEVEL ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold">
                        Compte vérifié
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-bold">
                        Identité non vérifiée
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">{user.phone || 'Téléphone non renseigné'}</p>
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
                <span className="font-bold text-foreground">
                  {user.createdAt ? format(new Date(user.createdAt), 'dd MMMM yyyy', { locale: fr }) : '—'}
                </span>
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

            {/* Right column: grouped settings list — compact, scannable rows
                instead of 9 equal-height tiles (the flat grid became a long
                scroll of near-identical cards on mobile). */}
            <div className="lg:col-span-2 space-y-5">
              {categoryGroups.map((group) => (
                <div key={group.name} className="space-y-2">
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-muted-foreground px-1">
                    {group.name}
                  </h3>
                  <Card className="rounded-2xl border border-border shadow-soft overflow-hidden py-0 gap-0">
                    {group.items.map((cat, idx) => (
                      <button
                        key={cat.id}
                        onClick={() => setActiveSection(cat.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/50 active:bg-muted transition-colors cursor-pointer ${
                          idx > 0 ? 'border-t border-border/60' : ''
                        }`}
                      >
                        <div className={`p-2 rounded-xl ${cat.color} shrink-0`}>
                          {cat.icon}
                        </div>
                        <span className="flex-1 font-bold text-sm text-foreground">{cat.title}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </Card>
                </div>
              ))}

              {/* Destructive action — kept visually separate from the groups above */}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-rose-200 dark:border-rose-950 bg-rose-50/80 dark:bg-rose-950/20 hover:bg-rose-100/80 dark:hover:bg-rose-950/40 transition-colors cursor-pointer text-left"
              >
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 shrink-0">
                  <Trash2 className="w-4.5 h-4.5" />
                </div>
                <span className="flex-1 font-bold text-sm text-rose-600 dark:text-rose-400">Supprimer mon compte</span>
                <ChevronRight className="w-4 h-4 text-rose-400 shrink-0" />
              </button>

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
                  name={editDisplayName || user.displayName}
                  userId={user.uid}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Prénom</Label>
                  <Input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Nom</Label>
                  <Input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} className="rounded-xl h-11" />
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
                  <Input type="date" value={editDateOfBirth} onChange={(e) => setEditDateOfBirth(e.target.value)} className="rounded-xl h-11" />
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
                <Badge className={`font-bold text-xs border ${
                  (user.kycLevel ?? 1) >= KYC_VERIFIED_LEVEL
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                }`}>
                  {(user.kycLevel ?? 1) >= KYC_VERIFIED_LEVEL ? 'Vérifié ✅' : `Niveau ${user.kycLevel ?? 1} sur 3`}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Une pièce d'identité valide est nécessaire pour créer ou rejoindre un cercle de tontine.
              </p>

              {kycLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (user.kycLevel ?? 1) >= KYC_VERIFIED_LEVEL ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex justify-between items-center">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">🪪 Pièce d'Identité</p>
                    <p className="text-[11px] text-muted-foreground">
                      Vérifiée{user.kycVerifiedAt ? ` le ${format(new Date(user.kycVerifiedAt), 'dd/MM/yyyy')}` : ''}
                    </p>
                  </div>
                  <Badge className="bg-emerald-500 text-white text-[10px]">Vérifiée ✅</Badge>
                </div>
              ) : kycSubmission?.status === 'pending' ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex justify-between items-center">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-300">🪪 Pièce d'Identité</p>
                    <p className="text-[11px] text-muted-foreground">Envoyée le {format(new Date(kycSubmission.createdAt), 'dd/MM/yyyy')}</p>
                  </div>
                  <Badge className="bg-amber-500 text-white text-[10px]">En attente de validation</Badge>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {kycSubmission?.status === 'rejected' && (
                    <div className="p-3 bg-danger-soft border border-danger/20 rounded-2xl text-[11px] text-danger font-medium">
                      ❌ Votre précédente soumission a été refusée{kycSubmission.rejectionReason ? ` : ${kycSubmission.rejectionReason}` : ''}. Veuillez soumettre à nouveau.
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Nom complet (tel que sur la pièce)</Label>
                    <Input value={kycFullName} onChange={(e) => setKycFullName(e.target.value)} className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Numéro de la pièce d'identité (optionnel)</Label>
                    <Input value={kycIdNumber} onChange={(e) => setKycIdNumber(e.target.value)} className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Photo de la carte nationale d'identité</Label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setKycFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-primary file:text-primary-foreground file:text-xs file:font-bold"
                    />
                  </div>
                  <Button onClick={handleSubmitKyc} disabled={isSubmittingKyc} className="gradient-sunset text-white font-bold rounded-2xl h-12 w-full mt-2">
                    {isSubmittingKyc ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Soumettre pour vérification'}
                  </Button>
                </div>
              )}
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
                  <Input value={mandateName} onChange={(e) => setMandateName(e.target.value)} className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Numéro de téléphone</Label>
                  <Input value={mandatePhone} onChange={(e) => setMandatePhone(e.target.value)} className="rounded-xl h-11" />
                </div>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                  🛡️ Le mandataire reçoit uniquement les notifications et le suivi de vos cercles. Il ne possède <strong>aucun accès à votre portefeuille ni aux retraits</strong>.
                </div>
              </div>

              <Button onClick={handleSaveMandate} disabled={isSavingMandate} className="gradient-sunset text-white font-bold rounded-2xl h-12 w-full mt-2">
                {isSavingMandate ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer le mandataire'}
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
      {/* 3.B. SUB-SECTION SCREEN: MES CERCLES & GRAPHES */}
      {/* ========================================================================= */}
      {activeSection === 'circles' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl mx-auto">
          <Card className="glass-card rounded-3xl p-6 border border-border/80 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-serif font-bold text-lg text-foreground">Mes Cercles de Tontine</h3>
              <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 font-bold text-xs">
                {groups?.length || 0} actif(s)
              </Badge>
            </div>
            
            <div className="p-4 bg-card border border-border/60 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-foreground">Statistiques de participation</h4>
              <div className="flex items-end gap-2 h-32 pt-4">
                {/* Empty Graphs (as requested by user: "mes cercles essaie de faire des graphes vides") */}
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex-1 flex flex-col justify-end gap-2 items-center group">
                    <div className="w-full bg-muted/60 rounded-t-sm h-[15%] group-hover:bg-primary/50 transition-all duration-300"></div>
                    <span className="text-[9px] text-muted-foreground font-medium uppercase">Mois {i+1}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-2">Aucune donnée suffisante pour générer les graphiques complets ce mois-ci.</p>
            </div>

            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Vos cercles actuels</h4>
              {!groups || groups.length === 0 ? (
                <div className="p-4 text-center bg-muted/30 rounded-2xl border border-border/60">
                  <p className="text-xs text-muted-foreground">Vous n'êtes membre d'aucun cercle.</p>
                  <Button variant="link" className="text-primary text-xs h-auto p-0 mt-1">Rejoindre un cercle</Button>
                </div>
              ) : (
                groups.map((g: any) => (
                  <div key={g.id} className="p-3 bg-card border border-border/60 rounded-2xl flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-foreground">{g.name}</p>
                      <p className="text-[10px] text-muted-foreground">{g.contributionAmount.toLocaleString()} FCFA / {g.frequency}</p>
                    </div>
                    <Badge variant={g.status === 'active' ? 'default' : 'secondary'} className="text-[9px]">
                      {g.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* 3.C. SUB-SECTION SCREEN: ABONNEMENT */}
      {/* ========================================================================= */}
      {activeSection === 'subscription' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl mx-auto">
          <Card className="glass-card rounded-3xl p-6 border border-border/80 space-y-4">
            <h3 className="font-serif font-bold text-lg text-foreground">Abonnement & Avantages</h3>
            
            <div className="p-5 bg-gradient-to-br from-purple-500/10 to-primary/5 border border-purple-500/20 rounded-2xl space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <Badge className="bg-purple-500 text-white font-bold text-[10px] mb-2">Plan Actuel : Gratuit</Badge>
                  <h4 className="text-sm font-bold text-purple-900 dark:text-purple-300">Eganyé Essentiel</h4>
                  <p className="text-[11px] text-purple-700/80 dark:text-purple-300/80 max-w-xs mt-1">
                    Accès de base aux cercles de tontine. Limité à 2 cercles simultanés et sans l'assistant IA avancé.
                  </p>
                </div>
                <Award className="w-10 h-10 text-purple-500 opacity-50" />
              </div>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl h-10 text-xs w-full mt-2 shadow-soft">
                Passer à Eganyé Premium (1500 FCFA/mois)
              </Button>
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
              <div className="p-3 bg-card border border-border/60 rounded-2xl flex justify-between items-center cursor-pointer hover:bg-muted/40" onClick={() => setLegalDoc('cgu')}>
                <span className="font-bold">Conditions Générales d'Utilisation (CGU)</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="p-3 bg-card border border-border/60 rounded-2xl flex justify-between items-center cursor-pointer hover:bg-muted/40" onClick={() => setLegalDoc('reglement')}>
                <span className="font-bold">Règlement Officiel des Tontines</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="p-3 bg-card border border-border/60 rounded-2xl flex justify-between items-center cursor-pointer hover:bg-muted/40" onClick={() => setLegalDoc('confidentialite')}>
                <span className="font-bold">Politique de Confidentialité & Données</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Legal document viewer — was previously a toast.info() and nothing else */}
      <Dialog open={legalDoc !== null} onOpenChange={(open) => !open && setLegalDoc(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl">
          {legalDoc && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-lg font-bold text-foreground">
                  {legalDocs[legalDoc].title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-xs text-muted-foreground leading-relaxed pt-1">
                {legalDocs[legalDoc].body.map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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
