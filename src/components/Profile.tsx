import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import LegalDocumentDialog from './LegalDocumentDialog';
import { LEGAL_DOCUMENTS, LEGAL_DOC_ORDER, type LegalDocId } from '@/lib/legalDocuments';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Group, UserProfile, WalletTransaction, KycSubmission } from '@/types';
import { useLanguage, type LanguageCode } from '@/contexts/LanguageContext';
import { CustomAvatar } from './CustomAvatar';
import { AvatarWorkshop } from './AvatarWorkshop';
import { BiometricPrompt } from './BiometricPrompt';
import { EganyeIcon } from './ui/EganyeIcon';
import { ChipPicker } from './ui/ChipPicker';
import { PaymentPendingCard } from './ui/PaymentPendingCard';
import { WithdrawalPendingCard } from './ui/WithdrawalPendingCard';
import { SettingsGroup, SettingsRow } from './ui/SettingsList';
import { AmountField, FlowCheckbox, FlowNotice, FlowRow, FlowScreen } from './ui/FlowScreen';

import { supabase, isPasswordProviderUser } from '@/lib/supabase';
import { mapWalletTransactionRow } from '@/lib/mappers';
import { KYC_VERIFIED_LEVEL, submitKycDocument, fetchLatestKycSubmission } from '@/lib/kyc';
import { useBiometrics } from '@/hooks/useBiometrics';
import { requestWithdrawal, setUserPin, type WithdrawalState } from '@/lib/ledger';
import {
  computeDepositFee,
  fetchPlatformSettings,
  type DepositFeeBreakdown,
  type PlatformSettings,
  fetchWithdrawFeeSettings,
  computeWithdrawFee,
  type WithdrawFeeSettings,
} from '@/lib/platformSettings';
import { getOperatorsForCountry, findOperatorLabel } from '@/lib/paydunyaMethods';
import { apiUrl, apiFetch } from '@/lib/apiBase';
import { useBackHandler } from '@/hooks/useBackHandler';
import { fetchMyReliability, type Reliability } from '@/lib/reliability';

interface ProfileProps {
  user: UserProfile;
  groups: Group[];
  defaultTab?: string;
  focusCard?: 'recharge' | 'withdraw';
  onLogout?: () => void;
  onNavigate?: (view: string) => void;
}

type ProfileSection =
  | 'personal_info'
  | 'kyc'
  | 'mandate'
  | 'security_pin'
  | 'security_password'
  | 'wallet'
  | 'language'
  | 'notifications'
  | 'legal';

/** Montants proposés en un geste pour recharger. */
const QUICK_AMOUNTS = [5000, 10000, 25000, 50000];

const LAST_OPERATOR_KEY = 'eganye.lastOperator';

/** Le dernier opérateur utilisé, pour ne pas le redemander. */
function lastOperator(): string {
  try {
    const saved = localStorage.getItem(LAST_OPERATOR_KEY);
    if (saved && getOperatorsForCountry('tg').some((op) => op.value === saved)) return saved;
  } catch {
    // Stockage indisponible : on garde le choix par défaut.
  }
  return 'tmoney_tg';
}

function rememberOperator(value: string) {
  try {
    localStorage.setItem(LAST_OPERATOR_KEY, value);
  } catch {
    // Sans conséquence : il suffira de le choisir à nouveau.
  }
}

const fcfa = (value: number) => `${value.toLocaleString('fr-FR')} FCFA`;

export function Profile({ user, groups, defaultTab, focusCard, onLogout, onNavigate }: ProfileProps) {
  const { t, language, setLanguage } = useLanguage();

  // Active sub-page state: null = root settings list, or specific section key
  const [activeSection, setActiveSection] = useState<ProfileSection | null>(() => {
    if (defaultTab === 'wallet') return 'wallet';
    if (defaultTab === 'kyc') return 'kyc';
    if (defaultTab === 'personal_info') return 'personal_info';
    if (defaultTab === 'mandate') return 'mandate';
    if (defaultTab === 'security') return 'security_pin';
    return null;
  });

  // Conformité Android / Stores : touche retour ferme la sous-section ouverte
  useBackHandler(
    React.useCallback(() => {
      if (activeSection !== null) {
        setActiveSection(null);
        return true;
      }
      return false;
    }, [activeSection]),
    activeSection !== null
  );

  // Personal Info Form
  const [editDisplayName, setEditDisplayName] = useState(user.displayName || '');
  const [editFirstName, setEditFirstName] = useState(user.firstName || '');
  const [editLastName, setEditLastName] = useState(user.lastName || '');
  const [editPhone, setEditPhone] = useState(user.phone || '');
  const [editDateOfBirth, setEditDateOfBirth] = useState(user.dateOfBirth || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [isAvatarWorkshopOpen, setIsAvatarWorkshopOpen] = useState(false);

  // Security States
  const [newPin, setNewPin] = useState('');
  const [pinAccountPassword, setPinAccountPassword] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const { isEnrolled: biometricsEnabled, disableBiometrics } = useBiometrics();
  const [isBiometricPromptOpen, setIsBiometricPromptOpen] = useState(false);

  // Notification States
  const [pushNotif, setPushNotif] = useState(user.pushEnabled ?? true);
  const [smsNotif, setSmsNotif] = useState(user.smsNotificationsEnabled ?? false);
  const [emailNotif, setEmailNotif] = useState(user.emailNotificationsEnabled ?? true);
  const [whatsAppNotif, setWhatsAppNotif] = useState(user.whatsappNotificationsEnabled ?? false);

  // Wallet & Mobile Money States
  const [showBalance, setShowBalance] = useState(true);
  // Parcours ouvert par-dessus le portefeuille : une question par écran.
  const [walletFlow, setWalletFlow] = useState<'recharge' | 'withdraw' | null>(focusCard ?? null);
  const [flowStep, setFlowStep] = useState(1);
  const [editRechargePayer, setEditRechargePayer] = useState(false);
  const [isPasswordUser, setIsPasswordUser] = useState(true);
  const [reliability, setReliability] = useState<Reliability | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState('');
  // Cochée : les frais s'ajoutent et le montant saisi arrive entier sur le
  // portefeuille. Décochée : on paie le montant saisi, frais retenus dessus.
  const [rechargeFeeOnTop, setRechargeFeeOnTop] = useState(true);
  const [rechargeCountry, setRechargeCountry] = useState('tg');
  const [rechargeMethod, setRechargeMethod] = useState(lastOperator);
  const [rechargePhone, setRechargePhone] = useState(user.phone || '');
  const [isRecharging, setIsRecharging] = useState(false);

  // Frais du prestataire sur les dépôts. Lus en base plutôt qu'en dur : la
  // grille Paydunya peut changer, et l'administrateur doit pouvoir l'ajuster
  // sans redéploiement.
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchPlatformSettings()
      .then((s) => { if (!cancelled) setPlatformSettings(s); })
      .catch((err) => console.error('fetchPlatformSettings error:', err));
    return () => { cancelled = true; };
  }, []);

  // Paiement SoftPay en cours : l'opérateur a poussé une demande de code sur
  // le téléphone et on attend que l'utilisatrice la valide.
  const [pendingWithdrawal, setPendingWithdrawal] = useState<{
    withdrawalId: string | null;
    state: WithdrawalState;
    amount: number;
    debited: number;
    fee: number;
    operatorLabel: string;
    phone: string;
    defaultPin: boolean;
  } | null>(null);
  const [pendingPayment, setPendingPayment] = useState<{
    invoiceToken: string;
    netAmount: number;
    grossAmount: number;
    operatorLabel: string;
    phone: string;
  } | null>(null);

  // Ce qui arrivera sur le portefeuille (net), ce que Paydunya prélève (fee),
  // et ce qui sera réellement débité de son Mobile Money (gross).
  const [withdrawFeeOnTop, setWithdrawFeeOnTop] = useState(true);
  const [withdrawFeeSettings, setWithdrawFeeSettings] = useState<WithdrawFeeSettings | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchWithdrawFeeSettings().then((settings) => { if (!cancelled) setWithdrawFeeSettings(settings); });
    return () => { cancelled = true; };
  }, []);

  const depositBreakdown: DepositFeeBreakdown | null = React.useMemo(() => {
    const amount = parseFloat(rechargeAmount);
    if (!platformSettings || !Number.isFinite(amount) || amount <= 0) return null;
    return computeDepositFee(amount, platformSettings, rechargeFeeOnTop);
  }, [rechargeAmount, platformSettings, rechargeFeeOnTop]);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const withdrawIdempotencyKeyRef = React.useRef<string | null>(null);
  const [withdrawCountry, setWithdrawCountry] = useState('tg');
  const [withdrawMethod, setWithdrawMethod] = useState(lastOperator);
  const [withdrawPhone, setWithdrawPhone] = useState(user.phone || '');
  useEffect(() => { withdrawIdempotencyKeyRef.current = null; }, [withdrawAmount, withdrawPhone, withdrawMethod, withdrawFeeOnTop]);
  const withdrawBreakdown = React.useMemo(() => {
    const amount = parseFloat(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return computeWithdrawFee(amount, withdrawFeeSettings, withdrawFeeOnTop);
  }, [withdrawAmount, withdrawFeeSettings, withdrawFeeOnTop]);
  const [withdrawPin, setWithdrawPin] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);

  // KYC States
  const [kycSubmission, setKycSubmission] = useState<KycSubmission | null>(null);
  const [kycLoading, setKycLoading] = useState(true);
  const [kycFullName, setKycFullName] = useState(user.displayName || '');
  const [kycIdNumber, setKycIdNumber] = useState('');
  const [kycFile, setKycFile] = useState<File | null>(null);
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);

  // Digital Mandate States
  const [mandateName, setMandateName] = useState(user.mandateName || '');
  const [mandatePhone, setMandatePhone] = useState(user.mandatePhone || '');
  const [mandatePermissions, setMandatePermissions] = useState<string[]>(user.mandatePermissions || ['view_contributions']);
  const [isSavingMandate, setIsSavingMandate] = useState(false);

  // Legal Modal
  const [legalDoc, setLegalDoc] = useState<LegalDocId | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const isKycOk = (user.kycLevel ?? 1) >= KYC_VERIFIED_LEVEL;
  const isAdminUser = user.role === 'admin';

  useEffect(() => {
    if (focusCard) {
      setWalletFlow(focusCard);
      setFlowStep(1);
    }
  }, [focusCard]);

  // Le mot de passe n'est demandé pour le code PIN qu'aux comptes qui en ont un.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setIsPasswordUser(isPasswordProviderUser(data.session));
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMyReliability().then((value) => { if (!cancelled) setReliability(value); });
    return () => { cancelled = true; };
  }, [user.uid]);

  // Load KYC submission
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setKycLoading(true);
      try {
        const sub = await fetchLatestKycSubmission(user.uid);
        if (!cancelled) setKycSubmission(sub);
      } catch (err) {
        console.error('Failed to fetch KYC submission:', err);
      } finally {
        if (!cancelled) setKycLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user.uid]);

  // Load Transactions
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('wallet_transactions')
          .select('*')
          .eq('user_id', user.uid)
          .order('date', { ascending: false })
          .limit(10);
        if (!error && data && !cancelled) {
          setWalletTransactions(data.map(mapWalletTransactionRow));
        }
      } catch (err) {
        console.error('Failed to fetch wallet transactions:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [user.uid]);

  // Handlers
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: editDisplayName.trim(),
          first_name: editFirstName.trim(),
          last_name: editLastName.trim(),
          phone: editPhone.trim(),
          date_of_birth: editDateOfBirth || null,
        })
        .eq('id', user.uid);
      if (error) throw error;
      toast.success('Profil mis à jour avec succès !');
      setActiveSection(null);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePin = async () => {
    if (newPin.length !== 4) {
      toast.error('Le code PIN doit comporter exactement 4 chiffres.');
      return;
    }
    setIsSavingPin(true);
    try {
      // Pas d'ancien code demandé (il peut être oublié) : on s'assure plutôt
      // que c'est bien la titulaire, avec le mot de passe de son compte.
      const { data: sessionData } = await supabase.auth.getSession();
      if (isPasswordProviderUser(sessionData.session)) {
        if (!pinAccountPassword) {
          throw new Error('Saisissez le mot de passe de votre compte pour confirmer.');
        }
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: pinAccountPassword,
        });
        if (authError) throw new Error('Mot de passe du compte incorrect.');
      }
      const res = await setUserPin(user.uid, newPin);
      if (!res.success) throw new Error(res.message);
      toast.success('Code PIN modifié avec succès !');
      setNewPin('');
      setPinAccountPassword('');
      setActiveSection(null);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la modification du code PIN');
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    setIsSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Mot de passe mis à jour !');
      setNewPassword('');
      setActiveSection(null);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du changement de mot de passe');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleToggleBiometrics = async (checked: boolean) => {
    if (checked) {
      setIsBiometricPromptOpen(true);
    } else {
      await disableBiometrics();
      await supabase.from('profiles').update({ biometrics_enabled: false }).eq('id', user.uid);
      toast.success('Connexion biométrique désactivée');
    }
  };

  const handleSubmitKyc = async () => {
    if (!kycFullName.trim()) {
      toast.error('Veuillez saisir votre nom complet');
      return;
    }
    if (!kycFile) {
      toast.error('Veuillez joindre une photo de votre pièce d’identité');
      return;
    }
    setIsSubmittingKyc(true);
    try {
      const result = await submitKycDocument({
        userId: user.uid,
        fullName: kycFullName.trim(),
        idNumber: kycIdNumber.trim(),
        file: kycFile,
      });
      if (!result.success) throw new Error(result.message);
      toast.success(result.message);
      const sub = await fetchLatestKycSubmission(user.uid);
      setKycSubmission(sub);
      setActiveSection(null);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l’envoi de la pièce');
    } finally {
      setIsSubmittingKyc(false);
    }
  };

  const handleSaveMandate = async () => {
    if (!mandateName.trim()) {
      toast.error('Veuillez renseigner le nom du mandataire');
      return;
    }
    setIsSavingMandate(true);
    try {
      const { error } = await supabase.from('profiles').update({
        mandate_name: mandateName.trim() || null,
        mandate_phone: mandatePhone.trim() || null,
        mandate_permissions: mandatePermissions,
      }).eq('id', user.uid);
      if (error) throw error;
      toast.success('Mandataire numérique enregistré !');
      setActiveSection(null);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l’enregistrement');
    } finally {
      setIsSavingMandate(false);
    }
  };

  const handleToggleNotification = async (channel: string, currentVal: boolean, setter: (v: boolean) => void) => {
    const newVal = !currentVal;
    setter(newVal);
    try {
      const { error } = await supabase.from('profiles').update({ [channel]: newVal }).eq('id', user.uid);
      if (error) throw error;
    } catch {
      setter(currentVal);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleRecharge = async () => {
    if (!navigator.onLine) {
      toast.error('Connexion Internet requise pour recharger votre portefeuille.');
      return;
    }
    const amt = parseFloat(rechargeAmount);
    if (!amt || amt < 500) {
      toast.error('Le montant minimum de recharge est de 500 FCFA.');
      return;
    }
    if (rechargePhone.replace(/\D/g, '').length < 8) {
      toast.error('Veuillez saisir un numéro de téléphone valide.');
      return;
    }
    setIsRecharging(true);
    rememberOperator(rechargeMethod);
    try {
      // Le portefeuille n'est crédité qu'après un vrai paiement Paydunya
      // confirmé (App.tsx gère le retour ?paydunya_success=true) — on ne
      // crédite jamais directement ici.
      //
      // `amount` est le montant saisi, `feeOnTop` dit si les frais s'y
      // ajoutent ou y sont retenus. Le serveur recalcule lui-même les frais,
      // le montant facturé et le montant crédité : rien de cela ne se décide
      // d'après une valeur calculée par le navigateur.
      const response = await apiFetch('/api/create-paydunya-checkout', {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          feeOnTop: rechargeFeeOnTop,
          userId: user.uid,
          userName: user.displayName,
          userEmail: user.email,
          phone: rechargePhone,
          paymentMethod: rechargeMethod,
        }),
      });
      if (!response.ok) {
        throw new Error(`Paydunya checkout HTTP ${response.status}`);
      }
      const data = await response.json().catch(() => null);

      if (data?.mode === 'direct' && data?.invoiceToken) {
        // Paydunya a envoyé une demande de code directement sur le téléphone :
        // on reste sur eganyé et on montre où en est le paiement, au lieu de
        // refermer le formulaire sur un message fugace. Le crédit reste géré
        // par le webhook.
        setPendingPayment({
          invoiceToken: data.invoiceToken,
          netAmount: depositBreakdown?.net ?? amt,
          grossAmount: depositBreakdown?.gross ?? amt,
          operatorLabel: findOperatorLabel(rechargeMethod),
          phone: rechargePhone,
        });
        return;
      }

      if (!data?.url) {
        throw new Error(data?.error || 'Paydunya checkout: réponse sans URL');
      }
      window.location.href = data.url;
    } catch (err: any) {
      console.error('Paydunya checkout error:', err);
      toast.error('Erreur lors du démarrage de la recharge. Veuillez réessayer.');
    } finally {
      setIsRecharging(false);
    }
  };

  const closeWalletFlow = () => {
    setWalletFlow(null);
    setFlowStep(1);
    setEditRechargePayer(false);
  };

  const openWalletFlow = (flow: 'recharge' | 'withdraw') => {
    setFlowStep(1);
    setEditRechargePayer(rechargePhone.replace(/\D/g, '').length < 8);
    setWalletFlow(flow);
  };

  const validateRechargeAmount = () => {
    const amt = parseFloat(rechargeAmount);
    if (!amt || amt < 500) {
      toast.error('Le minimum est de 500 FCFA.');
      return false;
    }
    return true;
  };

  const validateWithdrawAmount = () => {
    if (!navigator.onLine) {
      toast.error('Connexion Internet requise pour effectuer un retrait.');
      return false;
    }
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt < 500) {
      toast.error('Le minimum est de 500 FCFA.');
      return false;
    }
    if (!Number.isInteger(amt)) {
      toast.error('Le montant doit être un nombre entier de FCFA');
      return false;
    }
    if (amt > (user.walletBalance || 0)) {
      toast.error('Solde disponible insuffisant');
      return false;
    }
    return true;
  };

  const validateWithdrawRecipient = () => {
    if (!withdrawMethod) {
      toast.error('Veuillez sélectionner un opérateur Mobile Money');
      return false;
    }
    if (withdrawPhone.replace(/\D/g, '').length < 8) {
      toast.error('Veuillez saisir un numéro de téléphone valide');
      return false;
    }
    return true;
  };

  const validateWithdrawSummary = () => {
    const amt = parseFloat(withdrawAmount);
    const breakdown = computeWithdrawFee(amt, withdrawFeeSettings, withdrawFeeOnTop);
    if (breakdown.debit > (user.walletBalance || 0)) {
      toast.error(breakdown.fee > 0 && amt <= (user.walletBalance || 0)
        ? `Solde insuffisant : il faut ${breakdown.debit.toLocaleString()} FCFA, frais compris. Décochez « Payer les frais en plus » pour les retirer du montant.`
        : 'Solde disponible insuffisant');
      return false;
    }
    if (breakdown.net <= 0) {
      toast.error('Montant trop faible une fois les frais retenus');
      return false;
    }
    return true;
  };

  const handleConfirmWithdraw = async () => {
    const amt = parseFloat(withdrawAmount);
    const withdrawMethodLabel = findOperatorLabel(withdrawMethod);
    if (!navigator.onLine) {
      toast.error('Connexion Internet requise pour effectuer un retrait.');
      return;
    }
    if (withdrawPin.length !== 4) {
      toast.error('Veuillez saisir votre code PIN de retrait');
      return;
    }
    setIsWithdrawing(true);
    try {
      if (!withdrawIdempotencyKeyRef.current) {
        withdrawIdempotencyKeyRef.current = crypto.randomUUID();
      }
      // Le serveur vérifie le code PIN, débite, puis envoie via PayDunya ou
      // place la demande dans la file de l'Admin (api/paydunya-payout.ts).
      // En cas de coupure, la clé est conservée : réessayer ne débite pas deux fois.
      const result = await requestWithdrawal({
        idempotencyKey: withdrawIdempotencyKeyRef.current,
        amount: amt,
        paymentMethod: withdrawMethod,
        phone: withdrawPhone,
        pin: withdrawPin,
        feeOnTop: withdrawFeeOnTop,
        expectedFee: computeWithdrawFee(amt, withdrawFeeSettings, withdrawFeeOnTop).fee,
      });
      if (!result.success) throw new Error(result.message);

      withdrawIdempotencyKeyRef.current = null;
      setWithdrawPin('');
      rememberOperator(withdrawMethod);
      closeWalletFlow();
      setPendingWithdrawal({
        withdrawalId: result.withdrawalId ?? null,
        state: result.state ?? 'manual',
        amount: result.amount ?? amt,
        debited: result.debited ?? amt,
        fee: result.fee ?? 0,
        operatorLabel: withdrawMethodLabel,
        phone: withdrawPhone,
        defaultPin: Boolean(result.defaultPin),
      });
    } catch (err: any) {
      console.error('Withdrawal error:', err);
      toast.error(err.message || 'Erreur lors du retrait');
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Helper for sub-page top header
  const renderSubHeader = (title: string) => (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setActiveSection(null)}
        className="w-11 h-11 -ml-2 rounded-xl flex items-center justify-center text-foreground active:bg-muted cursor-pointer transition-colors duration-150 shrink-0"
        aria-label="Retour"
      >
        <EganyeIcon name="chevron-left" size={20} />
      </button>
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
    </div>
  );

  const readyScore = reliability?.status === 'ready' ? reliability.score : null;
  const screenTransition = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div className="pb-24 max-w-lg mx-auto">
      <AnimatePresence mode="wait">
        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* VUE PRINCIPALE DU PROFIL (Style Mobile iOS Inset Grouped)       */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {!activeSection ? (
          <motion.div
            key="root"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
          >
            {/* Identité, sans carte : le nom ouvre le reste de la page. */}
            <div className="flex items-center gap-3.5 px-1">
              <button
                type="button"
                onClick={() => setIsAvatarWorkshopOpen(true)}
                aria-label="Modifier ma photo"
                className="relative shrink-0 rounded-full cursor-pointer"
              >
                <CustomAvatar photoURL={user.photoURL} name={user.displayName} size={64} />
                <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-foreground">
                  <EganyeIcon name="profile" size={12} />
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold text-foreground truncate">{user.displayName}</h1>
                <p className="text-sm text-muted-foreground truncate">{user.phone || user.email}</p>
              </div>
            </div>

            <SettingsGroup title="Mon argent">
              <SettingsRow
                icon="wallet"
                label="Mon portefeuille"
                value={fcfa(user.walletBalance || 0)}
                onClick={() => setActiveSection('wallet')}
              />
              <SettingsRow
                icon="star"
                label="Formule Épargne"
                value={user.bankTier && user.bankTier !== 'none' ? t(`bank_tier_${user.bankTier}`) : 'Gratuite'}
                onClick={() => onNavigate?.('my-bank')}
              />
              <SettingsRow
                icon="shield"
                label="Score de fiabilité"
                hint={`Réputation pour les services : ${user.reputationScore ?? 0}/100`}
                value={readyScore !== null ? `${readyScore}/100` : undefined}
                onClick={() => onNavigate?.('ai-assistant')}
              />
            </SettingsGroup>

            <SettingsGroup title="Compte">
              <SettingsRow
                icon="profile"
                label="Mes informations"
                onClick={() => setActiveSection('personal_info')}
              />
              <SettingsRow
                icon="document"
                label="Mon identité"
                value={isKycOk ? 'Vérifiée' : 'À faire'}
                onClick={() => setActiveSection('kyc')}
              />
              <SettingsRow
                icon="members"
                label="Personne de confiance"
                onClick={() => setActiveSection('mandate')}
              />
            </SettingsGroup>

            <SettingsGroup title="Sécurité">
              <SettingsRow
                icon="fingerprint"
                label="Verrouiller avec l'empreinte"
                trailing={<Switch checked={biometricsEnabled} onCheckedChange={handleToggleBiometrics} />}
              />
              <SettingsRow
                icon="lock"
                label="Code PIN"
                onClick={() => setActiveSection('security_pin')}
              />
              <SettingsRow
                icon="key"
                label="Mot de passe"
                onClick={() => setActiveSection('security_password')}
              />
            </SettingsGroup>

            <SettingsGroup title="Préférences">
              <SettingsRow
                icon="globe"
                label="Langue"
                value={({ fr: 'Français', en: 'English', ee: 'Èʋegbe', kbp: 'Kabɩyɛ' } as Record<string, string>)[language] ?? 'Français'}
                onClick={() => setActiveSection('language')}
              />
              <SettingsRow
                icon="bell"
                label="Notifications"
                onClick={() => setActiveSection('notifications')}
              />
            </SettingsGroup>

            <SettingsGroup title="Aide">
              <SettingsRow
                icon="chat"
                label="Aide et support"
                onClick={() => onNavigate?.('support')}
              />
              <SettingsRow
                icon="document"
                label="Conditions et confidentialité"
                onClick={() => setActiveSection('legal')}
              />
              {isAdminUser && (
                <SettingsRow
                  icon="shield"
                  label="Administration"
                  onClick={() => onNavigate?.('admin')}
                />
              )}
            </SettingsGroup>

            <SettingsGroup>
              <SettingsRow icon="withdraw" label="Se déconnecter" onClick={onLogout} danger />
            </SettingsGroup>
          </motion.div>
        ) : null}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* SOUS-PAGE 1 : INFORMATIONS PERSONNELLES                          */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {activeSection === 'personal_info' && (
          <motion.div
            key="personal_info"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={screenTransition}
            className="space-y-5"
          >
            {renderSubHeader('Mes informations')}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-foreground">Nom affiché</Label>
                <Input
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="rounded-xl h-12 text-base"
                  placeholder="Ex : Kossi"
                />
                <p className="text-[13px] text-muted-foreground">C’est le nom que voient les membres de vos cercles.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-foreground">Prénom</Label>
                  <Input
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="rounded-xl h-12 text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-foreground">Nom</Label>
                  <Input
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="rounded-xl h-12 text-base"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-foreground">Téléphone Mobile Money</Label>
                <Input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="rounded-xl h-12 text-base font-mono"
                  placeholder="90 00 00 00"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-foreground">Adresse e-mail</Label>
                <Input
                  value={user.email}
                  disabled
                  className="rounded-xl h-12 bg-muted/50 text-muted-foreground text-sm"
                />
                <p className="text-[13px] text-muted-foreground">Elle sert à vous connecter et ne peut pas être changée ici.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-foreground">Date de naissance</Label>
                <Input
                  type="date"
                  value={editDateOfBirth}
                  onChange={(e) => setEditDateOfBirth(e.target.value)}
                  className="rounded-xl h-12 text-base"
                />
              </div>

              <Button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="w-full h-12 rounded-xl font-bold text-[15px] cursor-pointer mt-2"
              >
                {savingProfile ? 'Enregistrement…' : 'Enregistrer'}
              </Button>

              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full min-h-11 text-center text-sm font-bold text-danger cursor-pointer"
              >
                Supprimer mon compte
              </button>
            </div>
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* SOUS-PAGE 2 : VÉRIFICATION D’IDENTITÉ (KYC)                      */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {activeSection === 'kyc' && (
          <motion.div
            key="kyc"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={screenTransition}
            className="space-y-5"
          >
            {renderSubHeader('Vérifier mon identité')}

            {(() => {
              const kycStatus: 'verified' | 'pending' | 'unverified' = isKycOk
                ? 'verified'
                : kycSubmission?.status === 'pending'
                ? 'pending'
                : 'unverified';
              const KYC_STATUS_COPY = {
                verified: {
                  className: 'bg-success-soft text-secondary',
                  title: 'Identité vérifiée',
                  desc: 'Vous pouvez créer et rejoindre des cercles.',
                },
                pending: {
                  className: 'bg-warning-soft text-primary-ink',
                  title: 'Nous vérifions votre document',
                  desc: 'Il a bien été reçu. Notre équipe valide généralement en moins de 24 h, vous serez prévenu.',
                },
                unverified: {
                  className: 'bg-muted text-foreground',
                  title: 'Identité pas encore vérifiée',
                  desc: 'Elle est demandée pour créer ou rejoindre un cercle, et protège tous les membres contre la fraude.',
                },
              } as const;
              const copy = KYC_STATUS_COPY[kycStatus];

              return (
                <div className="space-y-4">
                  {/* Statut actuel */}
                  <div className={`p-4 rounded-2xl text-sm space-y-1 ${copy.className}`}>
                    <p className="font-bold">{copy.title}</p>
                    <p className="leading-relaxed text-foreground">{copy.desc}</p>
                  </div>

              {!isKycOk && (
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-bold text-foreground">Nom complet (comme sur la pièce)</Label>
                    <Input
                      value={kycFullName}
                      onChange={(e) => setKycFullName(e.target.value)}
                      className="rounded-xl h-12 text-base"
                      placeholder="Ex : Kossi Koffi Amégan"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-bold text-foreground">Numéro de la pièce</Label>
                    <Input
                      value={kycIdNumber}
                      onChange={(e) => setKycIdNumber(e.target.value)}
                      className="rounded-xl h-12 text-base font-mono"
                      placeholder="Carte d’identité ou passeport"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-bold text-foreground">Photo de la pièce</Label>
                    <label
                      htmlFor="kyc_upload"
                      className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-2xl cursor-pointer bg-card transition-colors duration-150 text-center gap-2"
                    >
                      <EganyeIcon name="document" size={22} className="text-muted-foreground" />
                      <span className="text-sm font-bold text-foreground">
                        {kycFile ? kycFile.name : 'Touchez pour prendre ou choisir une photo'}
                      </span>
                      <span className="text-[13px] text-muted-foreground">Photo ou PDF, 10 Mo maximum</span>
                      <input
                        id="kyc_upload"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setKycFile(e.target.files?.[0] || null)}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  <Button
                    onClick={handleSubmitKyc}
                    disabled={isSubmittingKyc}
                    className="w-full h-12 rounded-xl font-bold text-[15px] cursor-pointer mt-2"
                  >
                    {isSubmittingKyc ? 'Envoi…' : 'Envoyer ma pièce'}
                  </Button>
                </div>
              )}
                </div>
              );
            })()}
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* SOUS-PAGE 3 : MANDATAIRE NUMÉRIQUE                              */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {activeSection === 'mandate' && (
          <motion.div
            key="mandate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={screenTransition}
            className="space-y-5"
          >
            {renderSubHeader('Personne de confiance')}

            <div className="space-y-4">
              <p className="text-[15px] text-muted-foreground leading-relaxed">
                Un proche (conjoint, parent, frère ou sœur) qui peut suivre vos cotisations et recevoir les alertes si vous ne pouvez plus le faire.
              </p>

              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-foreground">Son nom complet</Label>
                <Input
                  value={mandateName}
                  onChange={(e) => setMandateName(e.target.value)}
                  className="rounded-xl h-12 text-base"
                  placeholder="Ex : Afiwa Amégan"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-foreground">Son téléphone</Label>
                <Input
                  type="tel"
                  value={mandatePhone}
                  onChange={(e) => setMandatePhone(e.target.value)}
                  className="rounded-xl h-12 text-base font-mono"
                  placeholder="90 00 00 00"
                />
              </div>

              <p className="p-4 rounded-2xl bg-muted text-sm text-foreground leading-relaxed">
                Cette personne ne peut <strong>pas retirer votre argent</strong> sans une vérification stricte de notre équipe.
              </p>

              <Button
                onClick={handleSaveMandate}
                disabled={isSavingMandate}
                className="w-full h-12 rounded-xl font-bold text-[15px] cursor-pointer mt-2"
              >
                {isSavingMandate ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* SOUS-PAGE 4 : CODE PIN DE RETRAIT                               */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {activeSection === 'security_pin' && (
          <motion.div
            key="security_pin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={screenTransition}
            className="space-y-5"
          >
            {renderSubHeader('Code PIN')}

            <div className="space-y-4">
              <p className="text-[15px] text-muted-foreground leading-relaxed">
                4 chiffres demandés à chaque retrait. Ne les donnez à personne.
                {isPasswordUser ? ' Code oublié ? Choisissez-en un nouveau ici, avec le mot de passe de votre compte.' : ' Code oublié ? Choisissez-en un nouveau ici.'}
              </p>

              {isPasswordUser && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-foreground">Mot de passe de votre compte</Label>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={pinAccountPassword}
                    onChange={(e) => setPinAccountPassword(e.target.value)}
                    className="rounded-xl h-12 text-base"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-foreground">Nouveau code PIN</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="rounded-xl h-12 text-center text-2xl font-mono"
                  placeholder="••••"
                />
              </div>

              <Button
                onClick={handleChangePin}
                disabled={isSavingPin || newPin.length !== 4}
                className="w-full h-12 rounded-xl font-bold text-[15px] cursor-pointer mt-2"
              >
                {isSavingPin ? 'Enregistrement…' : 'Enregistrer le code'}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* SOUS-PAGE 5 : MOT DE PASSE                                      */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {activeSection === 'security_password' && (
          <motion.div
            key="security_password"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={screenTransition}
            className="space-y-5"
          >
            {renderSubHeader('Mot de passe')}

            <div className="space-y-4">
              <p className="text-[15px] text-muted-foreground leading-relaxed">
                Au moins 6 caractères. Mélangez lettres, chiffres et un signe pour plus de sécurité.
              </p>

              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-foreground">Nouveau mot de passe</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="rounded-xl h-12 text-base"
                  placeholder="Au moins 6 caractères"
                  autoFocus
                />
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={isSavingPassword || newPassword.length < 6}
                className="w-full h-12 rounded-xl font-bold text-[15px] cursor-pointer mt-2"
              >
                {isSavingPassword ? 'Enregistrement…' : 'Changer le mot de passe'}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* SOUS-PAGE 6 : PORTEFEUILLE MOBILE MONEY                          */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {activeSection === 'wallet' && (
          <motion.div
            key="wallet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={screenTransition}
            className="space-y-5"
          >
            {renderSubHeader('Mon portefeuille')}

            <div className="px-1 space-y-1">
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">Mon solde</span>
                <button
                  type="button"
                  onClick={() => setShowBalance(!showBalance)}
                  aria-label={showBalance ? 'Masquer le solde' : 'Afficher le solde'}
                  className="w-11 h-11 -my-3 flex items-center justify-center text-muted-foreground cursor-pointer"
                >
                  <EganyeIcon name={showBalance ? 'eye' : 'eye-off'} size={18} />
                </button>
              </div>
              <p className="text-[34px] leading-tight font-bold text-foreground tabular-nums">
                {showBalance ? fcfa(user.walletBalance || 0) : '••••••• FCFA'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => openWalletFlow('recharge')} className="h-12 rounded-xl font-bold text-[15px] cursor-pointer">
                Recharger
              </Button>
              <Button onClick={() => openWalletFlow('withdraw')} variant="outline" className="h-12 rounded-xl font-bold text-[15px] cursor-pointer">
                Retirer
              </Button>
            </div>

            {walletTransactions.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-[13px] font-bold text-muted-foreground px-3">Derniers mouvements</h2>
                <ul className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
                  {walletTransactions.map((tx) => (
                    <li key={tx.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{tx.description}</p>
                        <p className="text-[13px] text-muted-foreground">
                          {format(new Date(tx.date), 'd MMM yyyy', { locale: fr })}
                          {tx.status === 'pending' ? ' · En cours' : tx.status === 'failed' ? ' · Échoué' : ''}
                        </p>
                      </div>
                      <span className={`text-sm font-bold tabular-nums shrink-0 ${tx.amount >= 0 ? 'text-secondary' : 'text-foreground'}`}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString('fr-FR')} F
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* SOUS-PAGE 8 : LANGUE DE L'APPLICATION                            */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {activeSection === 'language' && (
          <motion.div
            key="language"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={screenTransition}
            className="space-y-5"
          >
            {renderSubHeader('Langue')}

            <SettingsGroup>
              {[
                { code: 'fr' as LanguageCode, name: 'Français' },
                { code: 'en' as LanguageCode, name: 'English' },
                { code: 'ee' as LanguageCode, name: 'Èʋegbe (Ewe)' },
                { code: 'kbp' as LanguageCode, name: 'Kabɩyɛ (Kabyè)' },
                // Wolof et Bambara masqués tant que leurs traductions ne sont pas prêtes
                // (< 15 clés sur ~1120 dans LanguageContext.tsx) — voir LanguageSwitcher.tsx.
              ].map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  role="radio"
                  aria-checked={language === lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className="w-full min-h-[52px] flex items-center justify-between gap-3 px-4 text-left cursor-pointer active:bg-muted transition-colors duration-150"
                >
                  <span className="text-[15px] font-semibold text-foreground">{lang.name}</span>
                  {language === lang.code && <EganyeIcon name="check" size={18} strokeWidth={2.5} className="text-primary-ink shrink-0" />}
                </button>
              ))}
            </SettingsGroup>
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* SOUS-PAGE 9 : NOTIFICATIONS                                     */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {activeSection === 'notifications' && (
          <motion.div
            key="notifications"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={screenTransition}
            className="space-y-5"
          >
            {renderSubHeader('Notifications')}

            <SettingsGroup>
              <SettingsRow
                label="Sur l'écran du téléphone"
                hint="Rappels d'échéances et tours"
                trailing={<Switch checked={pushNotif} onCheckedChange={() => handleToggleNotification('push_enabled', pushNotif, setPushNotif)} />}
              />
              <SettingsRow
                label="SMS"
                hint="Paiements et rappels"
                trailing={<Switch checked={smsNotif} onCheckedChange={() => handleToggleNotification('sms_notifications_enabled', smsNotif, setSmsNotif)} />}
              />
              <SettingsRow
                label="WhatsApp"
                hint="Résumé des tours de cercle"
                trailing={<Switch checked={whatsAppNotif} onCheckedChange={() => handleToggleNotification('whatsapp_notifications_enabled', whatsAppNotif, setWhatsAppNotif)} />}
              />
              <SettingsRow
                label="E-mail"
                hint="Reçus et relevés"
                trailing={<Switch checked={emailNotif} onCheckedChange={() => handleToggleNotification('email_notifications_enabled', emailNotif, setEmailNotif)} />}
              />
            </SettingsGroup>
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* SOUS-PAGE 10 : LÉGAL & CONDITIONS                               */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {activeSection === 'legal' && (
          <motion.div
            key="legal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={screenTransition}
            className="space-y-5"
          >
            {renderSubHeader('Conditions')}

            <SettingsGroup>
              {LEGAL_DOC_ORDER.map((id) => LEGAL_DOCUMENTS[id]).map((doc) => (
                <SettingsRow key={doc.id} label={doc.title} hint={doc.audience} onClick={() => setLegalDoc(doc.id)} />
              ))}
            </SettingsGroup>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DOCUMENTS LÉGAUX ── */}
      <LegalDocumentDialog docId={legalDoc} onClose={() => setLegalDoc(null)} />

      {/* ── MODALE ATELIER D'AVATAR ── */}
      <Dialog open={isAvatarWorkshopOpen} onOpenChange={setIsAvatarWorkshopOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ma photo</DialogTitle>
            <DialogDescription>Choisissez une photo ou un avatar.</DialogDescription>
          </DialogHeader>

          <AvatarWorkshop
            value={user.photoURL || ''}
            onChange={async (newAvatar) => {
              try {
                const { error } = await supabase.from('profiles').update({ avatar_url: newAvatar }).eq('id', user.uid);
                if (error) throw error;
                toast.success('Avatar mis à jour !');
                setIsAvatarWorkshopOpen(false);
              } catch {
                toast.error('Erreur lors de la mise à jour de l’avatar');
              }
            }}
            name={user.displayName}
            userId={user.uid}
          />
        </DialogContent>
      </Dialog>

      {/* ── MODALE BIOMÉTRIE ── */}
      <BiometricPrompt
        isOpen={isBiometricPromptOpen}
        onClose={() => setIsBiometricPromptOpen(false)}
        username={user.displayName}
        userId={user.uid}
        mode="register"
        onSuccess={async () => {
          setIsBiometricPromptOpen(false);
          await supabase.from('profiles').update({ biometrics_enabled: true }).eq('id', user.uid);
          toast.success('Connexion biométrique activée avec succès !');
        }}
      />

      {/* ── SUIVI : seul à l'écran, c'est la seule chose à faire à cet instant ── */}
      {pendingWithdrawal && (
        <FlowScreen
          title="Retrait"
          onBack={() => {
            setPendingWithdrawal(null);
            setWithdrawAmount('');
          }}
        >
          <WithdrawalPendingCard
            {...pendingWithdrawal}
            onDone={() => {
              setPendingWithdrawal(null);
              setWithdrawAmount('');
            }}
            onChangePin={() => {
              setPendingWithdrawal(null);
              setWithdrawAmount('');
              setActiveSection('security_pin');
            }}
          />
        </FlowScreen>
      )}

      {pendingPayment && (
        <FlowScreen
          title="Recharge"
          onBack={() => {
            setPendingPayment(null);
            setRechargeAmount('');
          }}
        >
          <PaymentPendingCard
            invoiceToken={pendingPayment.invoiceToken}
            netAmount={pendingPayment.netAmount}
            grossAmount={pendingPayment.grossAmount}
            operatorLabel={pendingPayment.operatorLabel}
            phone={pendingPayment.phone}
            onDone={() => {
              setPendingPayment(null);
              setRechargeAmount('');
            }}
            onRetry={() => setPendingPayment(null)}
          />
        </FlowScreen>
      )}

      {/* ── RECHARGE ── */}
      {walletFlow === 'recharge' && !pendingPayment && flowStep === 1 && (
        <FlowScreen
          title="Recharger"
          step={1}
          totalSteps={2}
          heading="Combien voulez-vous ajouter ?"
          desc="Minimum 500 FCFA"
          onBack={closeWalletFlow}
          footer={
            <Button
              className="w-full h-12 rounded-xl font-bold text-[15px]"
              disabled={!rechargeAmount}
              onClick={() => { if (validateRechargeAmount()) setFlowStep(2); }}
            >
              Continuer
            </Button>
          }
        >
          <AmountField value={rechargeAmount} onChange={setRechargeAmount} suggestions={QUICK_AMOUNTS} />
        </FlowScreen>
      )}

      {walletFlow === 'recharge' && !pendingPayment && flowStep === 2 && (
        <FlowScreen
          title="Recharger"
          step={2}
          totalSteps={2}
          heading="Vérifiez votre paiement"
          onBack={() => setFlowStep(1)}
          footer={
            <Button className="w-full h-12 rounded-xl font-bold text-[15px]" onClick={handleRecharge} disabled={isRecharging}>
              {isRecharging ? 'Paiement en cours…' : `Payer ${fcfa(depositBreakdown?.gross ?? (parseFloat(rechargeAmount) || 0))}`}
            </Button>
          }
        >
          {editRechargePayer ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-foreground">Avec quel opérateur ?</Label>
                <ChipPicker
                  ariaLabel="Opérateur"
                  value={rechargeMethod}
                  onChange={setRechargeMethod}
                  options={getOperatorsForCountry(rechargeCountry)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recharge_phone" className="text-sm font-bold text-foreground">Numéro qui paie</Label>
                <Input
                  id="recharge_phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={rechargePhone}
                  onChange={(e) => setRechargePhone(e.target.value)}
                  className="rounded-xl h-12 font-mono text-base"
                />
                <p className="text-[13px] text-muted-foreground">Vous confirmerez le paiement sur ce téléphone.</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card px-4">
              <FlowRow
                label="Payer avec"
                value={`${findOperatorLabel(rechargeMethod)} · ${rechargePhone}`}
                onEdit={() => setEditRechargePayer(true)}
              />
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card px-4 divide-y divide-border">
            <FlowRow label="Vous recevez" value={fcfa(depositBreakdown?.net ?? (parseFloat(rechargeAmount) || 0))} />
            {depositBreakdown && depositBreakdown.fee > 0 && (
              <FlowRow label="Frais de l'opérateur" value={fcfa(depositBreakdown.fee)} />
            )}
            <FlowRow label="Total à payer" value={fcfa(depositBreakdown?.gross ?? (parseFloat(rechargeAmount) || 0))} strong />
          </div>

          {platformSettings?.depositFeeEnabled && (
            <FlowCheckbox checked={rechargeFeeOnTop} onChange={setRechargeFeeOnTop}>
              <span className="font-bold">Payer les frais en plus</span>
              <span className="block text-muted-foreground">
                {rechargeFeeOnTop ? 'Vous recevez le montant entier.' : 'Les frais sont retirés du montant reçu.'}
              </span>
            </FlowCheckbox>
          )}
        </FlowScreen>
      )}

      {/* ── RETRAIT ── */}
      {walletFlow === 'withdraw' && flowStep === 1 && (
        <FlowScreen
          title="Retirer"
          step={1}
          totalSteps={4}
          heading="Combien voulez-vous retirer ?"
          desc={`Solde : ${fcfa(user.walletBalance || 0)}. Minimum 500 FCFA.`}
          onBack={closeWalletFlow}
          footer={
            <Button
              className="w-full h-12 rounded-xl font-bold text-[15px]"
              disabled={!withdrawAmount}
              onClick={() => { if (validateWithdrawAmount()) setFlowStep(2); }}
            >
              Continuer
            </Button>
          }
        >
          <AmountField value={withdrawAmount} onChange={setWithdrawAmount} />
          <button
            type="button"
            onClick={() => {
              // Tout retirer : les frais ne peuvent venir que du montant lui-même.
              setWithdrawFeeOnTop(false);
              setWithdrawAmount(String(Math.floor(user.walletBalance || 0)));
            }}
            className="w-full min-h-11 text-center text-sm font-bold text-primary-ink cursor-pointer"
          >
            Tout retirer
          </button>
        </FlowScreen>
      )}

      {walletFlow === 'withdraw' && flowStep === 2 && (
        <FlowScreen
          title="Retirer"
          step={2}
          totalSteps={4}
          heading="Où envoyer l'argent ?"
          onBack={() => setFlowStep(1)}
          footer={
            <Button
              className="w-full h-12 rounded-xl font-bold text-[15px]"
              onClick={() => { if (validateWithdrawRecipient()) setFlowStep(3); }}
            >
              Continuer
            </Button>
          }
        >
          <div className="space-y-1.5">
            <Label className="text-sm font-bold text-foreground">Opérateur</Label>
            <ChipPicker
              ariaLabel="Opérateur"
              value={withdrawMethod}
              onChange={setWithdrawMethod}
              options={getOperatorsForCountry(withdrawCountry)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="withdraw_phone" className="text-sm font-bold text-foreground">Numéro qui reçoit l'argent</Label>
            <Input
              id="withdraw_phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={withdrawPhone}
              onChange={(e) => setWithdrawPhone(e.target.value)}
              className="rounded-xl h-12 font-mono text-base"
            />
          </div>
          <FlowNotice tone="warning">Vérifiez le numéro : un envoi réussi ne peut pas être annulé.</FlowNotice>
        </FlowScreen>
      )}

      {walletFlow === 'withdraw' && flowStep === 3 && (
        <FlowScreen
          title="Retirer"
          step={3}
          totalSteps={4}
          heading="Vérifiez votre retrait"
          onBack={() => setFlowStep(2)}
          footer={
            <Button
              className="w-full h-12 rounded-xl font-bold text-[15px]"
              onClick={() => { if (validateWithdrawSummary()) setFlowStep(4); }}
            >
              Continuer
            </Button>
          }
        >
          <div className="px-1">
            <p className="text-sm text-muted-foreground">Vous recevez</p>
            <p className="text-[34px] leading-tight font-bold text-foreground tabular-nums">{fcfa(withdrawBreakdown?.net ?? 0)}</p>
          </div>

          <div className="rounded-2xl border border-border bg-card px-4 divide-y divide-border">
            <FlowRow label="Frais de retrait" value={fcfa(withdrawBreakdown?.fee ?? 0)} />
            <FlowRow label="Débité de votre solde" value={fcfa(withdrawBreakdown?.debit ?? 0)} strong />
            <FlowRow label="Envoyé à" value={`${findOperatorLabel(withdrawMethod)} · ${withdrawPhone}`} onEdit={() => setFlowStep(2)} />
          </div>

          {withdrawFeeSettings?.withdrawFeeEnabled && (
            <FlowCheckbox checked={withdrawFeeOnTop} onChange={setWithdrawFeeOnTop}>
              <span className="font-bold">Payer les frais en plus</span>
              <span className="block text-muted-foreground">
                {withdrawFeeOnTop ? 'Frais pris sur votre solde. Vous recevez tout.' : 'Les frais sont retirés du montant reçu.'}
              </span>
            </FlowCheckbox>
          )}
        </FlowScreen>
      )}

      {walletFlow === 'withdraw' && flowStep === 4 && (
        <FlowScreen
          title="Retirer"
          step={4}
          totalSteps={4}
          heading="Entrez votre code PIN"
          desc={`${fcfa(withdrawBreakdown?.net ?? 0)} vers ${findOperatorLabel(withdrawMethod)} · ${withdrawPhone}`}
          onBack={() => {
            setWithdrawPin('');
            setFlowStep(3);
          }}
          footer={
            <Button
              className="w-full h-12 rounded-xl font-bold text-[15px]"
              onClick={handleConfirmWithdraw}
              disabled={isWithdrawing || withdrawPin.length !== 4}
            >
              {isWithdrawing ? 'Envoi en cours…' : `Retirer ${fcfa(withdrawBreakdown?.net ?? 0)}`}
            </Button>
          }
        >
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            aria-label="Code PIN"
            maxLength={4}
            value={withdrawPin}
            onChange={(e) => setWithdrawPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="rounded-xl h-14 font-mono text-center text-2xl tracking-[0.5em]"
            placeholder="••••"
          />
          <button
            type="button"
            onClick={() => {
              setWithdrawPin('');
              closeWalletFlow();
              setActiveSection('security_pin');
            }}
            className="w-full min-h-11 text-center text-sm font-bold text-primary-ink cursor-pointer"
          >
            Code oublié ?
          </button>
        </FlowScreen>
      )}

      {/* ── MODALE SUPPRESSION DE COMPTE ── */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-danger">Supprimer mon compte</DialogTitle>
            <DialogDescription className="leading-relaxed">
              Cette action est irréversible. Toutes vos données personnelles seront effacées.
            </DialogDescription>
          </DialogHeader>

          {groups.length > 0 ? (
            <div className="p-4 bg-danger-soft text-foreground rounded-2xl text-sm">
              Vous faites partie de <strong>{groups.length} cercle(s) actif(s)</strong>. Vous devez quitter ou solder vos engagements dans vos cercles avant de pouvoir supprimer votre compte.
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Confirmez-vous la fermeture définitive de votre compte eganyé ?
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} className="h-12 rounded-xl font-bold">
              Annuler
            </Button>
            <Button
              disabled={groups.length > 0 || isDeletingAccount}
              onClick={async () => {
                setIsDeletingAccount(true);
                try {
                  // Annonçait la clôture sans rien supprimer : le profil, le
                  // solde et l'historique restaient intacts derrière le message.
                  const { data, error } = await supabase.rpc('request_account_deletion');
                  if (error) throw error;
                  const result = data as { success: boolean; message: string };
                  if (!result.success) {
                    toast.error(result.message);
                    return;
                  }
                  // Les fichiers (pièce d'identité, avatar, vidéos) ne
                  // s'effacent que par l'API Storage, une fois la suppression
                  // acceptée ci-dessus. Un échec ne bloque pas la fermeture
                  // (le profil est déjà anonymisé) : relancer la suppression
                  // est accepté à nouveau par la base et retente l'effacement.
                  try {
                    const purge = await apiFetch('/api/purge-account-files', { method: 'POST' });
                    if (!purge.ok) console.error('Account files purge failed:', purge.status);
                  } catch (purgeErr) {
                    console.error('Account files purge error:', purgeErr);
                  }
                  toast.success(result.message);
                  setShowDeleteConfirm(false);
                  onLogout?.();
                } catch (err: any) {
                  console.error('Account deletion error:', err);
                  toast.error(err.message || 'Impossible de supprimer le compte pour le moment.');
                } finally {
                  setIsDeletingAccount(false);
                }
              }}
              className="h-12 bg-danger hover:bg-danger/90 text-white rounded-xl font-bold"
            >
              {isDeletingAccount ? 'Suppression…' : 'Supprimer mon compte'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
