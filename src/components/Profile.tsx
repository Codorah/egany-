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
import { ConfirmationBottomSheet } from '@/components/ui/ConfirmationBottomSheet';
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
  CheckCircle2,
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
import { PAYDUNYA_COUNTRIES, getOperatorsForCountry, findOperatorLabel } from '@/lib/paydunyaMethods';
import { CustomAvatar, AvatarConfig } from './CustomAvatar';
import { AvatarWorkshop } from './AvatarWorkshop';
import { LanguageSwitcher } from './ui/LanguageSwitcher';
import { BiometricPrompt } from './BiometricPrompt';
import { useBiometrics } from '@/hooks/useBiometrics';

// Boutons-puces (nom complet toujours visible, pas de liste déroulante) pour
// choisir un pays ou un opérateur avant une recharge/un retrait.
function ChipPicker({
  options, value, onChange, ariaLabel,
}: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; ariaLabel: string }) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3.5 h-9 rounded-full text-xs font-bold border transition-colors ${
            value === opt.value
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card text-foreground border-border hover:bg-muted'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

interface ProfileProps {
  user: UserProfile;
  groups: Group[];
  defaultTab?: string;
  focusCard?: 'recharge' | 'withdraw';
  onLogout?: () => void;
  onNavigate?: (view: string) => void;
}

export function Profile({ user, groups, defaultTab, focusCard, onLogout, onNavigate }: ProfileProps) {
  const { t, language, setLanguage } = useLanguage();
  
  // Navigation state: null = Root settings, string = active sub-category screen.
  // `defaultTab` est la cible envoyée par les autres écrans. 'kyc' est un
  // sous-onglet de la section « compte » : le blocage à la création de cercle
  // l'utilise pour déposer l'utilisatrice directement sur la vérification.
  const PROFILE_SECTION_IDS = ['account', 'security', 'payments', 'circles', 'subscription', 'notifications', 'legal'];
  const [activeSection, setActiveSection] = useState<string | null>(() => {
    if (defaultTab === 'wallet') return 'payments';
    if (defaultTab === 'kyc') return 'account';
    return defaultTab && PROFILE_SECTION_IDS.includes(defaultTab) ? defaultTab : null;
  });
  const [activeSubTab, setActiveSubTab] = useState<string>(defaultTab === 'kyc' ? 'kyc' : 'personal_info');

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

  // Le bouton "Recharger" du Dashboard doit ouvrir la carte Recharger, et
  // "Retirer" sa propre carte — les deux ne s'affichent jamais ensemble.
  // `focusCard` (venant de App.tsx) fixe laquelle est active à l'arrivée ;
  // le sélecteur ci-dessous permet ensuite de basculer sans revenir en arrière.
  const [walletAction, setWalletAction] = useState<'recharge' | 'withdraw'>(focusCard || 'recharge');
  useEffect(() => {
    if (focusCard) setWalletAction(focusCard);
  }, [focusCard]);

  const [rechargeAmount, setRechargeAmount] = useState('');
  const [isRecharging, setIsRecharging] = useState(false);
  const [rechargeCountry, setRechargeCountry] = useState('tg');
  const [rechargeMethod, setRechargeMethod] = useState('tmoney_tg');
  useEffect(() => {
    const options = getOperatorsForCountry(rechargeCountry);
    if (!options.some((op) => op.value === rechargeMethod)) {
      setRechargeMethod(options[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rechargeCountry]);
  const [rechargePhone, setRechargePhone] = useState(user.phone || '');

  // Recharge « directe » (SoftPay) : l'opérateur a envoyé une notification
  // USSD/PIN sur le téléphone, on reste sur eganyé et on interroge Paydunya
  // jusqu'à confirmation — le crédit réel reste exclusivement du ressort du
  // webhook (voir api/paydunya-invoice-status.ts, lecture seule).
  const [rechargePending, setRechargePending] = useState<{ invoiceToken: string; amount: number } | null>(null);
  const [rechargeStatus, setRechargeStatus] = useState<'pending' | 'completed' | 'failed'>('pending');
  useEffect(() => {
    if (!rechargePending) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40; // ~2 min à 3s d'intervalle
    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const res = await fetch(apiUrl(`/api/paydunya-invoice-status?token=${encodeURIComponent(rechargePending.invoiceToken)}`));
        const data = await res.json().catch(() => null);
        if (data?.status === 'completed') {
          if (!cancelled) setRechargeStatus('completed');
          return;
        }
      } catch {
        // Requête réseau ratée : on retente au prochain tour plutôt que
        // d'abandonner sur un simple accroc de connexion.
      }
      if (cancelled) return;
      if (attempts >= maxAttempts) {
        setRechargeStatus('failed');
        return;
      }
      setTimeout(poll, 3000);
    };
    poll();
    return () => { cancelled = true; };
  }, [rechargePending]);

  // Withdrawal states
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const withdrawIdempotencyKeyRef = React.useRef<string | null>(null);
  useEffect(() => { withdrawIdempotencyKeyRef.current = null; }, [withdrawAmount]);
  const [withdrawCountry, setWithdrawCountry] = useState('tg');
  const [withdrawMethod, setWithdrawMethod] = useState('tmoney_tg');
  useEffect(() => {
    const operators = getOperatorsForCountry(withdrawCountry);
    if (operators.length > 0 && !operators.some((op) => op.value === withdrawMethod)) {
      setWithdrawMethod(operators[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withdrawCountry]);
  const [withdrawPhone, setWithdrawPhone] = useState(user.phone || '');
  const [withdrawPin, setWithdrawPin] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

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
      toast.error(t('prof_enter_full_name'));
      return;
    }
    if (!kycFile) {
      toast.error(t('prof_select_id_photo'));
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
      toast.error(err.message || t('prof_kyc_send_error'));
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
      toast.success(t('prof_mandate_saved'));
    } catch (err: any) {
      toast.error(t('prof_mandate_save_error'));
    } finally {
      setIsSavingMandate(false);
    }
  };

  const handleChangePin = async () => {
    if (!/^\d{4}$/.test(newPin)) {
      toast.error(t('prof_pin_exactly_4'));
      return;
    }
    setIsSavingPin(true);
    try {
      const result = await setUserPin(user.uid, newPin);
      if (!result.success) throw new Error(result.message);
      toast.success(result.message);
      setNewPin('');
    } catch (err: any) {
      toast.error(err.message || t('prof_pin_update_error'));
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error(t('prof_pw_min_6'));
      return;
    }
    setIsSavingPassword(true);
    try {
      const { error } = await changePassword(newPassword);
      if (error) throw error;
      toast.success(t('prof_pw_updated'));
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message || t('prof_pw_update_error'));
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
      toast.error(t('prof_pref_save_error'));
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
      toast.success(t('prof_personal_info_saved'));
    } catch (err: any) {
      toast.error(t('prof_save_error_generic'));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRecharge = async () => {
    if (!navigator.onLine) {
      toast.error(t('prof_offline_recharge'));
      return;
    }
    const amount = parseFloat(rechargeAmount);
    if (!amount || amount < 200) {
      toast.error(t('prof_min_100'));
      return;
    }
    if (rechargePhone.replace(/\D/g, '').length < 8) {
      toast.error(t('prof_enter_recharge_phone'));
      return;
    }
    setIsRecharging(true);
    try {
      // Le portefeuille n'est crédité qu'après un vrai paiement Paydunya
      // confirmé (App.tsx gère le retour ?paydunya_success=true) — on ne
      // crédite jamais directement ici. Le pays/opérateur/téléphone ne sont
      // que des indications transmises pour le suivi (custom_data) et le
      // mode simulation locale : Paydunya reste seul maître du choix réel
      // du canal de paiement sur sa page hébergée.
      const response = await fetch(apiUrl('/api/create-paydunya-checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          userId: user.uid,
          userName: user.displayName,
          userEmail: user.email,
          phone: rechargePhone,
          paymentMethod: rechargeMethod,
        }),
      });

      // Une réponse en échec (404 en dev où Vite ne sert pas /api/*, ou page
      // d'erreur d'une passerelle) renvoie du HTML : le parser en JSON lèverait
      // « Unexpected token '<' », qui finissait affiché tel quel à l'écran.
      if (!response.ok) {
        throw new Error(`Paydunya checkout HTTP ${response.status}`);
      }
      const data = await response.json().catch(() => null);

      if (data?.mode === 'direct' && data?.invoiceToken) {
        // Paydunya a envoyé une notification USSD/PIN directement sur le
        // téléphone : on reste sur eganyé et on attend la confirmation.
        setRechargeStatus('pending');
        setRechargePending({ invoiceToken: data.invoiceToken, amount });
        return;
      }

      if (!data?.url) {
        throw new Error(data?.error || 'Paydunya checkout: réponse sans URL');
      }

      window.location.href = data.url;
    } catch (err: any) {
      console.error('Paydunya checkout error:', err);
      toast.error(t('prof_paydunya_start_error'));
    } finally {
      setIsRecharging(false);
    }
  };

  const handleWithdrawReview = () => {
    if (!navigator.onLine) {
      toast.error(t('prof_offline_withdraw'));
      return;
    }
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      toast.error(t('prof_invalid_withdraw_amount'));
      return;
    }
    if (amount > (user.walletBalance || 0)) {
      toast.error(t('prof_insufficient_balance'));
      return;
    }
    if (!withdrawMethod) {
      toast.error(t('prof_enter_withdraw_operator'));
      return;
    }
    if (withdrawPhone.replace(/\D/g, '').length < 8) {
      toast.error(t('prof_enter_valid_phone'));
      return;
    }
    if (!withdrawPin) {
      toast.error(t('prof_enter_withdraw_pin'));
      return;
    }
    setShowWithdrawConfirm(true);
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    const withdrawMethodLabel = findOperatorLabel(withdrawMethod);
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
        description: `Retrait vers ${withdrawMethodLabel} (${withdrawPhone})`,
        actionType: 'wallet_withdrawal',
        debitAccount: `user_wallet:${user.uid}`,
        creditAccount: 'mobile_money_payout_pending'
      });
      if (!result.success) throw new Error(result.message);

      await supabase.from('wallet_transactions').insert({
        user_id: user.uid,
        amount,
        type: 'withdraw',
        description: `Retrait vers ${withdrawMethodLabel} (${withdrawPhone})`,
        status: 'pending',
        reference: withdrawPhone,
        payment_method: withdrawMethod,
      });

      withdrawIdempotencyKeyRef.current = null;
      toast.success(`${t('prof_withdraw_requested_prefix')} ${amount.toLocaleString()} FCFA ${t('prof_withdraw_requested_mid')} ${withdrawMethodLabel} ${t('prof_withdraw_requested_suffix')}`);
      setWithdrawAmount('');
      setWithdrawPin('');
      setShowWithdrawConfirm(false);
    } catch (err: any) {
      console.error('Withdrawal error:', err);
      toast.error(t('prof_withdraw_error'));
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Main Categories array matching exact mockup design
  const mainCategories = [
    {
      id: 'account',
      title: t('prof_cat_account_title'),
      description: t('prof_cat_account_desc'),
      icon: <User className="w-4.5 h-4.5 text-brand" />,
      color: 'bg-brand/10',
      group: t('prof_group_account_security')
    },
    {
      id: 'security',
      title: t('prof_cat_security_title'),
      description: t('prof_cat_security_desc'),
      icon: <Shield className="w-4.5 h-4.5 text-brand" />,
      color: 'bg-brand/10',
      group: t('prof_group_account_security')
    },
    {
      id: 'payments',
      title: t('prof_cat_payments_title'),
      description: t('prof_cat_payments_desc'),
      icon: <Wallet className="w-4.5 h-4.5 text-secondary" />,
      color: 'bg-secondary/10',
      group: t('prof_group_money_circles')
    },
    {
      id: 'circles',
      title: t('prof_cat_circles_title'),
      description: t('prof_cat_circles_desc'),
      icon: <Users className="w-4.5 h-4.5 text-secondary" />,
      color: 'bg-secondary/10',
      group: t('prof_group_money_circles')
    },
    {
      id: 'subscription',
      title: t('prof_cat_subscription_title'),
      description: t('prof_cat_subscription_desc'),
      icon: <Award className="w-4.5 h-4.5 text-secondary" />,
      color: 'bg-secondary/10',
      group: t('prof_group_money_circles')
    },
    {
      id: 'notifications',
      title: t('prof_cat_notifications_title'),
      description: t('prof_cat_notifications_desc'),
      icon: <Bell className="w-4.5 h-4.5 text-muted-foreground" />,
      color: 'bg-muted',
      group: t('prof_group_general')
    },
    {
      id: 'support',
      title: t('prof_cat_support_title'),
      description: t('prof_cat_support_desc'),
      icon: <HelpCircle className="w-4.5 h-4.5 text-muted-foreground" />,
      color: 'bg-muted',
      group: t('prof_group_general')
    },
    {
      id: 'legal',
      title: t('prof_cat_legal_title'),
      description: t('prof_cat_legal_desc'),
      icon: <BookOpen className="w-4.5 h-4.5 text-muted-foreground" />,
      color: 'bg-muted',
      group: t('prof_group_general')
    }
  ];

  const categoryGroups = [t('prof_group_account_security'), t('prof_group_money_circles'), t('prof_group_general')].map((groupName) => ({
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
            <span>{t('prof_back_to_settings')}</span>
          </Button>
          <span className="text-xs font-serif font-black text-primary uppercase tracking-wider">
            {mainCategories.find(c => c.id === activeSection)?.title || t('settings')}
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
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[13px] font-bold">
                        {t('prof_account_verified')}
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[13px] font-bold">
                        {t('prof_identity_not_verified')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">{user.phone || t('prof_phone_not_provided')}</p>
                  <p className="text-xs text-muted-foreground font-medium">{user.email}</p>
                </div>
              </div>

              {/* User Balance & Reputation */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-muted/40 p-3 rounded-2xl border border-border/60 text-center space-y-0.5">
                  <span className="text-[13px] font-bold text-muted-foreground uppercase">{t('available_balance')}</span>
                  <p className="text-sm font-black text-primary">
                    {(user.walletBalance || 0).toLocaleString()} FCFA
                  </p>
                </div>
                <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 text-center space-y-0.5">
                  <span className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">{t('reliability_score')}</span>
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {user.reputationScore} / 100
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-border/60 text-xs text-muted-foreground flex justify-between items-center">
                <span>{t('prof_member_since')}</span>
                <span className="font-bold text-foreground">
                  {user.createdAt ? format(new Date(user.createdAt), 'dd MMMM yyyy', { locale: fr }) : '—'}
                </span>
              </div>

              {/* Support Card in Sidebar */}
              <div className="p-4 bg-muted/40 rounded-2xl border border-border/60 space-y-2">
                <div className="flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">{t('prof_need_help')}</span>
                </div>
                <p className="text-[13px] text-muted-foreground">{t('prof_support_desc_sidebar')}</p>
                <Button
                  onClick={() => onNavigate?.('support')}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-bold rounded-xl h-8 border-border text-foreground hover:bg-muted"
                >
                  {t('prof_contact_support')}
                </Button>
                <div className="flex gap-1.5 pt-0.5">
                  <button
                    onClick={() => onNavigate?.('support')}
                    className="flex-1 flex items-center justify-center gap-1 text-[13px] font-bold text-muted-foreground hover:text-primary py-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Lightbulb className="w-3 h-3" /> {t('prof_suggest')}
                  </button>
                  <button
                    onClick={() => onNavigate?.('support')}
                    className="flex-1 flex items-center justify-center gap-1 text-[13px] font-bold text-muted-foreground hover:text-danger py-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Bug className="w-3 h-3" /> {t('prof_report_bug')}
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
                  <h3 className="text-[13px] font-black uppercase tracking-wider text-muted-foreground px-1">
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
                <span className="flex-1 font-bold text-sm text-rose-600 dark:text-rose-400">{t('prof_delete_account')}</span>
                <ChevronRight className="w-4 h-4 text-rose-400 shrink-0" />
              </button>

              {/* Full-width Logout Button */}
              <Button
                onClick={() => onLogout?.()}
                variant="outline"
                className="w-full h-12 rounded-2xl border-border text-foreground font-bold hover:bg-muted flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <LogOut className="w-4 h-4 text-muted-foreground" />
                <span>{t('logout')}</span>
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
              {t('prof_tab_personal_info')}
            </button>
            <button
              onClick={() => setActiveSubTab('kyc')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeSubTab === 'kyc' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {t('prof_tab_kyc')}
            </button>
            <button
              onClick={() => setActiveSubTab('mandate')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeSubTab === 'mandate' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {t('prof_tab_mandate')}
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
                  <Label className="text-xs font-bold">{t('prof_first_name')}</Label>
                  <Input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">{t('prof_last_name_label')}</Label>
                  <Input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">{t('prof_username_nickname')}</Label>
                  <Input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">{t('prof_email_address_label')}</Label>
                  <Input value={user.email} disabled className="rounded-xl h-11 bg-muted/50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">{t('prof_phone_label')}</Label>
                  <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">{t('prof_date_of_birth')}</Label>
                  <Input type="date" value={editDateOfBirth} onChange={(e) => setEditDateOfBirth(e.target.value)} className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-bold">{t('prof_language_label')}</Label>
                  <LanguageSwitcher value={language} onChange={setLanguage} variant="grid" />
                </div>
              </div>
              <Button onClick={handleSaveProfile} disabled={savingSettings} className="gradient-sunset text-white font-bold rounded-2xl h-12 w-full">
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : t('save')}
              </Button>
            </Card>
          )}

          {/* Sub-Tab 2: Verification identity KYC */}
          {activeSubTab === 'kyc' && (
            <Card className="glass-card rounded-3xl p-6 border border-border/80 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-serif font-bold text-lg text-foreground">{t('prof_kyc_title')}</h3>
                <Badge className={`font-bold text-xs border ${
                  (user.kycLevel ?? 1) >= KYC_VERIFIED_LEVEL
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                }`}>
                  {(user.kycLevel ?? 1) >= KYC_VERIFIED_LEVEL ? (
                    <span className="flex items-center gap-1"><Check className="w-3 h-3" /> {t('prof_verified_badge')}</span>
                  ) : `${t('prof_kyc_level_prefix')} ${user.kycLevel ?? 1} ${t('prof_kyc_level_suffix')}`}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('prof_kyc_desc')}
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
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{t('prof_id_document_label')}</p>
                      <p className="text-[13px] text-muted-foreground">
                        {user.kycVerifiedAt ? `${t('prof_verified_on')} ${format(new Date(user.kycVerifiedAt), 'dd/MM/yyyy')}` : t('prof_verified_word')}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500 text-white text-[13px] flex items-center gap-1"><Check className="w-3 h-3" /> {t('prof_verified_word')}</Badge>
                </div>
              ) : kycSubmission?.status === 'pending' ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <IdCard className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-300">{t('prof_id_document_label')}</p>
                      <p className="text-[13px] text-muted-foreground">{t('prof_sent_on')} {format(new Date(kycSubmission.createdAt), 'dd/MM/yyyy')}</p>
                    </div>
                  </div>
                  <Badge className="bg-amber-500 text-white text-[13px]">{t('prof_pending_validation')}</Badge>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {kycSubmission?.status === 'rejected' && (
                    <div className="p-3 bg-danger-soft border border-danger/20 rounded-2xl text-[13px] text-danger font-medium flex items-start gap-2">
                      <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{t('prof_kyc_rejected_prefix')}{kycSubmission.rejectionReason ? ` : ${kycSubmission.rejectionReason}` : ''}. {t('prof_kyc_resubmit')}</span>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">{t('prof_kyc_full_name_label')}</Label>
                    <Input value={kycFullName} onChange={(e) => setKycFullName(e.target.value)} className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">{t('prof_kyc_id_number_label')}</Label>
                    <Input value={kycIdNumber} onChange={(e) => setKycIdNumber(e.target.value)} className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">{t('prof_kyc_photo_label')}</Label>
                    <label
                      htmlFor="kyc_file_input"
                      className="flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-border hover:border-brand/50 hover:bg-brand/5 transition-colors cursor-pointer"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${kycFile ? 'bg-success-soft text-secondary' : 'bg-muted text-muted-foreground'}`}>
                        {kycFile ? <Check className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground truncate">
                          {kycFile ? kycFile.name : t('prof_choose_photo_pdf')}
                        </p>
                        <p className="text-[13px] text-muted-foreground">
                          {kycFile ? t('prof_tap_change_file') : t('prof_file_format_hint')}
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
                    {isSubmittingKyc ? <Loader2 className="w-4 h-4 animate-spin" /> : t('prof_submit_for_verification')}
                  </Button>
                </div>
              )}
            </Card>
          )}

          {/* Sub-Tab 3: Mandataire numérique */}
          {activeSubTab === 'mandate' && (
            <Card className="glass-card rounded-3xl p-6 border border-border/80 space-y-4">
              <h3 className="font-serif font-bold text-lg text-foreground">{t('prof_mandate_title')}</h3>
              <p className="text-xs text-muted-foreground">{t('prof_mandate_desc')}</p>

              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">{t('prof_mandate_name_label')}</Label>
                  <Input value={mandateName} onChange={(e) => setMandateName(e.target.value)} className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">{t('prof_phone_number_label')}</Label>
                  <Input value={mandatePhone} onChange={(e) => setMandatePhone(e.target.value)} className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs font-bold">{t('prof_mandate_rights_label')}</Label>
                  <div className="flex items-center justify-between p-3 bg-card border border-border/60 rounded-xl">
                    <span className="text-xs text-foreground">{t('prof_view_contributions_perm')}</span>
                    <Switch
                      checked={mandatePermissions.includes('view_contributions')}
                      onCheckedChange={(v) => setMandatePermissions(prev => v ? [...prev, 'view_contributions'] : prev.filter(p => p !== 'view_contributions'))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-card border border-border/60 rounded-xl">
                    <span className="text-xs text-foreground">{t('prof_receive_reminders_perm')}</span>
                    <Switch
                      checked={mandatePermissions.includes('receive_reminders')}
                      onCheckedChange={(v) => setMandatePermissions(prev => v ? [...prev, 'receive_reminders'] : prev.filter(p => p !== 'receive_reminders'))}
                    />
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[13px] text-amber-800 dark:text-amber-300 font-medium flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{t('prof_mandate_warning_prefix')} <strong>{t('prof_mandate_warning_bold')}</strong>{t('prof_mandate_warning_suffix')}</span>
                </div>
              </div>

              <Button onClick={handleSaveMandate} disabled={isSavingMandate} className="gradient-sunset text-white font-bold rounded-2xl h-12 w-full mt-2">
                {isSavingMandate ? <Loader2 className="w-4 h-4 animate-spin" /> : t('prof_save_mandate')}
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
              <span className="text-xs font-bold uppercase tracking-wider text-amber-200">{t('prof_wallet_payments_header')}</span>
              <button onClick={() => setShowBalance(!showBalance)} className="text-white/80 hover:text-white">
                {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-serif font-black">
                {showBalance ? `${(user.walletBalance || 0).toLocaleString()} FCFA` : '•••••••• FCFA'}
              </p>
              <span className="text-xs text-white/80">{t('prof_balance_available_now')}</span>
            </div>
          </Card>

          {/* Recharger et Retirer sont deux cartes distinctes : une seule est
              affichée à la fois, choisie par le bouton du Dashboard qui a
              amené ici (ou par ce sélecteur si on change d'avis sur place). */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-2xl">
            <button
              type="button"
              onClick={() => setWalletAction('recharge')}
              className={`h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                walletAction === 'recharge' ? 'bg-card shadow-xs text-emerald-600' : 'text-muted-foreground'
              }`}
            >
              <Plus className="w-4 h-4" /> {t('recharge')}
            </button>
            <button
              type="button"
              onClick={() => setWalletAction('withdraw')}
              className={`h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                walletAction === 'withdraw' ? 'bg-card shadow-xs text-primary' : 'text-muted-foreground'
              }`}
            >
              <ArrowDownCircle className="w-4 h-4" /> {t('withdraw')}
            </button>
          </div>

          {walletAction === 'recharge' ? (
            rechargePending ? (
              <Card className="glass-card rounded-3xl p-8 border border-border/80 space-y-4 text-center">
                {rechargeStatus === 'pending' && (
                  <>
                    <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
                    <div className="space-y-1">
                      <h4 className="font-serif font-bold text-sm text-foreground">{t('recharge_pending_title')}</h4>
                      <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                        {t('recharge_pending_desc_prefix')} {rechargePending.amount.toLocaleString()} FCFA {t('recharge_pending_desc_suffix')}
                      </p>
                    </div>
                    <Button variant="ghost" className="text-xs" onClick={() => setRechargePending(null)}>
                      {t('recharge_pending_cancel')}
                    </Button>
                  </>
                )}
                {rechargeStatus === 'completed' && (
                  <>
                    <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
                    <h4 className="font-serif font-bold text-sm text-foreground">{t('recharge_success_title')}</h4>
                    <Button
                      className="gradient-sunset text-white font-bold rounded-xl h-10 w-full text-xs"
                      onClick={() => { setRechargePending(null); setRechargeAmount(''); }}
                    >
                      {t('recharge_pending_close')}
                    </Button>
                  </>
                )}
                {rechargeStatus === 'failed' && (
                  <>
                    <XCircle className="w-10 h-10 mx-auto text-danger" />
                    <h4 className="font-serif font-bold text-sm text-foreground">{t('recharge_failed_title')}</h4>
                    <Button
                      variant="outline"
                      className="border-primary text-primary font-bold rounded-xl h-10 w-full text-xs"
                      onClick={() => setRechargePending(null)}
                    >
                      {t('recharge_pending_close')}
                    </Button>
                  </>
                )}
              </Card>
            ) : (
            <Card className="glass-card rounded-3xl p-5 border border-border/80 space-y-3">
              <h4 className="font-serif font-bold text-sm text-foreground flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-500" /> {t('recharge_wallet_title')}
              </h4>
              <Input
                type="number"
                placeholder={t('prof_amount_fcfa_placeholder')}
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(e.target.value)}
                className="rounded-xl h-11 text-xs"
              />
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('pay_country_label')}</Label>
                <ChipPicker
                  ariaLabel={t('pay_country_label')}
                  value={rechargeCountry}
                  onChange={setRechargeCountry}
                  options={PAYDUNYA_COUNTRIES.map((c) => ({ value: c.code, label: `${c.flag} ${c.label}` }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('pay_operator_label')}</Label>
                <ChipPicker
                  ariaLabel={t('pay_operator_label')}
                  value={rechargeMethod}
                  onChange={setRechargeMethod}
                  options={getOperatorsForCountry(rechargeCountry)}
                />
              </div>
              <Input
                type="tel"
                placeholder={t('prof_withdraw_phone_placeholder')}
                value={rechargePhone}
                onChange={(e) => setRechargePhone(e.target.value)}
                className="rounded-xl h-11 text-xs"
              />
              <Button onClick={handleRecharge} disabled={isRecharging} className="gradient-sunset text-white font-bold rounded-xl h-10 w-full text-xs">
                {isRecharging ? <Loader2 className="w-4 h-4 animate-spin" /> : t('prof_recharge_via_mobile_money')}
              </Button>
            </Card>
            )
          ) : (
            <Card className="glass-card rounded-3xl p-5 border border-border/80 space-y-3">
              <h4 className="font-serif font-bold text-sm text-foreground flex items-center gap-1.5">
                <ArrowDownCircle className="w-4 h-4 text-primary" /> {t('prof_withdraw_funds')}
              </h4>
              <Input
                type="number"
                placeholder={t('prof_amount_fcfa_simple_placeholder')}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="rounded-xl h-11 text-xs"
              />
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('pay_country_label')}</Label>
                <ChipPicker
                  ariaLabel={t('pay_country_label')}
                  value={withdrawCountry}
                  onChange={setWithdrawCountry}
                  options={PAYDUNYA_COUNTRIES.map((c) => ({ value: c.code, label: `${c.flag} ${c.label}` }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('prof_withdraw_operator_label')}</Label>
                <ChipPicker
                  ariaLabel={t('prof_withdraw_operator_label')}
                  value={withdrawMethod}
                  onChange={setWithdrawMethod}
                  options={getOperatorsForCountry(withdrawCountry)}
                />
              </div>
              <Input
                type="tel"
                placeholder={t('prof_withdraw_phone_placeholder')}
                value={withdrawPhone}
                onChange={(e) => setWithdrawPhone(e.target.value)}
                className="rounded-xl h-11 text-xs"
              />
              <Input
                type="password"
                placeholder={t('prof_pin_4digits_placeholder')}
                maxLength={4}
                value={withdrawPin}
                onChange={(e) => setWithdrawPin(e.target.value)}
                className="rounded-xl h-11 text-xs"
              />
              <Button onClick={handleWithdrawReview} disabled={isWithdrawing} variant="outline" className="border-primary text-primary font-bold rounded-xl h-10 w-full text-xs">
                {isWithdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : t('prof_confirm_withdraw')}
              </Button>
            </Card>
          )}

          {/* Transaction History — was fetched into walletTransactions but
              never actually rendered anywhere in this component. */}
          <Card className="glass-card rounded-3xl p-6 border border-border/80 space-y-3">
            <h4 className="font-serif font-bold text-base text-foreground">{t('prof_transaction_history')}</h4>
            {walletTransactions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t('prof_no_transaction_now')}</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {walletTransactions.map((tx) => (
                  <div key={tx.id} className="p-3 bg-card border border-border/60 rounded-2xl flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-foreground">{tx.description}</p>
                      <p className="text-[13px] text-muted-foreground">
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
              <h3 className="font-serif font-bold text-lg text-foreground">{t('prof_my_tontine_circles')}</h3>
              <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 font-bold text-xs">
                {groups?.length || 0} {t('prof_actif_suffix')}
              </Badge>
            </div>

            <div className="p-4 bg-card border border-border/60 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-foreground">{t('prof_participation_stats')}</h4>
              <div className="flex items-end gap-2 h-32 pt-4">
                {/* Empty Graphs (as requested by user: "mes cercles essaie de faire des graphes vides") */}
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex-1 flex flex-col justify-end gap-2 items-center group">
                    <div className="w-full bg-muted/60 rounded-t-sm h-[15%] group-hover:bg-primary/50 transition-all duration-300"></div>
                    <span className="text-[12px] text-muted-foreground font-medium uppercase">{t('prof_month_label')} {i+1}</span>
                  </div>
                ))}
              </div>
              <p className="text-[13px] text-muted-foreground text-center mt-2">{t('prof_insufficient_data_charts')}</p>
            </div>

            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">{t('prof_current_circles')}</h4>
              {!groups || groups.length === 0 ? (
                <div className="p-4 text-center bg-muted/30 rounded-2xl border border-border/60">
                  <p className="text-xs text-muted-foreground">{t('prof_no_circle_member')}</p>
                  <Button variant="link" onClick={() => onNavigate?.('search-groups')} className="text-primary text-xs h-auto p-0 mt-1">{t('join_group')}</Button>
                </div>
              ) : (
                groups.map((g: any) => (
                  <div key={g.id} className="p-3 bg-card border border-border/60 rounded-2xl flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-foreground">{g.name}</p>
                      <p className="text-[13px] text-muted-foreground">{g.contributionAmount.toLocaleString()} FCFA / {g.frequency}</p>
                    </div>
                    <Badge variant={g.status === 'active' ? 'default' : 'secondary'} className="text-[12px]">
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
            <h3 className="font-serif font-bold text-lg text-foreground">{t('prof_subscription_advantages')}</h3>

            <div className="p-5 bg-gradient-to-br from-purple-500/10 to-primary/5 border border-purple-500/20 rounded-2xl space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <Badge className="bg-purple-500 text-white font-bold text-[13px] mb-2">
                    {t('prof_current_plan_label')} {user.subscriptionPlan === 'premium' ? t('prof_plan_premium') : t('prof_plan_free')}
                  </Badge>
                  <h4 className="text-sm font-bold text-purple-900 dark:text-purple-300">
                    {user.subscriptionPlan === 'premium' ? t('prof_eganye_premium') : t('prof_eganye_essential')}
                  </h4>
                  <p className="text-[13px] text-purple-700/80 dark:text-purple-300/80 max-w-xs mt-1">
                    {user.subscriptionPlan === 'premium'
                      ? `${t('prof_subscription_active_prefix')}${user.subscriptionExpiresAt ? ` ${t('prof_subscription_active_until')} ${format(new Date(user.subscriptionExpiresAt), 'dd MMMM yyyy', { locale: fr })}` : ''}.`
                      : t('prof_basic_access_desc')}
                  </p>
                </div>
                <Award className="w-10 h-10 text-purple-500 opacity-50" />
              </div>
              {user.subscriptionPlan !== 'premium' && (
                <Button disabled className="bg-purple-600/50 text-white font-bold rounded-xl h-10 text-xs w-full mt-2 shadow-soft cursor-not-allowed">
                  {t('prof_premium_coming_soon')}
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
            <h3 className="font-serif font-bold text-lg text-foreground">{t('prof_security_privacy_title')}</h3>

            {/* PIN Code Setting */}
            <div className="p-4 bg-muted/30 rounded-2xl space-y-2 border border-border/60">
              <Label className="text-xs font-bold">{t('prof_edit_pin_label')}</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder={t('prof_new_pin_placeholder')}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="rounded-xl h-10 text-xs"
                />
                <Button onClick={handleChangePin} disabled={isSavingPin} className="gradient-sunset text-white font-bold rounded-xl h-10 text-xs px-4">
                  {isSavingPin ? t('sending_label') : t('edit_label')}
                </Button>
              </div>
            </div>

            {/* Password Setting */}
            <div className="p-4 bg-muted/30 rounded-2xl space-y-2 border border-border/60">
              <Label className="text-xs font-bold">{t('prof_edit_password_label')}</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder={t('prof_new_password_placeholder')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="rounded-xl h-10 text-xs"
                />
                <Button onClick={handleChangePassword} disabled={isSavingPassword} className="gradient-sunset text-white font-bold rounded-xl h-10 text-xs px-4">
                  {isSavingPassword ? t('sending_label') : t('edit_label')}
                </Button>
              </div>
            </div>

            {/* Biometrics Toggle */}
            <div className="flex items-center justify-between p-4 bg-card border border-border/60 rounded-2xl">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground">{t('prof_biometrics_label')}</p>
                <p className="text-[13px] text-muted-foreground">{t('prof_biometrics_desc')}</p>
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
          toast.success(t('prof_biometrics_enabled_toast'));
        }}
      />

      {/* ========================================================================= */}
      {/* 5. SUB-SECTION SCREEN 5: NOTIFICATIONS */}
      {/* ========================================================================= */}
      {activeSection === 'notifications' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl mx-auto">
          <Card className="glass-card rounded-3xl p-6 border border-border/80 space-y-4">
            <h3 className="font-serif font-bold text-lg text-foreground">{t('prof_notif_preferences_title')}</h3>
            <p className="text-xs text-muted-foreground">{t('prof_notif_preferences_desc')}</p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-2xl">
                <div>
                  <p className="text-xs font-bold text-foreground">{t('prof_push_notif')}</p>
                  <p className="text-[13px] text-muted-foreground">{t('prof_push_channel_desc')}</p>
                </div>
                <Switch
                  checked={pushNotif}
                  onCheckedChange={(v) => handleToggleNotificationChannel('push_enabled', setPushNotif, v)}
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-2xl">
                <div>
                  <p className="text-xs font-bold text-foreground">{t('sms_label')}</p>
                  <p className="text-[13px] text-muted-foreground">{t('prof_sms_channel_desc')}</p>
                </div>
                <Switch
                  checked={smsNotif}
                  onCheckedChange={(v) => handleToggleNotificationChannel('sms_notifications_enabled', setSmsNotif, v)}
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-2xl">
                <div>
                  <p className="text-xs font-bold text-foreground">{t('email_label')}</p>
                  <p className="text-[13px] text-muted-foreground">{t('prof_email_channel_desc')}</p>
                </div>
                <Switch
                  checked={emailNotif}
                  onCheckedChange={(v) => handleToggleNotificationChannel('email_notifications_enabled', setEmailNotif, v)}
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-2xl">
                <div>
                  <p className="text-xs font-bold text-foreground">{t('whatsapp_label')}</p>
                  <p className="text-[13px] text-muted-foreground">{t('prof_whatsapp_channel_desc')}</p>
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
            <h3 className="font-serif font-bold text-lg text-foreground">{t('prof_legal_documents_title')}</h3>
            <p className="text-xs text-muted-foreground">{t('prof_legal_documents_desc')}</p>

            <div className="space-y-2 pt-2 text-xs">
              <div className="p-3 bg-card border border-border/60 rounded-2xl flex justify-between items-center cursor-pointer hover:bg-muted/40" onClick={() => setLegalDoc('cgu')}>
                <span className="font-bold">{t('prof_cgu_label')}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="p-3 bg-card border border-border/60 rounded-2xl flex justify-between items-center cursor-pointer hover:bg-muted/40" onClick={() => setLegalDoc('reglement')}>
                <span className="font-bold">{t('prof_reglement_label')}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="p-3 bg-card border border-border/60 rounded-2xl flex justify-between items-center cursor-pointer hover:bg-muted/40" onClick={() => setLegalDoc('confidentialite')}>
                <span className="font-bold">{t('prof_confidentialite_label')}</span>
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
              <Trash2 className="w-5 h-5" /> {t('prof_delete_account_confirm_title')}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t('prof_delete_account_irreversible')}
            </DialogDescription>
          </DialogHeader>

          {groups.length > 0 ? (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 dark:text-rose-300 rounded-2xl text-xs font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{t('prof_delete_blocked_prefix')} <strong>{groups.length} {t('prof_delete_blocked_suffix')}</strong>. {t('prof_delete_blocked_desc')}</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-2">
              {t('prof_delete_account_confirm_desc')}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} className="rounded-xl text-xs">
              {t('cancel')}
            </Button>
            <Button
              disabled={groups.length > 0}
              onClick={() => {
                toast.success(t('prof_account_deleted_toast'));
                setShowDeleteConfirm(false);
                onLogout?.();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold"
            >
              {t('prof_delete_account')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WITHDRAWAL CONFIRMATION — recap of amount + operator + phone before
          the money actually moves (see UX audit: this used to submit instantly
          on click, with the destination number never shown). */}
      <ConfirmationBottomSheet
        isOpen={showWithdrawConfirm}
        onClose={() => setShowWithdrawConfirm(false)}
        onConfirm={handleWithdraw}
        isLoading={isWithdrawing}
        type="debit"
        title={t('prof_withdraw_confirm_title')}
        description={`${t('prof_withdraw_confirm_desc')} ${findOperatorLabel(withdrawMethod)} — ${withdrawPhone}`}
        amount={parseFloat(withdrawAmount) || 0}
        currency="FCFA"
        confirmLabel={t('prof_confirm_withdraw')}
      />
    </div>
  );
}
