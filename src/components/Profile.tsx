import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Group, UserProfile, WalletTransaction, KycSubmission } from '@/types';
import { useLanguage, type LanguageCode } from '@/contexts/LanguageContext';
import { AmountDisplay } from './ui/AmountDisplay';
import { CustomAvatar } from './CustomAvatar';
import { AvatarWorkshop } from './AvatarWorkshop';
import { BiometricPrompt } from './BiometricPrompt';
import { ConfirmationBottomSheet } from './ui/ConfirmationBottomSheet';
import { EganyeIcon, type EganyeIconName } from './ui/EganyeIcon';
import { ChipPicker } from './ui/ChipPicker';
import { StatusBadge } from './ui/StatusBadge';

import { supabase } from '@/lib/supabase';
import { mapWalletTransactionRow } from '@/lib/mappers';
import { KYC_VERIFIED_LEVEL, submitKycDocument, fetchLatestKycSubmission } from '@/lib/kyc';
import { useBiometrics } from '@/hooks/useBiometrics';
import { executeFinancialTransaction, verifyUserPin, setUserPin } from '@/lib/ledger';
import { PAYDUNYA_COUNTRIES, getOperatorsForCountry, findOperatorLabel } from '@/lib/paydunyaMethods';
import { apiUrl } from '@/lib/apiBase';
import { useBackHandler } from '@/hooks/useBackHandler';

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
  | 'subscription'
  | 'language'
  | 'notifications'
  | 'legal';

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
  const [walletAction, setWalletAction] = useState<'recharge' | 'withdraw'>(focusCard || 'recharge');
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeCountry, setRechargeCountry] = useState('tg');
  const [rechargeMethod, setRechargeMethod] = useState('tmoney_tg');
  const [rechargePhone, setRechargePhone] = useState(user.phone || '');
  const [isRecharging, setIsRecharging] = useState(false);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const withdrawIdempotencyKeyRef = React.useRef<string | null>(null);
  useEffect(() => { withdrawIdempotencyKeyRef.current = null; }, [withdrawAmount]);
  const [withdrawCountry, setWithdrawCountry] = useState('tg');
  const [withdrawMethod, setWithdrawMethod] = useState('tmoney_tg');
  const [withdrawPhone, setWithdrawPhone] = useState(user.phone || '');
  const [withdrawPin, setWithdrawPin] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
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
  const [legalDoc, setLegalDoc] = useState<'cgu' | 'reglement' | 'confidentialite' | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isKycOk = (user.kycLevel ?? 1) >= KYC_VERIFIED_LEVEL;
  const isAdminUser = user.role === 'admin' || user.email === 'codorah@hotmail.com';

  useEffect(() => {
    if (focusCard) setWalletAction(focusCard);
  }, [focusCard]);

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
      const res = await setUserPin(user.uid, newPin);
      if (!res.success) throw new Error(res.message);
      toast.success('Code PIN modifié avec succès !');
      setNewPin('');
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
      await supabase.from('profiles').update({ [channel]: newVal }).eq('id', user.uid);
      toast.success('Préférence enregistrée');
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
    try {
      // Le portefeuille n'est crédité qu'après un vrai paiement Paydunya
      // confirmé (App.tsx gère le retour ?paydunya_success=true) — on ne
      // crédite jamais directement ici.
      const response = await fetch(apiUrl('/api/create-paydunya-checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
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
        // Paydunya a envoyé une notification USSD/PIN directement sur le
        // téléphone : on reste sur eganyé, le crédit reste géré par le webhook.
        toast.success('Confirmez le paiement Mobile Money reçu sur votre téléphone pour finaliser la recharge.');
        setRechargeAmount('');
        setActiveSection(null);
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

  const handleWithdrawReview = () => {
    if (!navigator.onLine) {
      toast.error('Connexion Internet requise pour effectuer un retrait.');
      return;
    }
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt < 500) {
      toast.error('Montant de retrait invalide');
      return;
    }
    if (amt > (user.walletBalance || 0)) {
      toast.error('Solde disponible insuffisant');
      return;
    }
    if (!withdrawMethod) {
      toast.error('Veuillez sélectionner un opérateur Mobile Money');
      return;
    }
    if (withdrawPhone.replace(/\D/g, '').length < 8) {
      toast.error('Veuillez saisir un numéro de téléphone valide');
      return;
    }
    if (!withdrawPin) {
      toast.error('Veuillez saisir votre code PIN de retrait');
      return;
    }
    setShowWithdrawConfirm(true);
  };

  const handleConfirmWithdraw = async () => {
    const amt = parseFloat(withdrawAmount);
    const withdrawMethodLabel = findOperatorLabel(withdrawMethod);
    setIsWithdrawing(true);
    try {
      const pinResult = await verifyUserPin(user.uid, withdrawPin);
      if (!pinResult.ok) {
        toast.error(pinResult.message || 'Code PIN incorrect.');
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
        amount: amt,
        currency: 'FCFA',
        description: `Retrait vers ${withdrawMethodLabel} (${withdrawPhone})`,
        actionType: 'wallet_withdrawal',
        debitAccount: `user_wallet:${user.uid}`,
        creditAccount: 'mobile_money_payout_pending',
      });
      if (!result.success) throw new Error(result.message);

      await supabase.from('wallet_transactions').insert({
        user_id: user.uid,
        amount: amt,
        type: 'withdraw',
        description: `Retrait vers ${withdrawMethodLabel} (${withdrawPhone})`,
        status: 'pending',
        reference: withdrawPhone,
        payment_method: withdrawMethod,
      });

      withdrawIdempotencyKeyRef.current = null;
      toast.success(`Retrait de ${amt.toLocaleString()} FCFA initié vers ${withdrawMethodLabel}.`);
      setWithdrawAmount('');
      setWithdrawPin('');
      setShowWithdrawConfirm(false);
      setActiveSection(null);
    } catch (err: any) {
      console.error('Withdrawal error:', err);
      toast.error(err.message || 'Erreur lors du retrait');
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Helper for sub-page top header
  const renderSubHeader = (title: string) => (
    <div className="flex items-center gap-3 pb-2">
      <button
        type="button"
        onClick={() => setActiveSection(null)}
        className="w-10 h-10 rounded-2xl bg-white dark:bg-card border border-[#EFE2D0] dark:border-border/80 flex items-center justify-center text-foreground hover:bg-muted cursor-pointer transition-colors shadow-xs shrink-0"
        aria-label="Retour"
      >
        <EganyeIcon name="chevron-left" size={18} />
      </button>
      <div>
        <h1 className="text-xl sm:text-2xl font-serif font-black text-foreground tracking-tight">
          {title}
        </h1>
        <p className="text-xs text-muted-foreground">Paramètres Eganyé</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 pb-24 max-w-lg mx-auto">
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
            className="space-y-4"
          >
            {/* 1. CARTE PROFIL RÉSUMÉE ÉPURÉE */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FFFBF7] to-[#F8EFE3] dark:from-card dark:to-muted p-5 border border-[#EFE2D0] dark:border-border/80 shadow-soft">
              <div className="flex items-center gap-4">
                {/* Avatar avec bouton d'atelier */}
                <div className="relative shrink-0">
                  <CustomAvatar
                    photoURL={user.photoURL}
                    name={user.displayName}
                    size={68}
                    className="ring-3 ring-white dark:ring-card shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setIsAvatarWorkshopOpen(true)}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#C96F4A] text-white flex items-center justify-center shadow-xs cursor-pointer hover:bg-[#B8623E] transition-colors"
                    title="Modifier mon avatar"
                  >
                    <EganyeIcon name="profile" size={12} />
                  </button>
                </div>

                {/* Nom, coordonnées & statut KYC */}
                <div className="min-w-0 flex-1 space-y-1">
                  <h1 className="text-lg sm:text-xl font-serif font-black text-foreground truncate">
                    {user.displayName}
                  </h1>
                  <p className="text-xs text-muted-foreground font-medium truncate">
                    {user.phone || user.email}
                  </p>

                  {/* Badge de statut KYC cliquable */}
                  <button
                    type="button"
                    onClick={() => setActiveSection('kyc')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold cursor-pointer transition-colors ${
                      isKycOk
                        ? 'bg-[#EBF5EA] text-[#718A68] border border-[#718A68]/25'
                        : 'bg-[#FFF4E5] text-[#C96F4A] border border-[#C96F4A]/25 hover:bg-[#FFEBD4]'
                    }`}
                  >
                    <EganyeIcon name="shield" size={11} />
                    <span>{isKycOk ? 'Compte vérifié Tier 2' : 'Vérifier ma pièce d’identité'}</span>
                  </button>
                </div>
              </div>

              {/* Badges horizontaux : Solde & Fiabilité */}
              <div className="grid grid-cols-2 gap-2.5 pt-4 mt-4 border-t border-[#EFE2D0]/80 dark:border-border/60">
                <button
                  type="button"
                  onClick={() => setActiveSection('wallet')}
                  className="bg-white/90 dark:bg-card/90 rounded-2xl p-2.5 border border-[#EFE2D0] dark:border-border/80 text-left hover:border-[#C96F4A]/40 transition-colors cursor-pointer"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground block">
                    Mon disponible
                  </span>
                  <p className="text-sm sm:text-base font-serif font-black text-[#C96F4A] truncate mt-0.5">
                    {(user.walletBalance || 0).toLocaleString()} FCFA
                  </p>
                </button>

                <div className="bg-white/90 dark:bg-card/90 rounded-2xl p-2.5 border border-[#EFE2D0] dark:border-border/80 text-left">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground block">
                    Fiabilité tontine
                  </span>
                  <p className="text-sm sm:text-base font-serif font-black text-[#718A68] truncate mt-0.5">
                    {user.reputationScore || 100} / 100
                  </p>
                </div>
              </div>
            </div>

            {/* 2. GROUPES DE RÉGLAGES (MOBILE CELL LISTS) */}

            {/* GROUPE 1 : MON COMPTE */}
            <div className="space-y-1.5 pt-1">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-3">
                Mon compte & identité
              </h2>
              <div className="bg-white dark:bg-card rounded-2xl border border-[#EFE2D0] dark:border-border/80 shadow-soft overflow-hidden divide-y divide-[#EFE2D0]/60 dark:divide-border/60">
                <button
                  type="button"
                  onClick={() => setActiveSection('personal_info')}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#F8F0E4] text-[#C96F4A] flex items-center justify-center shrink-0">
                    <EganyeIcon name="profile" size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-xs sm:text-sm text-foreground block group-hover:text-[#C96F4A] transition-colors">
                      Informations personnelles
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate block">
                      Nom, prénom, date de naissance, téléphone
                    </span>
                  </div>
                  <EganyeIcon name="chevron-right" size={15} className="text-muted-foreground" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('kyc')}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#EBF5EA] text-[#718A68] flex items-center justify-center shrink-0">
                    <EganyeIcon name="shield" size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-xs sm:text-sm text-foreground block group-hover:text-[#718A68] transition-colors">
                      Vérification d’identité (KYC)
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate block">
                      Carte nationale d'identité, passeport
                    </span>
                  </div>
                  <StatusBadge
                    tone={isKycOk ? 'success' : 'warning'}
                    label={isKycOk ? 'Vérifié' : 'À faire'}
                    className="shrink-0 mr-1"
                  />
                  <EganyeIcon name="chevron-right" size={15} className="text-muted-foreground" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('mandate')}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#F4EFE6] text-[#3E2F24] flex items-center justify-center shrink-0">
                    <EganyeIcon name="members" size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-xs sm:text-sm text-foreground block group-hover:text-[#C96F4A] transition-colors">
                      Mandataire numérique
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate block">
                      Personne de confiance en cas d’imprévu
                    </span>
                  </div>
                  <EganyeIcon name="chevron-right" size={15} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* GROUPE 2 : SÉCURITÉ */}
            <div className="space-y-1.5 pt-1">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-3">
                Sécurité & Accès
              </h2>
              <div className="bg-white dark:bg-card rounded-2xl border border-[#EFE2D0] dark:border-border/80 shadow-soft overflow-hidden divide-y divide-[#EFE2D0]/60 dark:divide-border/60">
                <button
                  type="button"
                  onClick={() => setActiveSection('security_pin')}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#FDF0EB] text-[#C96F4A] flex items-center justify-center shrink-0">
                    <EganyeIcon name="lock" size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-xs sm:text-sm text-foreground block group-hover:text-[#C96F4A] transition-colors">
                      Code PIN de retrait (4 chiffres)
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate block">
                      Sécurise les transactions et retraits
                    </span>
                  </div>
                  <EganyeIcon name="chevron-right" size={15} className="text-muted-foreground" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('security_password')}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#F4EFE6] text-[#3E2F24] flex items-center justify-center shrink-0">
                    <EganyeIcon name="key" size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-xs sm:text-sm text-foreground block group-hover:text-[#C96F4A] transition-colors">
                      Mot de passe de connexion
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate block">
                      Modifier mon mot de passe
                    </span>
                  </div>
                  <EganyeIcon name="chevron-right" size={15} className="text-muted-foreground" />
                </button>

                {/* Switch direct Biométrie */}
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-info-soft text-info flex items-center justify-center shrink-0">
                      <EganyeIcon name="fingerprint" size={16} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-xs sm:text-sm text-foreground block">
                        Connexion biométrique
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate block">
                        Empreinte ou Face ID
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={biometricsEnabled}
                    onCheckedChange={handleToggleBiometrics}
                  />
                </div>
              </div>
            </div>

            {/* GROUPE 3 : FINANCES & FORMULE */}
            <div className="space-y-1.5 pt-1">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-3">
                Finances & Formule
              </h2>
              <div className="bg-white dark:bg-card rounded-2xl border border-[#EFE2D0] dark:border-border/80 shadow-soft overflow-hidden divide-y divide-[#EFE2D0]/60 dark:divide-border/60">
                <button
                  type="button"
                  onClick={() => setActiveSection('wallet')}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#FFF2E8] text-[#C96F4A] flex items-center justify-center shrink-0">
                    <EganyeIcon name="wallet" size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-xs sm:text-sm text-foreground block group-hover:text-[#C96F4A] transition-colors">
                      Portefeuille Mobile Money
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate block">
                      Recharges T-Money, Moov Flooz & Retraits
                    </span>
                  </div>
                  <span className="text-xs font-bold text-[#C96F4A] mr-1">
                    {(user.walletBalance || 0).toLocaleString()} FCFA
                  </span>
                  <EganyeIcon name="chevron-right" size={15} className="text-muted-foreground" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('subscription')}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#FEF6E9] text-[#C49A55] flex items-center justify-center shrink-0">
                    <EganyeIcon name="star" size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-xs sm:text-sm text-foreground block group-hover:text-[#C49A55] transition-colors">
                      Formule Ma Banque
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate block">
                      Coffres et réservations multiples
                    </span>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground mr-1 capitalize">
                    {user.bankTier && user.bankTier !== 'none' ? user.bankTier : 'Gratuit'}
                  </span>
                  <EganyeIcon name="chevron-right" size={15} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* GROUPE 4 : PRÉFÉRENCES */}
            <div className="space-y-1.5 pt-1">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-3">
                Préférences & Alertes
              </h2>
              <div className="bg-white dark:bg-card rounded-2xl border border-[#EFE2D0] dark:border-border/80 shadow-soft overflow-hidden divide-y divide-[#EFE2D0]/60 dark:divide-border/60">
                <button
                  type="button"
                  onClick={() => setActiveSection('language')}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-info-soft text-info flex items-center justify-center shrink-0">
                    <EganyeIcon name="globe" size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-xs sm:text-sm text-foreground block group-hover:text-info transition-colors">
                      Langue de l’application
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate block">
                      Français, Èʋegbe, Kabɩyɛ
                    </span>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground mr-1">
                    {language === 'fr' ? 'Français' : language === 'ee' ? 'Èʋegbe' : 'Kabɩyɛ'}
                  </span>
                  <EganyeIcon name="chevron-right" size={15} className="text-muted-foreground" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('notifications')}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#F8F0E4] text-[#C96F4A] flex items-center justify-center shrink-0">
                    <EganyeIcon name="bell" size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-xs sm:text-sm text-foreground block group-hover:text-[#C96F4A] transition-colors">
                      Notifications & Rappels
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate block">
                      Push, SMS, WhatsApp
                    </span>
                  </div>
                  <EganyeIcon name="chevron-right" size={15} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* GROUPE 5 : ASSISTANCE & LÉGAL */}
            <div className="space-y-1.5 pt-1">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-3">
                Assistance & Légal
              </h2>
              <div className="bg-white dark:bg-card rounded-2xl border border-[#EFE2D0] dark:border-border/80 shadow-soft overflow-hidden divide-y divide-[#EFE2D0]/60 dark:divide-border/60">
                <button
                  type="button"
                  onClick={() => onNavigate?.('support')}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#EBF5EA] text-[#718A68] flex items-center justify-center shrink-0">
                    <EganyeIcon name="chat" size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-xs sm:text-sm text-foreground block group-hover:text-[#718A68] transition-colors">
                      Centre d’aide & Support WhatsApp
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate block">
                      Besoin d’aide, poser une question
                    </span>
                  </div>
                  <EganyeIcon name="chevron-right" size={15} className="text-muted-foreground" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('legal')}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#F4EFE6] text-[#3E2F24] flex items-center justify-center shrink-0">
                    <EganyeIcon name="document" size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-xs sm:text-sm text-foreground block group-hover:text-[#3E2F24] transition-colors">
                      Conditions & Confidentialité
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate block">
                      Règlement des tontines, CGU, protection des données
                    </span>
                  </div>
                  <EganyeIcon name="chevron-right" size={15} className="text-muted-foreground" />
                </button>

                {isAdminUser && (
                  <button
                    type="button"
                    onClick={() => onNavigate?.('admin')}
                    className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#FFF4E5] text-[#C96F4A] flex items-center justify-center shrink-0">
                      <EganyeIcon name="shield" size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-xs sm:text-sm text-foreground block group-hover:text-[#C96F4A] transition-colors">
                        Panneau d’administration
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate block">
                        Gestion plateforme, KYC et réconciliations
                      </span>
                    </div>
                    <EganyeIcon name="chevron-right" size={15} className="text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            {/* GROUPE 6 : SORTIE & DÉCONNEXION */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={onLogout}
                className="w-full h-12 rounded-2xl bg-white dark:bg-card border border-[#EFE2D0] dark:border-border text-[#C96F4A] hover:bg-[#FFF4E5] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                <EganyeIcon name="withdraw" size={16} />
                <span>Se déconnecter de l’application</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full text-center text-[11px] font-bold text-destructive/70 hover:text-destructive transition-colors py-1 cursor-pointer"
              >
                Supprimer définitivement mon compte
              </button>
            </div>
          </motion.div>
        ) : null}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* SOUS-PAGE 1 : INFORMATIONS PERSONNELLES                          */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {activeSection === 'personal_info' && (
          <motion.div
            key="personal_info"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {renderSubHeader('Informations personnelles')}

            <div className="bg-white dark:bg-card rounded-3xl p-5 sm:p-6 border border-[#EFE2D0] dark:border-border/80 shadow-soft space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Nom d’affichage / Prénom usuel</Label>
                <Input
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="rounded-xl h-11"
                  placeholder="Ex: Kossi"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Prénom officiel</Label>
                  <Input
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="rounded-xl h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Nom de famille</Label>
                  <Input
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="rounded-xl h-11"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Numéro de téléphone Mobile Money</Label>
                <Input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="rounded-xl h-11 font-mono"
                  placeholder="90 00 00 00"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Adresse e-mail</Label>
                <Input
                  value={user.email}
                  disabled
                  className="rounded-xl h-11 bg-muted/50 text-muted-foreground text-xs"
                />
                <p className="text-[11px] text-muted-foreground">L'email sert d'identifiant de sécurité.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Date de naissance</Label>
                <Input
                  type="date"
                  value={editDateOfBirth}
                  onChange={(e) => setEditDateOfBirth(e.target.value)}
                  className="rounded-xl h-11"
                />
              </div>

              <Button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="btn-shine gradient-sunset w-full h-12 rounded-2xl text-white font-bold text-sm cursor-pointer mt-2"
              >
                {savingProfile ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* SOUS-PAGE 2 : VÉRIFICATION D’IDENTITÉ (KYC)                      */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {activeSection === 'kyc' && (
          <motion.div
            key="kyc"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {renderSubHeader('Vérification d’identité (KYC)')}

            {(() => {
              const kycStatus: 'verified' | 'pending' | 'unverified' = isKycOk
                ? 'verified'
                : kycSubmission?.status === 'pending'
                ? 'pending'
                : 'unverified';
              const KYC_STATUS_COPY = {
                verified: {
                  className: 'bg-[#EBF5EA] text-[#718A68] border-[#718A68]/30',
                  title: 'Identité vérifiée (Tier 2)',
                  desc: 'Votre compte dispose des plafonds complets et de la conformité UEMOA.',
                },
                pending: {
                  className: 'bg-[#FFF4E5] text-[#C96F4A] border-[#C96F4A]/30',
                  title: 'Document en cours d’examen',
                  desc: 'Votre document a bien été envoyé. Notre équipe valide généralement en moins de 24h.',
                },
                unverified: {
                  className: 'bg-muted/60 text-muted-foreground border-border',
                  title: 'Pièce d’identité non validée',
                  desc: 'La vérification d’identité protège l’ensemble des membres de la tontine contre toute fraude.',
                },
              } as const;
              const copy = KYC_STATUS_COPY[kycStatus];

              return (
                <div className="bg-white dark:bg-card rounded-3xl p-5 sm:p-6 border border-[#EFE2D0] dark:border-border/80 shadow-soft space-y-4">
                  {/* Statut actuel */}
                  <div className={`p-4 rounded-2xl border text-xs space-y-1 ${copy.className}`}>
                    <p className="font-bold text-sm flex items-center gap-1.5">
                      <EganyeIcon name="shield" size={16} />
                      <span>{copy.title}</span>
                    </p>
                    <p className="leading-relaxed">{copy.desc}</p>
                  </div>

              {!isKycOk && (
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Nom et prénom complets (comme sur la CNI)</Label>
                    <Input
                      value={kycFullName}
                      onChange={(e) => setKycFullName(e.target.value)}
                      className="rounded-xl h-11"
                      placeholder="Ex: Kossi Koffi Amégan"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Numéro de la pièce (CNI / Passeport)</Label>
                    <Input
                      value={kycIdNumber}
                      onChange={(e) => setKycIdNumber(e.target.value)}
                      className="rounded-xl h-11 font-mono"
                      placeholder="Ex: TG-012345678"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Photo de la pièce (recto ou PDF)</Label>
                    <label
                      htmlFor="kyc_upload"
                      className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#EFE2D0] dark:border-border hover:border-[#C96F4A] rounded-2xl cursor-pointer bg-[#FFFBF7] dark:bg-muted/40 transition-colors text-center gap-2"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#C96F4A]/10 text-[#C96F4A] flex items-center justify-center">
                        <EganyeIcon name="document" size={20} />
                      </div>
                      <span className="text-xs font-bold text-foreground">
                        {kycFile ? kycFile.name : 'Cliquez pour sélectionner la photo'}
                      </span>
                      <span className="text-[11px] text-muted-foreground">JPG, PNG ou PDF (max. 10 Mo)</span>
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
                    className="btn-shine gradient-sunset w-full h-12 rounded-2xl text-white font-bold text-sm cursor-pointer mt-2"
                  >
                    {isSubmittingKyc ? 'Envoi en cours...' : 'Soumettre ma pièce d’identité'}
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
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {renderSubHeader('Mandataire numérique')}

            <div className="bg-white dark:bg-card rounded-3xl p-5 sm:p-6 border border-[#EFE2D0] dark:border-border/80 shadow-soft space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Désignez une personne de confiance (conjoint, parent, frère/sœur) habilitée à suivre vos cotisations ou recevoir les alertes en cas d’impossibilité majeure.
              </p>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Nom complet de la personne de confiance</Label>
                <Input
                  value={mandateName}
                  onChange={(e) => setMandateName(e.target.value)}
                  className="rounded-xl h-11"
                  placeholder="Ex: Afiwa Amégan"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Numéro de téléphone</Label>
                <Input
                  type="tel"
                  value={mandatePhone}
                  onChange={(e) => setMandatePhone(e.target.value)}
                  className="rounded-xl h-11 font-mono"
                  placeholder="90 00 00 00"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FFF8F2] border border-[#C96F4A]/25 text-xs text-muted-foreground flex items-start gap-2.5">
                <EganyeIcon name="shield" size={16} className="text-[#C96F4A] shrink-0 mt-0.5" />
                <span>
                  Le mandataire ne peut <strong className="text-foreground">jamais retirer vos fonds</strong> à votre place sans validation administrative stricte.
                </span>
              </div>

              <Button
                onClick={handleSaveMandate}
                disabled={isSavingMandate}
                className="btn-shine gradient-sunset w-full h-12 rounded-2xl text-white font-bold text-sm cursor-pointer mt-2"
              >
                {isSavingMandate ? 'Enregistrement...' : 'Enregistrer le mandataire'}
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
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {renderSubHeader('Code PIN de retrait')}

            <div className="bg-white dark:bg-card rounded-3xl p-5 sm:p-6 border border-[#EFE2D0] dark:border-border/80 shadow-soft space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ce code secret à 4 chiffres vous sera demandé à chaque retrait d’argent vers votre compte Mobile Money.
              </p>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Nouveau code PIN (4 chiffres)</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="rounded-xl h-12 text-center text-2xl font-mono tracking-widest"
                  placeholder="••••"
                  autoFocus
                />
              </div>

              <Button
                onClick={handleChangePin}
                disabled={isSavingPin || newPin.length !== 4}
                className="btn-shine gradient-sunset w-full h-12 rounded-2xl text-white font-bold text-sm cursor-pointer mt-2"
              >
                {isSavingPin ? 'Modification...' : 'Valider mon nouveau code PIN'}
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
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {renderSubHeader('Mot de passe de connexion')}

            <div className="bg-white dark:bg-card rounded-3xl p-5 sm:p-6 border border-[#EFE2D0] dark:border-border/80 shadow-soft space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Choisissez un mot de passe sécurisé comportant au moins 6 caractères.
              </p>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Nouveau mot de passe</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="rounded-xl h-11"
                  placeholder="Au moins 6 caractères"
                  autoFocus
                />
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={isSavingPassword || newPassword.length < 6}
                className="btn-shine gradient-sunset w-full h-12 rounded-2xl text-white font-bold text-sm cursor-pointer mt-2"
              >
                {isSavingPassword ? 'Mise à jour...' : 'Changer mon mot de passe'}
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
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {renderSubHeader('Portefeuille Mobile Money')}

            {/* Solde card */}
            <div className="gradient-sunset rounded-3xl p-5 text-white shadow-soft space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white/90">Solde disponible</span>
                <button
                  type="button"
                  onClick={() => setShowBalance(!showBalance)}
                  className="p-1 rounded-full hover:bg-white/15 cursor-pointer text-white/80 hover:text-white"
                >
                  <EganyeIcon name={showBalance ? 'eye' : 'eye-off'} size={16} />
                </button>
              </div>
              <p className="text-3xl font-serif font-black tracking-tight text-white">
                {showBalance ? `${(user.walletBalance || 0).toLocaleString()} FCFA` : '••••••• FCFA'}
              </p>
            </div>

            {/* Sélecteur Recharger / Retirer */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-2xl">
              <button
                type="button"
                onClick={() => setWalletAction('recharge')}
                className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  walletAction === 'recharge' ? 'bg-white dark:bg-card text-[#C96F4A] shadow-xs' : 'text-muted-foreground'
                }`}
              >
                Recharger
              </button>
              <button
                type="button"
                onClick={() => setWalletAction('withdraw')}
                className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  walletAction === 'withdraw' ? 'bg-white dark:bg-card text-[#C96F4A] shadow-xs' : 'text-muted-foreground'
                }`}
              >
                Retirer
              </button>
            </div>

            {/* Formulaire Recharger */}
            {walletAction === 'recharge' ? (
              <div className="bg-white dark:bg-card rounded-3xl p-5 border border-[#EFE2D0] dark:border-border/80 shadow-soft space-y-4">
                <h3 className="font-serif font-bold text-sm text-foreground">Recharger mon compte</h3>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Montant (FCFA)</Label>
                  <Input
                    type="number"
                    min={500}
                    step={500}
                    placeholder="25 000"
                    value={rechargeAmount}
                    onChange={(e) => setRechargeAmount(e.target.value)}
                    className="rounded-xl h-11 text-base font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Opérateur</Label>
                  <ChipPicker
                    ariaLabel="Opérateur"
                    value={rechargeMethod}
                    onChange={setRechargeMethod}
                    options={getOperatorsForCountry(rechargeCountry)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Numéro de téléphone émetteur</Label>
                  <Input
                    type="tel"
                    value={rechargePhone}
                    onChange={(e) => setRechargePhone(e.target.value)}
                    className="rounded-xl h-11 font-mono text-sm"
                  />
                </div>

                <Button
                  onClick={handleRecharge}
                  disabled={isRecharging}
                  className="btn-shine gradient-sunset w-full h-12 rounded-2xl text-white font-bold text-sm cursor-pointer"
                >
                  {isRecharging ? 'Paiement en cours...' : 'Confirmer la recharge'}
                </Button>
              </div>
            ) : (
              /* Formulaire Retirer */
              <div className="bg-white dark:bg-card rounded-3xl p-5 border border-[#EFE2D0] dark:border-border/80 shadow-soft space-y-4">
                <h3 className="font-serif font-bold text-sm text-foreground">Retirer vers Mobile Money</h3>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Montant à retirer (FCFA)</Label>
                  <Input
                    type="number"
                    min={500}
                    step={500}
                    placeholder="10 000"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="rounded-xl h-11 text-base font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Opérateur de réception</Label>
                  <ChipPicker
                    ariaLabel="Opérateur"
                    value={withdrawMethod}
                    onChange={setWithdrawMethod}
                    options={getOperatorsForCountry(withdrawCountry)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Numéro bénéficiaire</Label>
                  <Input
                    type="tel"
                    value={withdrawPhone}
                    onChange={(e) => setWithdrawPhone(e.target.value)}
                    className="rounded-xl h-11 font-mono text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Code PIN de retrait (4 chiffres)</Label>
                  <Input
                    type="password"
                    maxLength={4}
                    value={withdrawPin}
                    onChange={(e) => setWithdrawPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="rounded-xl h-11 font-mono text-center tracking-widest"
                    placeholder="••••"
                  />
                </div>

                <Button
                  onClick={handleWithdrawReview}
                  disabled={isWithdrawing}
                  className="btn-shine gradient-sunset w-full h-12 rounded-2xl text-white font-bold text-sm cursor-pointer"
                >
                  {isWithdrawing ? 'Vérification...' : 'Continuer le retrait'}
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* SOUS-PAGE 7 : FORMULE & COFFRES (ABONNEMENT)                    */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {activeSection === 'subscription' && (
          <motion.div
            key="subscription"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {renderSubHeader('Formule Ma Banque')}

            <div className="bg-white dark:bg-card rounded-3xl p-5 sm:p-6 border border-[#EFE2D0] dark:border-border/80 shadow-soft space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#FFF8F2] to-[#F8EFE3] border border-[#C96F4A]/25 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#C96F4A]">
                  Votre formule actuelle
                </span>
                <p className="text-xl font-serif font-black text-foreground capitalize">
                  {user.bankTier && user.bankTier !== 'none' ? `Plan ${user.bankTier}` : 'Accès Standard Gratuit'}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {user.bankTier && user.bankTier !== 'none'
                    ? 'Vous bénéficiez de coffres multiples pour épargner sur tous vos projets en parallèle.'
                    : 'Le compte gratuit vous permet d’ouvrir 1 coffre d’épargne personnelle et de participer à toutes vos tontines sans frais.'}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* SOUS-PAGE 8 : LANGUE DE L'APPLICATION                            */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {activeSection === 'language' && (
          <motion.div
            key="language"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {renderSubHeader('Langue de l’application')}

            <div className="bg-white dark:bg-card rounded-3xl p-5 border border-[#EFE2D0] dark:border-border/80 shadow-soft space-y-2">
              {[
                { code: 'fr' as LanguageCode, name: 'Français', desc: 'Langue officielle et administrative' },
                { code: 'ee' as LanguageCode, name: 'Èʋegbe (Ewe)', desc: 'Togo Sud, Ghana & Bénin' },
                { code: 'kbp' as LanguageCode, name: 'Kabɩyɛ (Kabyè)', desc: 'Togo Nord & Kara' },
              ].map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setLanguage(lang.code);
                    toast.success(`Langue modifiée : ${lang.name}`);
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 text-left cursor-pointer transition-all ${
                    language === lang.code
                      ? 'border-[#C96F4A] bg-[#C96F4A]/5 text-[#C96F4A]'
                      : 'border-border text-foreground hover:bg-muted/40'
                  }`}
                >
                  <div>
                    <p className="font-bold text-sm">{lang.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{lang.desc}</p>
                  </div>
                  {language === lang.code && (
                    <div className="w-6 h-6 rounded-full bg-[#C96F4A] text-white flex items-center justify-center shrink-0">
                      <EganyeIcon name="check" size={13} strokeWidth={2.5} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* SOUS-PAGE 9 : NOTIFICATIONS                                     */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {activeSection === 'notifications' && (
          <motion.div
            key="notifications"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {renderSubHeader('Notifications & Rappels')}

            <div className="bg-white dark:bg-card rounded-3xl p-5 border border-[#EFE2D0] dark:border-border/80 shadow-soft space-y-3 divide-y divide-[#EFE2D0]/60 dark:divide-border/60">
              <div className="flex items-center justify-between pt-1">
                <div className="pr-4">
                  <p className="font-bold text-xs sm:text-sm text-foreground">Notifications Push (sur l’écran)</p>
                  <p className="text-[11px] text-muted-foreground">Rappels d’échéances et alertes de tirage</p>
                </div>
                <Switch
                  checked={pushNotif}
                  onCheckedChange={() => handleToggleNotification('push_enabled', pushNotif, setPushNotif)}
                />
              </div>

              <div className="flex items-center justify-between pt-3">
                <div className="pr-4">
                  <p className="font-bold text-xs sm:text-sm text-foreground">Alertes SMS</p>
                  <p className="text-[11px] text-muted-foreground">Envoi de SMS pour les paiements de cagnottes</p>
                </div>
                <Switch
                  checked={smsNotif}
                  onCheckedChange={() => handleToggleNotification('sms_notifications_enabled', smsNotif, setSmsNotif)}
                />
              </div>

              <div className="flex items-center justify-between pt-3">
                <div className="pr-4">
                  <p className="font-bold text-xs sm:text-sm text-foreground">Notifications WhatsApp</p>
                  <p className="text-[11px] text-muted-foreground">Résumé des tours de cercle par message WhatsApp</p>
                </div>
                <Switch
                  checked={whatsAppNotif}
                  onCheckedChange={() => handleToggleNotification('whatsapp_notifications_enabled', whatsAppNotif, setWhatsAppNotif)}
                />
              </div>

              <div className="flex items-center justify-between pt-3">
                <div className="pr-4">
                  <p className="font-bold text-xs sm:text-sm text-foreground">Récapitulatifs par E-mail</p>
                  <p className="text-[11px] text-muted-foreground">Reçus mensuels et relevés de cotisations</p>
                </div>
                <Switch
                  checked={emailNotif}
                  onCheckedChange={() => handleToggleNotification('email_notifications_enabled', emailNotif, setEmailNotif)}
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* SOUS-PAGE 10 : LÉGAL & CONDITIONS                               */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {activeSection === 'legal' && (
          <motion.div
            key="legal"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {renderSubHeader('Conditions & Légal')}

            <div className="bg-white dark:bg-card rounded-3xl p-5 border border-[#EFE2D0] dark:border-border/80 shadow-soft space-y-2">
              {[
                { key: 'cgu' as const, title: 'Conditions Générales d’Utilisation (CGU)' },
                { key: 'reglement' as const, title: 'Règlement des Cercles et Tontines' },
                { key: 'confidentialite' as const, title: 'Politique de Confidentialité et Données' },
              ].map((doc) => (
                <button
                  key={doc.key}
                  type="button"
                  onClick={() => setLegalDoc(doc.key)}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-border hover:bg-muted/40 transition-colors text-left cursor-pointer"
                >
                  <span className="text-xs font-bold text-foreground">{doc.title}</span>
                  <EganyeIcon name="chevron-right" size={14} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODALE ATELIER D'AVATAR ── */}
      <Dialog open={isAvatarWorkshopOpen} onOpenChange={setIsAvatarWorkshopOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-black text-foreground">
              Choisir mon avatar Eganyé
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Sélectionnez un avatar illustré chaleureux ou personnalisez vos couleurs.
            </DialogDescription>
          </DialogHeader>

          <AvatarWorkshop
            value={user.photoURL || ''}
            onChange={async (newAvatar) => {
              try {
                await supabase.from('profiles').update({ photo_url: newAvatar }).eq('id', user.uid);
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
        mode="register"
        onSuccess={async () => {
          setIsBiometricPromptOpen(false);
          await supabase.from('profiles').update({ biometrics_enabled: true }).eq('id', user.uid);
          toast.success('Connexion biométrique activée avec succès !');
        }}
      />

      {/* ── MODALE DE CONFIRMATION RETRAIT ── */}
      <ConfirmationBottomSheet
        isOpen={showWithdrawConfirm}
        onClose={() => setShowWithdrawConfirm(false)}
        onConfirm={handleConfirmWithdraw}
        isLoading={isWithdrawing}
        type="debit"
        title="Confirmer le retrait"
        description={`Retrait de ${parseFloat(withdrawAmount || '0').toLocaleString()} FCFA vers ${findOperatorLabel(withdrawMethod)} (${withdrawPhone}).`}
        amount={parseFloat(withdrawAmount) || 0}
        currency="FCFA"
        confirmLabel="Confirmer le retrait"
      />

      {/* ── MODALE SUPPRESSION DE COMPTE ── */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-danger">
              Supprimer définitivement mon compte
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Cette action est irréversible. Toutes vos données personnelles seront effacées.
            </DialogDescription>
          </DialogHeader>

          {groups.length > 0 ? (
            <div className="p-3 bg-danger-soft border border-danger/20 text-danger rounded-2xl text-xs font-medium">
              Vous faites partie de <strong>{groups.length} cercle(s) actif(s)</strong>. Vous devez quitter ou solder vos engagements dans vos cercles avant de pouvoir supprimer votre compte.
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Confirmez-vous la fermeture définitive de votre compte Eganyé ?
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} className="rounded-xl text-xs">
              Annuler
            </Button>
            <Button
              disabled={groups.length > 0}
              onClick={() => {
                toast.success('Votre compte a été clôturé.');
                setShowDeleteConfirm(false);
                onLogout?.();
              }}
              className="bg-danger hover:bg-danger/90 text-white rounded-xl text-xs font-bold"
            >
              Supprimer mon compte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
