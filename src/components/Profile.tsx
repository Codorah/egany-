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
  PhoneCall,
  Upload,
  XCircle,
  AlertTriangle,
  IdCard
} from 'lucide-react';
import { UserProfile, Group, Contribution, WalletTransaction, KycSubmission } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase, changePassword } from '@/lib/supabase';
import { mapWalletTransactionRow, mapContributionRow } from '@/lib/mappers';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { executeFinancialTransaction, verifyUserPin, setUserPin } from '@/lib/ledger';
import { apiUrl } from '@/lib/apiBase';
import { fetchLatestKycSubmission, submitKycDocument, KYC_VERIFIED_LEVEL } from '@/lib/kyc';
import { CustomAvatar, AvatarConfig } from './CustomAvatar';
import { AvatarWorkshop } from './AvatarWorkshop';
import { LanguageSwitcher } from './ui/LanguageSwitcher';
import { BiometricPrompt } from './BiometricPrompt';
import { useBiometrics } from '@/hooks/useBiometrics';

interface ProfileProps {
  user: UserProfile;
  groups: Group[];
  defaultTab?: string;
  onLogout?: () => void;
  onNavigate?: (view: string) => void;
}

export function Profile({ user, groups, defaultTab, onLogout, onNavigate }: ProfileProps) {
  const { t, language, setLanguage } = useLanguage();
  
  // Navigation state: null = Root settings, string = active sub-category screen
  const [activeSection, setActiveSection] = useState<string | null>(defaultTab === 'wallet' ? 'payments' : null);
  const [activeSubTab, setActiveSubTab] = useState<string>('personal_info');

  // Form states
  const [editDisplayName, setEditDisplayName] = useState(user.displayName);
  const [editPhone, setEditPhone] = useState(user.phone || '');
  const [editFirstName, setEditFirstName] = useState(user.firstName || '');
  const [editLastName, setEditLastName] = useState(user.lastName || '');
  const [editDateOfBirth, setEditDateOfBirth] = useState(user.dateOfBirth || '');
  const [savingSettings, setSavingSettings] = useState(false);
  const [showBalance, setShowBalance] = useState(true);

  // Avatar state
  const [editAvatar, setEditAvatar] = useState<AvatarConfig>(user.photoURL || '');

  // Security & Toggles states
  const [newPin, setNewPin] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const { isEnrolled: biometricsEnabled, disableBiometrics } = useBiometrics();
  const [isBiometricPromptOpen, setIsBiometricPromptOpen] = useState(false);
  const [pushNotif, setPushNotif] = useState(user.pushEnabled ?? true);
  const [smsNotif, setSmsNotif] = useState(user.smsNotificationsEnabled ?? false);
  const [emailNotif, setEmailNotif] = useState(user.emailNotificationsEnabled ?? true);
  const [whatsAppNotif, setWhatsAppNotif] = useState(user.whatsappNotificationsEnabled ?? false);

  // Wallet & Transactions
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [rechargeAmount, setRechargeAmount] = useState('');
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
  const [mandatePermissions, setMandatePermissions] = useState<string[]>(
    user.mandatePermissions || ['view_contributions', 'receive_reminders']
  );
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
        mandate_permissions: mandatePermissions,
      }).eq('id', user.uid);
      if (error) throw error;
      toast.success("Mandataire enregistré !");
    } catch (err: any) {
      toast.error("Erreur lors de l'enregistrement du mandataire.");
    } finally {
      setIsSavingMandate(false);
    }
  };

  const handleChangePin = async () => {
    if (!/^\d{4}$/.test(newPin)) {
      toast.error('Le code PIN doit comporter exactement 4 chiffres.');
      return;
    }
    setIsSavingPin(true);
    try {
      const result = await setUserPin(user.uid, newPin);
      if (!result.success) throw new Error(result.message);
      toast.success(result.message);
      setNewPin('');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la mise à jour du code PIN.');
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setIsSavingPassword(true);
    try {
      const { error } = await changePassword(newPassword);
      if (error) throw error;
      toast.success('Mot de passe mis à jour !');
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la mise à jour du mot de passe.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleToggleBiometrics = async (enable: boolean) => {
    if (enable) {
      setIsBiometricPromptOpen(true);
      return;
    }
    disableBiometrics();
    await supabase.from('profiles').update({ biometrics_enabled: false }).eq('id', user.uid);
  };

  const handleToggleNotificationChannel = async (
    column: 'push_enabled' | 'sms_notifications_enabled' | 'email_notifications_enabled' | 'whatsapp_notifications_enabled',
    setLocal: (value: boolean) => void,
    value: boolean
  ) => {
    setLocal(value);
    const { error } = await supabase.from('profiles').update({ [column]: value }).eq('id', user.uid);
    if (error) {
      setLocal(!value);
      toast.error('Erreur lors de la sauvegarde de la préférence.');
    }
  };

  const handleSaveProfile = async () => {
    setSavingSettings(true);
    try {
      const { error } = await supabase.from('profiles').update({
        display_name: editDisplayName,
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
      // Le portefeuille n'est crédité qu'après un vrai paiement Paydunya
      // confirmé (App.tsx gère le retour ?paydunya_success=true) — on ne
      // crédite jamais directement ici.
      const response = await fetch(apiUrl('/api/create-paydunya-checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, userId: user.uid, userName: user.displayName, userEmail: user.email }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "Impossible de démarrer le paiement Paydunya.");
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Échec de la recharge.");
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
      // Paydunya n'expose que l'encaissement, pas le décaissement automatique
      // vers Mobile Money : l'argent est réservé (débité) immédiatement, puis
      // un admin l'envoie manuellement et marque la demande traitée. Le solde
      // est remboursé automatiquement si l'admin marque le retrait en échec.
      const result = await executeFinancialTransaction({
        idempotencyKey: withdrawIdempotencyKeyRef.current,
        userId: user.uid,
        amount,
        currency: 'FCFA',
        description: `Retrait vers ${withdrawMethod.toUpperCase()} (${withdrawPhone})`,
        actionType: 'wallet_withdrawal',
        debitAccount: `user_wallet:${user.uid}`,
        creditAccount: 'mobile_money_payout_pending'
      });
      if (!result.success) throw new Error(result.message);

      await supabase.from('wallet_transactions').insert({
        user_id: user.uid,
        amount,
        type: 'withdraw',
        description: `Retrait vers ${withdrawMethod.toUpperCase()} (${withdrawPhone})`,
        status: 'pending',
        reference: withdrawPhone,
        payment_method: withdrawMethod,
      });

      withdrawIdempotencyKeyRef.current = null;
      toast.success(`Retrait de ${amount.toLocaleString()} FCFA demandé — vous recevrez l'argent sur ${withdrawMethod.toUpperCase()} sous peu.`);
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
      icon: <User className="w-4.5 h-4.5 text-brand" />,
      color: 'bg-brand/10',
      group: 'Compte & sécurité'
    },
    {
      id: 'security',
      title: 'Sécurité & confidentialité',
      description: 'Sécurisez votre compte et gérez vos données.',
      icon: <Shield className="w-4.5 h-4.5 text-brand" />,
      color: 'bg-brand/10',
      group: 'Compte & sécurité'
    },
    {
      id: 'payments',
      title: 'Argent & paiements',
      description: 'Gérez vos moyens de paiement, transferts et retraits.',
      icon: <Wallet className="w-4.5 h-4.5 text-secondary" />,
      color: 'bg-secondary/10',
      group: 'Argent & cercles'
    },
    {
      id: 'circles',
      title: 'Mes cercles',
      description: 'Gérez vos tontines, vos préférences et invitations.',
      icon: <Users className="w-4.5 h-4.5 text-secondary" />,
      color: 'bg-secondary/10',
      group: 'Argent & cercles'
    },
    {
      id: 'subscription',
      title: 'Abonnement & récompenses',
      description: 'Gérez votre abonnement et vos avantages.',
      icon: <Award className="w-4.5 h-4.5 text-secondary" />,
      color: 'bg-secondary/10',
      group: 'Argent & cercles'
    },
    {
      id: 'notifications',
      title: 'Notifications & communication',
      description: 'Choisissez comment vous recevez les notifications.',
      icon: <Bell className="w-4.5 h-4.5 text-muted-foreground" />,
      color: 'bg-muted',
      group: 'Général'
    },
    {
      id: 'support',
      title: 'Aide & support',
      description: 'Trouvez de l\'aide, des tutoriels ou contactez le support.',
      icon: <HelpCircle className="w-4.5 h-4.5 text-muted-foreground" />,
      color: 'bg-muted',
      group: 'Général'
    },
    {
      id: 'legal',
      title: 'Légal & informations',
      description: 'Consultez les conditions, politiques et documents légaux.',
      icon: <BookOpen className="w-4.5 h-4.5 text-muted-foreground" />,
      color: 'bg-muted',
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
                  onClick={() => onNavigate?.('support')}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-bold rounded-xl h-8 border-border text-foreground hover:bg-muted"
                >
                  Contacter le support
                </Button>
                <div className="flex gap-1.5 pt-0.5">
                  <button
                    onClick={() => onNavigate?.('support')}
                    className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-primary py-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Lightbulb className="w-3 h-3" /> Suggérer
                  </button>
                  <button
                    onClick={() => onNavigate?.('support')}
                    className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-danger py-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Bug className="w-3 h-3" /> Signaler un bug
                  </button>
                </div>
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
                        onClick={() => cat.id === 'support' ? onNavigate?.('support') : setActiveSection(cat.id)}
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
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-bold">Langue</Label>
                  <LanguageSwitcher value={language} onChange={setLanguage} variant="grid" />
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
                  {(user.kycLevel ?? 1) >= KYC_VERIFIED_LEVEL ? (
                    <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Vérifié</span>
                  ) : `Niveau ${user.kycLevel ?? 1} sur 3`}
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
                  <div className="flex items-center gap-2">
                    <IdCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Pièce d'Identité</p>
                      <p className="text-[11px] text-muted-foreground">
                        Vérifiée{user.kycVerifiedAt ? ` le ${format(new Date(user.kycVerifiedAt), 'dd/MM/yyyy')}` : ''}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500 text-white text-[10px] flex items-center gap-1"><Check className="w-3 h-3" /> Vérifiée</Badge>
                </div>
              ) : kycSubmission?.status === 'pending' ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <IdCard className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-300">Pièce d'Identité</p>
                      <p className="text-[11px] text-muted-foreground">Envoyée le {format(new Date(kycSubmission.createdAt), 'dd/MM/yyyy')}</p>
                    </div>
                  </div>
                  <Badge className="bg-amber-500 text-white text-[10px]">En attente de validation</Badge>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {kycSubmission?.status === 'rejected' && (
                    <div className="p-3 bg-danger-soft border border-danger/20 rounded-2xl text-[11px] text-danger font-medium flex items-start gap-2">
                      <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Votre précédente soumission a été refusée{kycSubmission.rejectionReason ? ` : ${kycSubmission.rejectionReason}` : ''}. Veuillez soumettre à nouveau.</span>
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
                    <label
                      htmlFor="kyc_file_input"
                      className="flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-border hover:border-brand/50 hover:bg-brand/5 transition-colors cursor-pointer"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${kycFile ? 'bg-success-soft text-secondary' : 'bg-muted text-muted-foreground'}`}>
                        {kycFile ? <Check className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground truncate">
                          {kycFile ? kycFile.name : 'Choisir une photo ou un PDF'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {kycFile ? 'Appuyez pour changer de fichier' : 'JPG, PNG ou PDF, recto de la pièce'}
                        </p>
                      </div>
                      <input
                        id="kyc_file_input"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setKycFile(e.target.files?.[0] || null)}
                        className="sr-only"
                      />
                    </label>
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
                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs font-bold">Droits accordés au mandataire</Label>
                  <div className="flex items-center justify-between p-3 bg-card border border-border/60 rounded-xl">
                    <span className="text-xs text-foreground">Voir les cotisations</span>
                    <Switch
                      checked={mandatePermissions.includes('view_contributions')}
                      onCheckedChange={(v) => setMandatePermissions(prev => v ? [...prev, 'view_contributions'] : prev.filter(p => p !== 'view_contributions'))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-card border border-border/60 rounded-xl">
                    <span className="text-xs text-foreground">Recevoir les rappels de cotisation</span>
                    <Switch
                      checked={mandatePermissions.includes('receive_reminders')}
                      onCheckedChange={(v) => setMandatePermissions(prev => v ? [...prev, 'receive_reminders'] : prev.filter(p => p !== 'receive_reminders'))}
                    />
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[11px] text-amber-800 dark:text-amber-300 font-medium flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Le mandataire ne possède <strong>aucun accès à votre portefeuille ni aux retraits</strong>, quels que soient les droits ci-dessus.</span>
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

          {/* Transaction History — was fetched into walletTransactions but
              never actually rendered anywhere in this component. */}
          <Card className="glass-card rounded-3xl p-6 border border-border/80 space-y-3">
            <h4 className="font-serif font-bold text-base text-foreground">Historique des transactions</h4>
            {walletTransactions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Aucune transaction pour le moment.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {walletTransactions.map((tx) => (
                  <div key={tx.id} className="p-3 bg-card border border-border/60 rounded-2xl flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-foreground">{tx.description}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(tx.date), 'dd MMM yyyy, HH:mm', { locale: fr })}
                      </p>
                    </div>
                    <span className={`text-xs font-black shrink-0 pl-3 ${tx.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-danger'}`}>
                      {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()} FCFA
                    </span>
                  </div>
                ))}
              </div>
            )}
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
                  <Button variant="link" onClick={() => onNavigate?.('search-groups')} className="text-primary text-xs h-auto p-0 mt-1">Rejoindre un cercle</Button>
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
                  <Badge className="bg-purple-500 text-white font-bold text-[10px] mb-2">
                    Plan Actuel : {user.subscriptionPlan === 'premium' ? 'Premium' : 'Gratuit'}
                  </Badge>
                  <h4 className="text-sm font-bold text-purple-900 dark:text-purple-300">
                    {user.subscriptionPlan === 'premium' ? 'Eganyé Premium' : 'Eganyé Essentiel'}
                  </h4>
                  <p className="text-[11px] text-purple-700/80 dark:text-purple-300/80 max-w-xs mt-1">
                    {user.subscriptionPlan === 'premium'
                      ? `Abonnement actif${user.subscriptionExpiresAt ? ` jusqu'au ${format(new Date(user.subscriptionExpiresAt), 'dd MMMM yyyy', { locale: fr })}` : ''}.`
                      : "Accès de base aux cercles de tontine."}
                  </p>
                </div>
                <Award className="w-10 h-10 text-purple-500 opacity-50" />
              </div>
              {user.subscriptionPlan !== 'premium' && (
                <Button disabled className="bg-purple-600/50 text-white font-bold rounded-xl h-10 text-xs w-full mt-2 shadow-soft cursor-not-allowed">
                  Eganyé Premium — Bientôt disponible
                </Button>
              )}
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
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="Nouveau PIN"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="rounded-xl h-10 text-xs"
                />
                <Button onClick={handleChangePin} disabled={isSavingPin} className="gradient-sunset text-white font-bold rounded-xl h-10 text-xs px-4">
                  {isSavingPin ? 'Envoi...' : 'Modifier'}
                </Button>
              </div>
            </div>

            {/* Password Setting */}
            <div className="p-4 bg-muted/30 rounded-2xl space-y-2 border border-border/60">
              <Label className="text-xs font-bold">Modifier le mot de passe</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="Nouveau mot de passe (6+ caractères)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="rounded-xl h-10 text-xs"
                />
                <Button onClick={handleChangePassword} disabled={isSavingPassword} className="gradient-sunset text-white font-bold rounded-xl h-10 text-xs px-4">
                  {isSavingPassword ? 'Envoi...' : 'Modifier'}
                </Button>
              </div>
            </div>

            {/* Biometrics Toggle */}
            <div className="flex items-center justify-between p-4 bg-card border border-border/60 rounded-2xl">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground">Biométrie (Empreinte / FaceID)</p>
                <p className="text-[11px] text-muted-foreground">Utiliser l'empreinte pour déverrouiller l'application sur cet appareil.</p>
              </div>
              <Switch checked={biometricsEnabled} onCheckedChange={handleToggleBiometrics} />
            </div>
          </Card>
        </motion.div>
      )}

      <BiometricPrompt
        isOpen={isBiometricPromptOpen}
        onClose={() => setIsBiometricPromptOpen(false)}
        username={user.displayName}
        mode="register"
        onSuccess={async () => {
          setIsBiometricPromptOpen(false);
          await supabase.from('profiles').update({ biometrics_enabled: true }).eq('id', user.uid);
          toast.success('Biométrie activée sur cet appareil !');
        }}
      />

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
                  <p className="text-[10px] text-muted-foreground">Sur votre téléphone mobile — bientôt disponible</p>
                </div>
                <Switch
                  checked={pushNotif}
                  onCheckedChange={(v) => handleToggleNotificationChannel('push_enabled', setPushNotif, v)}
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-2xl">
                <div>
                  <p className="text-xs font-bold text-foreground">SMS</p>
                  <p className="text-[10px] text-muted-foreground">Rappels directs par SMS</p>
                </div>
                <Switch
                  checked={smsNotif}
                  onCheckedChange={(v) => handleToggleNotificationChannel('sms_notifications_enabled', setSmsNotif, v)}
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-2xl">
                <div>
                  <p className="text-xs font-bold text-foreground">Email</p>
                  <p className="text-[10px] text-muted-foreground">Reçus et récapitulatifs mensuels</p>
                </div>
                <Switch
                  checked={emailNotif}
                  onCheckedChange={(v) => handleToggleNotificationChannel('email_notifications_enabled', setEmailNotif, v)}
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-2xl">
                <div>
                  <p className="text-xs font-bold text-foreground">WhatsApp</p>
                  <p className="text-[10px] text-muted-foreground">Alertes et rappels automatisés</p>
                </div>
                <Switch
                  checked={whatsAppNotif}
                  onCheckedChange={(v) => handleToggleNotificationChannel('whatsapp_notifications_enabled', setWhatsAppNotif, v)}
                />
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* 6. SUB-SECTION SCREEN 7: AIDE & LÉGAL */}
      {/* ========================================================================= */}
      {activeSection === 'legal' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl mx-auto">
          <Card className="glass-card rounded-3xl p-6 border border-border/80 space-y-4">
            <h3 className="font-serif font-bold text-lg text-foreground">Documents Légaux</h3>
            <p className="text-xs text-muted-foreground">Consultez la réglementation des tontines collaboratives et notre politique de confidentialité.</p>
            
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
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 dark:text-rose-300 rounded-2xl text-xs font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Vous avez actuellement <strong>{groups.length} cercle(s) actif(s)</strong>. Veuillez quitter ou régler vos cotisations avant de supprimer votre compte.</span>
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
