import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Group, UserProfile, PersonalVault } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { AmountDisplay } from './ui/AmountDisplay';
import { SuccessState } from './ui/SuccessState';
import { ErrorState } from './ui/ErrorState';
import { EganyeIcon, type EganyeIconName } from './ui/EganyeIcon';
import { EganyeIllustration } from './ui/EganyeIllustration';
import { LoadingScreen } from './ui/LoadingScreen';
import { DashboardCharts } from './DashboardCharts';
import {
  BANK_TIER_MAX_VAULTS,
  BANK_TIER_PRICE,
  fetchMyVaults,
  subscribeBankTier,
  createPersonalVault,
  depositToVault,
  withdrawFromVault,
  relockVault,
  deleteEmptyVault,
} from '@/lib/bank';

interface MyBankProps {
  user: UserProfile;
  groups: Group[];
  onNavigate?: (view: string) => void;
}

type BankTier = 'starter' | 'growth' | 'unlimited';
const TIERS: BankTier[] = ['starter', 'growth', 'unlimited'];

type ProjectCategory = 'scolaire' | 'voyage' | 'maison' | 'urgence' | 'commerce' | 'autre';

const PROJECT_CATEGORIES: { id: ProjectCategory; labelKey: string; icon: EganyeIconName; bg: string; color: string }[] = [
  { id: 'scolaire', labelKey: 'bank_project_scolaire', icon: 'studies', bg: 'bg-[#EBF5EA]', color: 'text-[#718A68]' },
  { id: 'voyage', labelKey: 'bank_project_voyage', icon: 'travel', bg: 'bg-[#EAF2F8]', color: 'text-[#3D7099]' },
  { id: 'maison', labelKey: 'bank_project_maison', icon: 'house', bg: 'bg-[#FFF2E8]', color: 'text-[#C96F4A]' },
  { id: 'urgence', labelKey: 'bank_project_urgence', icon: 'shield', bg: 'bg-[#FDF0EB]', color: 'text-[#C96F4A]' },
  { id: 'commerce', labelKey: 'bank_project_commerce', icon: 'coin', bg: 'bg-[#F4EFE6]', color: 'text-[#3E2F24]' },
  { id: 'autre', labelKey: 'bank_project_autre', icon: 'savings', bg: 'bg-[#F4EFE6]', color: 'text-[#3E2F24]' },
];

export function MyBank({ user, groups, onNavigate }: MyBankProps) {
  const { t } = useLanguage();
  const [vaults, setVaults] = useState<PersonalVault[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [subscribing, setSubscribing] = useState<BankTier | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [showBalance, setShowBalance] = useState(true);
  const [showAllReservations, setShowAllReservations] = useState(false);

  // Quick Recharge Modal
  const [rechargeModalOpen, setRechargeModalOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState('25000');
  const [rechargeMethod, setRechargeMethod] = useState<'tmoney' | 'flooz'>('tmoney');
  const [rechargePhone, setRechargePhone] = useState(user.phone || '');
  const [isRecharging, setIsRecharging] = useState(false);

  // Quick Withdraw Modal
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('10000');
  const [withdrawMethod, setWithdrawMethod] = useState<'tmoney' | 'flooz'>('tmoney');
  const [withdrawPhone, setWithdrawPhone] = useState(user.phone || '');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Creation Flow — 4-step wizard
  const [view, setView] = useState<'list' | 'create'>('list');
  const [createStep, setCreateStep] = useState(1);
  const [createProject, setCreateProject] = useState<ProjectCategory>('scolaire');
  const [createProjectCustom, setCreateProjectCustom] = useState('');
  const [createAmount, setCreateAmount] = useState('100000');
  const [createInitialDeposit, setCreateInitialDeposit] = useState('');
  const [createDeadline, setCreateDeadline] = useState('');
  const [justCreated, setJustCreated] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdVault, setCreatedVault] = useState<PersonalVault | null>(null);
  const CREATE_TOTAL_STEPS = 4;

  // Vault detail & actions
  const [activeVault, setActiveVault] = useState<PersonalVault | null>(null);
  const [actionAmount, setActionAmount] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [showEarlyUnlockConfirm, setShowEarlyUnlockConfirm] = useState(false);

  const hasActiveSubscription = user.bankTier && user.bankTier !== 'none'
    && !!user.bankSubscriptionExpiresAt
    && new Date(user.bankSubscriptionExpiresAt).getTime() > now;
  const maxVaults = hasActiveSubscription ? BANK_TIER_MAX_VAULTS[user.bankTier as string] : 1;
  const canCreateVault = vaults.length < maxVaults;

  const loadVaults = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await fetchMyVaults(user.uid);
      setVaults(data);
    } catch (err) {
      console.error('MyBank loadVaults error:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVaults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSubscribe = async (tier: BankTier) => {
    setSubscribing(tier);
    try {
      const result = await subscribeBankTier(tier);
      if (!result.success) throw new Error(result.message);
      toast.success(result.message);
    } catch (err: any) {
      toast.error(err.message || t('bank_subscribe_error'));
    } finally {
      setSubscribing(null);
    }
  };

  const openCreateFlow = (presetProject?: ProjectCategory, presetAmount?: string) => {
    setCreateStep(1);
    setCreateProject(presetProject || 'scolaire');
    setCreateProjectCustom('');
    setCreateAmount(presetAmount || '100000');
    setCreateInitialDeposit('');
    // Default deadline: 3 months from now
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    setCreateDeadline(d.toISOString().slice(0, 10));
    setJustCreated(false);
    setView('create');
  };

  const closeCreateFlow = () => setView('list');

  const getProjectLabel = () => {
    if (createProject === 'autre') return createProjectCustom.trim() || 'Mon projet personnel';
    const found = PROJECT_CATEGORIES.find((c) => c.id === createProject);
    return found ? t(found.labelKey) || found.id : 'Épargne';
  };

  const handleCreateVault = async () => {
    setCreating(true);
    try {
      const lockDays = Math.max(1, Math.ceil((new Date(createDeadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
      const goalAmount = parseFloat(createAmount) || 0;
      const initialAmt = parseFloat(createInitialDeposit) || 0;

      const result = await createPersonalVault({
        name: getProjectLabel(),
        description: `Objectif : ${goalAmount.toLocaleString()} FCFA`,
        lockDays,
      });
      if (!result.success) throw new Error(result.message);

      // If initial deposit specified and user has sufficient wallet balance, deposit it right away
      if (initialAmt > 0 && result.vaultId && initialAmt <= user.walletBalance) {
        await depositToVault(result.vaultId, initialAmt);
      }

      const freshVaults = await fetchMyVaults(user.uid);
      setVaults(freshVaults);
      setCreatedVault(freshVaults.find((v) => v.id === result.vaultId) || null);
      setJustCreated(true);
      toast.success("Votre épargne a été créée avec succès !");
    } catch (err: any) {
      toast.error(err.message || t('bank_create_error'));
    } finally {
      setCreating(false);
    }
  };

  const handleCreateNextStep = () => {
    if (createStep === 1) {
      if (createProject === 'autre' && !createProjectCustom.trim()) {
        toast.error("Veuillez préciser le nom de votre projet.");
        return;
      }
      setCreateStep(2);
      return;
    }
    if (createStep === 2) {
      const amt = parseFloat(createAmount);
      if (!amt || amt <= 0) {
        toast.error(t('bank_invalid_amount_error') || "Veuillez entrer un montant cible valide.");
        return;
      }
      const initial = parseFloat(createInitialDeposit) || 0;
      if (initial > user.walletBalance) {
        toast.error("Le montant de départ dépasse votre solde disponible.");
        return;
      }
      setCreateStep(3);
      return;
    }
    if (createStep === 3) {
      if (!createDeadline || new Date(createDeadline).getTime() <= Date.now()) {
        toast.error(t('bank_create_deadline_error') || "La date de déblocage doit être ultérieure à aujourd'hui.");
        return;
      }
      setCreateStep(4);
    }
  };

  const handleCreatePrevStep = () => setCreateStep((s) => Math.max(1, s - 1));

  const isUnlocked = (vault: PersonalVault) => new Date(vault.unlockAt).getTime() <= now;

  const handleDeposit = async () => {
    if (!activeVault) return;
    const value = parseFloat(actionAmount);
    if (!value || value <= 0) {
      toast.error(t('bank_invalid_amount_error'));
      return;
    }
    if (value > user.walletBalance) {
      toast.error(t('bank_insufficient_wallet_error'));
      return;
    }
    setActionBusy(true);
    try {
      const result = await depositToVault(activeVault.id, value);
      if (!result.success) throw new Error(result.message);
      toast.success(result.message);
      setActiveVault(null);
      setActionAmount('');
      await loadVaults();
    } catch (err: any) {
      toast.error(err.message || t('bank_deposit_error'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleWithdraw = async (forced = false) => {
    if (!activeVault) return;
    const value = parseFloat(actionAmount);
    if (!value || value <= 0) {
      toast.error(t('bank_invalid_amount_error'));
      return;
    }
    if (value > activeVault.balance) {
      toast.error("Le montant demandé dépasse le solde du coffre.");
      return;
    }

    if (!isUnlocked(activeVault) && !forced) {
      setShowEarlyUnlockConfirm(true);
      return;
    }

    setActionBusy(true);
    try {
      const result = await withdrawFromVault(activeVault.id, value);
      if (!result.success) throw new Error(result.message);
      toast.success(result.message);
      setActiveVault(null);
      setActionAmount('');
      setShowEarlyUnlockConfirm(false);
      await loadVaults();
    } catch (err: any) {
      toast.error(err.message || t('bank_withdraw_error'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleRelock = async (vault: PersonalVault, lockDays: number) => {
    setActionBusy(true);
    try {
      const result = await relockVault(vault.id, lockDays);
      if (!result.success) throw new Error(result.message);
      toast.success(result.message);
      await loadVaults();
      setActiveVault(null);
    } catch (err: any) {
      toast.error(err.message || t('bank_relock_error'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleDelete = async (vault: PersonalVault) => {
    if (vault.balance > 0) {
      toast.error("Veuillez retirer les fonds avant de supprimer ce coffre.");
      return;
    }
    setActionBusy(true);
    try {
      const result = await deleteEmptyVault(vault.id);
      if (!result.success) throw new Error(result.message);
      toast.success(result.message);
      await loadVaults();
      setActiveVault(null);
    } catch (err: any) {
      toast.error(err.message || t('bank_delete_error'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleQuickRecharge = async () => {
    const val = parseFloat(rechargeAmount);
    if (!val || val <= 0) {
      toast.error(t('bank_invalid_amount_error') || 'Veuillez saisir un montant valide.');
      return;
    }
    setIsRecharging(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success(`Demande de recharge de ${val.toLocaleString()} FCFA envoyée vers ${rechargePhone} via ${rechargeMethod === 'tmoney' ? 'T-Money' : 'Moov Flooz'}.`);
      setRechargeModalOpen(false);
    } catch {
      toast.error(t('prof_recharge_error') || 'Erreur lors de la recharge.');
    } finally {
      setIsRecharging(false);
    }
  };

  const handleQuickWithdraw = async () => {
    const val = parseFloat(withdrawAmount);
    if (!val || val <= 0) {
      toast.error("Veuillez saisir un montant valide.");
      return;
    }
    if (val > user.walletBalance) {
      toast.error("Solde disponible insuffisant.");
      return;
    }
    setIsWithdrawing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success(`Demande de retrait de ${val.toLocaleString()} FCFA vers ${withdrawPhone} reçue.`);
      setWithdrawModalOpen(false);
    } catch {
      toast.error("Erreur lors de la demande de retrait.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const getVaultIconInfo = (vaultName: string, description?: string) => {
    const text = `${vaultName} ${description || ''}`.toLowerCase();
    if (text.includes('voyag') || text.includes('trave') || text.includes('vol') || text.includes('vacanc')) {
      return { icon: 'travel' as const, bg: 'bg-[#EAF2F8] text-[#3D7099]' };
    }
    if (text.includes('étud') || text.includes('etud') || text.includes('scol') || text.includes('ecol') || text.includes('univ')) {
      return { icon: 'studies' as const, bg: 'bg-[#EBF5EA] text-[#718A68]' };
    }
    if (text.includes('urgenc') || text.includes('santé') || text.includes('sante') || text.includes('secours') || text.includes('imprévu')) {
      return { icon: 'shield' as const, bg: 'bg-[#FDF0EB] text-[#C96F4A]' };
    }
    if (text.includes('maison') || text.includes('logem') || text.includes('loyer') || text.includes('habit')) {
      return { icon: 'house' as const, bg: 'bg-[#FFF2E8] text-[#C96F4A]' };
    }
    if (text.includes('commerc') || text.includes('affair') || text.includes('boutiqu')) {
      return { icon: 'coin' as const, bg: 'bg-[#F4EFE6] text-[#3E2F24]' };
    }
    return { icon: 'savings' as const, bg: 'bg-[#F4EFE6] text-[#3E2F24]' };
  };

  // Calculations for Total Savings
  const totalSaved = vaults.reduce((sum, v) => sum + (v.balance || 0), 0);
  const totalGoal = vaults.reduce((sum, v) => {
    const match = v.description?.match(/(\d[\d\s]*)/);
    const parsed = match ? parseInt(match[0].replace(/\s/g, ''), 10) : 0;
    return sum + (parsed > 0 ? parsed : Math.max(v.balance * 1.5, 100000));
  }, 0) || 500000;

  const displaySaved = vaults.length > 0 ? totalSaved : 320000;
  const displayGoal = vaults.length > 0 ? (totalGoal > 0 ? totalGoal : 500000) : 500000;
  const progressPercent = Math.min(100, Math.round((displaySaved / displayGoal) * 100));

  const SAMPLE_VAULTS = [
    {
      id: 'sample-1',
      name: 'Voyage',
      icon: 'travel' as const,
      iconBg: 'bg-[#EAF2F8] text-[#3D7099]',
      balance: 120000,
      goal: 300000,
      dateLabel: 'Déblocage : 12 déc. 2026',
      statusLabel: 'En cours',
      statusClass: 'bg-[#FFF4E5] text-[#C96F4A] border border-[#C96F4A]/25',
      project: 'voyage' as const,
    },
    {
      id: 'sample-2',
      name: 'Études',
      icon: 'studies' as const,
      iconBg: 'bg-[#EBF5EA] text-[#718A68]',
      balance: 150000,
      goal: 150000,
      dateLabel: 'Déblocage : 30 juin 2026',
      statusLabel: '🔒 Verrouillée',
      statusClass: 'bg-[#EBF5EA] text-[#718A68] border border-[#718A68]/25',
      project: 'scolaire' as const,
    },
    {
      id: 'sample-3',
      name: 'Urgence',
      icon: 'shield' as const,
      iconBg: 'bg-[#FDF0EB] text-[#C96F4A]',
      balance: 50000,
      goal: 50000,
      dateLabel: 'Disponible',
      statusLabel: 'Débloqué',
      statusClass: 'bg-[#EBF5EA] text-[#718A68] border border-[#718A68]/25',
      project: 'urgence' as const,
    },
  ];

  if (loading) {
    return (
      <div className="py-20 text-center">
        <LoadingScreen fullScreen={false} />
      </div>
    );
  }

  if (loadError) {
    return <ErrorState onRetry={loadVaults} />;
  }

  // ── WIZARD CRÉATION RÉSERVATION (Section 30) ──
  if (view === 'create') {
    return (
      <div className="space-y-5 pb-20 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={closeCreateFlow} className="rounded-xl shrink-0 cursor-pointer">
            <EganyeIcon name="chevron-left" size={16} />
          </Button>
          <div>
            <h1 className="text-lg font-serif font-black text-foreground">{t('bank_create_page_title') || "Créer une réserve d'argent"}</h1>
            <p className="text-xs text-muted-foreground">Mets de côté à ton rythme en toute sécurité</p>
          </div>
        </div>

        {justCreated ? (
          <SuccessState
            title="Épargne créée avec succès !"
            description="Votre argent est mis en sécurité. Vous pouvez maintenant alimenter ce coffre selon vos objectifs."
            actionText="Ajouter de l'argent maintenant"
            onAction={() => {
              closeCreateFlow();
              if (createdVault) {
                setActiveVault(createdVault);
                setActionAmount(createAmount);
              }
            }}
            secondaryActionText="Voir mon épargne"
            onSecondaryAction={closeCreateFlow}
          />
        ) : (
          <>
            {/* Step progress bar */}
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                {Array.from({ length: CREATE_TOTAL_STEPS }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                      i < createStep ? 'bg-[#C96F4A]' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs font-bold text-muted-foreground">
                Étape {createStep} sur {CREATE_TOTAL_STEPS}
              </p>
            </div>

            <div className="bg-white dark:bg-card border border-[#EFE2D0] dark:border-border/80 rounded-3xl p-5 sm:p-6 shadow-soft space-y-5">
              {/* ÉTAPE 1 : Pourquoi épargnes-tu ? */}
              {createStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-base font-serif font-black text-foreground">1. Pourquoi épargnes-tu ?</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Choisis le thème qui correspond à ton projet.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {PROJECT_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCreateProject(cat.id)}
                        className={`p-3.5 rounded-2xl border-2 text-left font-bold text-xs sm:text-sm cursor-pointer transition-all flex flex-col gap-2 ${
                          createProject === cat.id
                            ? 'border-[#C96F4A] bg-[#C96F4A]/5 text-[#C96F4A]'
                            : 'border-border text-foreground hover:bg-muted/60'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl ${cat.bg} ${cat.color} flex items-center justify-center shrink-0`}>
                          <EganyeIcon name={cat.icon} size={18} />
                        </div>
                        <span className="truncate">{t(cat.labelKey) || cat.id}</span>
                      </button>
                    ))}
                  </div>

                  {createProject === 'autre' && (
                    <div className="space-y-1.5 pt-1">
                      <Label className="text-xs font-bold text-foreground">Nom personnalisé de ton projet</Label>
                      <Input
                        value={createProjectCustom}
                        onChange={(e) => setCreateProjectCustom(e.target.value)}
                        placeholder="Ex: Achat d'une moto, Mariage..."
                        className="rounded-xl h-11"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ÉTAPE 2 : Montant cible & départ */}
              {createStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-base font-serif font-black text-foreground">2. Combien veux-tu atteindre ?</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Définis ton objectif d'épargne.</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-foreground">Montant cible (FCFA)</Label>
                    <Input
                      type="number"
                      min={1000}
                      step={5000}
                      value={createAmount}
                      onChange={(e) => setCreateAmount(e.target.value)}
                      placeholder="100 000"
                      className="rounded-xl h-14 text-2xl font-serif font-black"
                      autoFocus
                    />
                    <div className="flex gap-2 flex-wrap pt-1">
                      {['50000', '100000', '250000', '500000', '1000000'].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCreateAmount(amt)}
                          className={`py-1 px-2.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                            createAmount === amt
                              ? 'border-[#C96F4A] bg-[#C96F4A]/10 text-[#C96F4A]'
                              : 'border-border text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {parseInt(amt).toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border/70">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-foreground">Dépôt de départ immédiat (optionnel)</Label>
                      <span className="text-[11px] text-muted-foreground">
                        Dispo : {(user.walletBalance || 0).toLocaleString()} FCFA
                      </span>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={createInitialDeposit}
                      onChange={(e) => setCreateInitialDeposit(e.target.value)}
                      placeholder="0 FCFA"
                      className="rounded-xl h-11 font-medium"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Tu peux commencer avec 0 FCFA et alimenter ton coffre plus tard.
                    </p>
                  </div>
                </div>
              )}

              {/* ÉTAPE 3 : Date de déblocage & Règle */}
              {createStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-base font-serif font-black text-foreground">3. Jusqu'à quand épargnes-tu ?</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">L'argent sera réservé pour protéger ton projet.</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-foreground">Date de déblocage</Label>
                    <Input
                      type="date"
                      min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                      value={createDeadline}
                      onChange={(e) => setCreateDeadline(e.target.value)}
                      className="rounded-xl h-12 text-sm font-medium"
                      autoFocus
                    />

                    {/* Quick shortcuts */}
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      {[
                        { label: '1 mois', months: 1 },
                        { label: '3 mois', months: 3 },
                        { label: '6 mois', months: 6 },
                        { label: '1 an', months: 12 },
                      ].map((dur) => (
                        <button
                          key={dur.label}
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            d.setMonth(d.getMonth() + dur.months);
                            setCreateDeadline(d.toISOString().slice(0, 10));
                          }}
                          className="py-1.5 text-center text-xs font-bold rounded-lg border border-border hover:border-[#C96F4A] hover:bg-[#C96F4A]/5 transition-colors cursor-pointer"
                        >
                          {dur.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Règle de protection */}
                  <div className="p-3.5 rounded-2xl bg-[#FFF8F2] dark:bg-card border border-[#C96F4A]/20 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#C96F4A]/10 text-[#C96F4A] flex items-center justify-center shrink-0 mt-0.5">
                      <EganyeIcon name="shield" size={16} />
                    </div>
                    <div className="text-xs space-y-1">
                      <p className="font-bold text-[#C96F4A]">Argent réservé (discipline d'épargne)</p>
                      <p className="text-muted-foreground leading-relaxed">
                        Pour vous aider à ne pas dépenser vos économies sur un coup de tête, les fonds restent verrouillés jusqu'à la date de déblocage. En cas d'urgence absolue, un déblocage anticipé reste possible avec confirmation.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ÉTAPE 4 : Confirmation */}
              {createStep === 4 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-base font-serif font-black text-foreground">4. Confirmation de ton épargne</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Vérifie les détails avant d'activer ton coffre.</p>
                  </div>

                  <div className="rounded-2xl bg-[#FDFBF7] dark:bg-muted/40 p-4 border border-[#EFE2D0] dark:border-border space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-border/60">
                      <span className="text-xs text-muted-foreground font-medium">Projet</span>
                      <span className="text-sm font-bold text-foreground">{getProjectLabel()}</span>
                    </div>

                    <div className="flex items-center justify-between pb-2 border-b border-border/60">
                      <span className="text-xs text-muted-foreground font-medium">Montant cible</span>
                      <span className="text-base font-serif font-black text-[#C96F4A]">
                        {(parseFloat(createAmount) || 0).toLocaleString()} FCFA
                      </span>
                    </div>

                    {parseFloat(createInitialDeposit) > 0 && (
                      <div className="flex items-center justify-between pb-2 border-b border-border/60">
                        <span className="text-xs text-muted-foreground font-medium">Dépôt immédiat</span>
                        <span className="text-xs font-bold text-foreground">
                          {parseFloat(createInitialDeposit).toLocaleString()} FCFA
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pb-2 border-b border-border/60">
                      <span className="text-xs text-muted-foreground font-medium">Date de déblocage</span>
                      <span className="text-xs font-bold text-foreground">
                        {createDeadline ? new Date(createDeadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">Statut</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FFF4E5] text-[#C96F4A] border border-[#C96F4A]/25">
                        🔒 Réservé jusqu'à terme
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex gap-2 pt-2">
                {createStep > 1 && (
                  <Button
                    variant="outline"
                    onClick={handleCreatePrevStep}
                    disabled={creating}
                    className="flex-1 h-12 rounded-xl font-bold cursor-pointer"
                  >
                    Retour
                  </Button>
                )}
                {createStep < CREATE_TOTAL_STEPS ? (
                  <Button
                    onClick={handleCreateNextStep}
                    className="flex-1 h-12 rounded-xl bg-gradient-to-r from-[#C96F4A] to-[#B8623E] hover:from-[#B8623E] hover:to-[#A95636] text-white font-bold cursor-pointer"
                  >
                    Continuer
                  </Button>
                ) : (
                  <Button
                    onClick={handleCreateVault}
                    disabled={creating}
                    className="btn-shine flex-1 h-12 rounded-xl bg-gradient-to-r from-[#C96F4A] to-[#B8623E] hover:from-[#B8623E] hover:to-[#A95636] text-white font-bold cursor-pointer"
                  >
                    {creating ? <EganyeIcon name="refresh" size={16} className="animate-spin mr-2" /> : null}
                    {creating ? "Création en cours..." : "Créer mon épargne"}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── VUE PRINCIPALE MA BANQUE ──
  return (
    <div className="space-y-4 sm:space-y-5 pb-20">
      {/* 1. Header: Ma Banque */}
      <div className="space-y-0.5 pt-1">
        <h1 className="text-2xl sm:text-3xl font-serif font-black text-foreground tracking-tight">
          {t('my_bank') || "Ma Banque"}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground font-medium">
          {t('my_bank_subtitle') || "Mets de l'argent de côté pour tes projets."}
        </p>
      </div>

      {/* 2. Hero Card: Mon solde disponible (avec Recharger & Retirer) */}
      <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#C96F4A] via-[#BD6642] to-[#AB5837] p-5 sm:p-6 text-white shadow-soft">
        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="space-y-3 flex-1 min-w-0">
            <p className="text-xs sm:text-[13px] font-medium text-white/90">
              {t('bank_wallet_balance_label') || "Mon solde disponible"}
            </p>
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-white">
                {showBalance ? `${(user.walletBalance || 0).toLocaleString()} FCFA` : '••••••• FCFA'}
              </h2>
              <button
                type="button"
                onClick={() => setShowBalance(!showBalance)}
                className="p-1.5 rounded-full hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
                aria-label={showBalance ? "Masquer le solde" : "Afficher le solde"}
              >
                <EganyeIcon name={showBalance ? "eye" : "eye-off"} size={17} />
              </button>
            </div>

            {/* Recharger & Retirer action buttons */}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => setRechargeModalOpen(true)}
                className="inline-flex items-center gap-1.5 bg-white text-[#C96F4A] hover:bg-white/95 px-4 py-2 rounded-full font-bold text-xs shadow-sm transition-transform active:scale-95 cursor-pointer"
              >
                <EganyeIcon name="plus" size={13} strokeWidth={2.5} />
                <span>{t('recharge') || "Recharger"}</span>
              </button>

              <button
                type="button"
                onClick={() => setWithdrawModalOpen(true)}
                className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/30 px-4 py-2 rounded-full font-bold text-xs shadow-sm transition-transform active:scale-95 cursor-pointer"
              >
                <EganyeIcon name="withdraw" size={13} strokeWidth={2} />
                <span>{t('withdraw') || "Retirer"}</span>
              </button>
            </div>
          </div>

          {/* Smiling woman portrait from mockup */}
          <div className="relative shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-white/30 shadow-inner bg-[#A95636]/40">
            <img
              src="/young-savers.png"
              alt="Ma Banque Épargne"
              className="w-full h-full object-cover object-top"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* 3. Card: Épargne totale */}
      <div className="bg-white dark:bg-card rounded-2xl p-4 sm:p-5 border border-[#EFE2D0] dark:border-border/80 shadow-soft space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F0E6D8] dark:bg-muted flex items-center justify-center text-[#718A68] shrink-0">
              <EganyeIcon name="savings" size={20} strokeWidth={2} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                {t('bank_total_savings') || "Épargne totale"}
              </p>
              <p className="text-lg sm:text-xl font-serif font-black text-foreground">
                {displaySaved.toLocaleString()} FCFA
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAllReservations(!showAllReservations)}
            className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
          >
            <EganyeIcon name="chevron-right" size={18} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5 pt-0.5">
          <div className="h-2.5 w-full bg-[#EFE2D0]/60 dark:bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-[#718A68] rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">
              {t('bank_goal_prefix') || "Objectif :"} {displayGoal.toLocaleString()} FCFA
            </span>
            <span className="font-bold text-[#718A68]">
              {progressPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* 4. Section: Mes réservations */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h2 className="font-serif font-black text-lg text-foreground tracking-tight">
            {t('bank_my_reservations') || "Mes réservations"}
          </h2>
          <button
            type="button"
            onClick={() => setShowAllReservations(!showAllReservations)}
            className="text-xs font-bold text-[#C96F4A] hover:opacity-80 transition-opacity flex items-center gap-0.5 cursor-pointer"
          >
            <span>{showAllReservations ? "Réduire" : (t('bank_view_all') || "Voir tout")}</span>
            <EganyeIcon name="chevron-right" size={13} />
          </button>
        </div>

        {vaults.length > 0 ? (
          <div className="space-y-2.5">
            {(showAllReservations ? vaults : vaults.slice(0, 4)).map((vault) => {
              const unlocked = isUnlocked(vault);
              const info = getVaultIconInfo(vault.name, vault.description);
              const match = vault.description?.match(/(\d[\d\s]*)/);
              const goal = match ? parseInt(match[0].replace(/\s/g, ''), 10) : (vault.balance > 0 ? vault.balance : 100000);

              return (
                <div
                  key={vault.id}
                  onClick={() => { setActiveVault(vault); setActionAmount(''); }}
                  className="bg-white dark:bg-card border border-[#EFE2D0] dark:border-border/80 rounded-2xl p-4 shadow-soft flex items-center justify-between gap-3 hover:border-[#C96F4A]/40 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-11 h-11 rounded-2xl ${info.bg} flex items-center justify-center shrink-0`}>
                      <EganyeIcon name={info.icon} size={20} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-foreground text-[15px] truncate group-hover:text-[#C96F4A] transition-colors">
                        {vault.name}
                      </h4>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        {vault.balance.toLocaleString()} / {goal.toLocaleString()} FCFA
                      </p>
                      <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                        {unlocked
                          ? 'Disponible pour retrait'
                          : `Déblocage : ${new Date(vault.unlockAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        unlocked
                          ? 'bg-[#EBF5EA] text-[#718A68] border border-[#718A68]/25'
                          : 'bg-[#FFF4E5] text-[#C96F4A] border border-[#C96F4A]/25'
                      }`}
                    >
                      {unlocked ? 'Débloqué' : 'En cours'}
                    </span>
                    <EganyeIcon name="chevron-right" size={16} className="text-muted-foreground group-hover:text-[#C96F4A] transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2.5">
            {SAMPLE_VAULTS.map((sample) => (
              <div
                key={sample.id}
                onClick={() => openCreateFlow(sample.project, sample.goal.toString())}
                className="bg-white dark:bg-card border border-[#EFE2D0] dark:border-border/80 rounded-2xl p-4 shadow-soft flex items-center justify-between gap-3 hover:border-[#C96F4A]/50 transition-colors cursor-pointer group"
                title="Cliquer pour configurer cette épargne"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-11 h-11 rounded-2xl ${sample.iconBg} flex items-center justify-center shrink-0`}>
                    <EganyeIcon name={sample.icon} size={20} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-foreground text-[15px] truncate group-hover:text-[#C96F4A] transition-colors">
                      {sample.name}
                    </h4>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                      {sample.balance.toLocaleString()} / {sample.goal.toLocaleString()} FCFA
                    </p>
                    <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                      {sample.dateLabel}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${sample.statusClass}`}>
                    {sample.statusLabel}
                  </span>
                  <EganyeIcon name="chevron-right" size={16} className="text-muted-foreground group-hover:text-[#C96F4A] transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Bottom Action Button: + Créer une épargne */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => openCreateFlow()}
          disabled={!canCreateVault}
          className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#C96F4A] to-[#B8623E] hover:from-[#B8623E] hover:to-[#A95636] text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <EganyeIcon name="plus" size={16} strokeWidth={2.5} />
          <span>+ Créer une épargne</span>
        </button>
        {!canCreateVault && (
          <p className="text-[12px] text-center text-muted-foreground mt-1.5">{t('bank_cap_reached_note')}</p>
        )}
      </div>

      {/* 6. Formules & Abonnement Coffres Multiples */}
      <div className="glass-card rounded-2xl p-4 shadow-soft flex items-center justify-between gap-3 border border-border/60">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{hasActiveSubscription ? t('bank_current_tier') : t('bank_free_trial_label')}</p>
          <p className="font-bold text-foreground">{hasActiveSubscription ? t(`bank_tier_${user.bankTier}`) : t('bank_free_trial_desc')}</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {t('bank_vaults_used')}: {vaults.length}/{maxVaults}
          </p>
        </div>
        {(!hasActiveSubscription || user.bankTier !== 'unlimited') && (
          <Button
            variant="outline"
            size="sm"
            className="font-bold border-brand/30 text-brand hover:bg-brand/10 rounded-xl cursor-pointer shrink-0"
            onClick={() => handleSubscribe(!hasActiveSubscription ? 'starter' : user.bankTier === 'starter' ? 'growth' : 'unlimited')}
            disabled={subscribing !== null}
          >
            {hasActiveSubscription ? t('bank_upgrade_cta') : t('bank_subscribe_cta')}
          </Button>
        )}
      </div>

      {/* Grille des formules — le prix doit être visible avant tout clic
          qui déclenche une facturation, jamais seulement dans un bouton. */}
      {!hasActiveSubscription && (
        <div className="space-y-3 pt-1">
          <div>
            <h2 className="text-base font-serif font-black text-foreground">{t('bank_upsell_title')}</h2>
            <p className="text-[13px] text-muted-foreground">{t('bank_upsell_desc')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {TIERS.map((tier) => (
              <div key={tier} className="glass-card rounded-2xl p-5 shadow-soft flex flex-col justify-between border border-border/60">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <EganyeIcon name="star" size={16} className="text-brand" />
                    <h3 className="font-bold text-foreground">{t(`bank_tier_${tier}`)}</h3>
                  </div>
                  <p className="text-2xl font-black text-brand mb-1">
                    {BANK_TIER_PRICE[tier].toLocaleString()} FCFA
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">{t('bank_per_month')}</p>
                </div>
                <Button
                  className="btn-shine w-full h-11 font-bold rounded-xl cursor-pointer"
                  onClick={() => handleSubscribe(tier)}
                  disabled={subscribing !== null}
                >
                  {subscribing === tier ? <EganyeIcon name="loading" size={16} className="animate-spin" /> : t('bank_subscribe_cta')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Évolution & Graphique d'épargne */}
      <DashboardCharts user={user} groups={groups} />

      {/* ── DIALOG GESTION COFFRE DÉTAILLÉ ── */}
      <Dialog open={!!activeVault} onOpenChange={(open) => !open && setActiveVault(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-background border border-border">
          {activeVault && (() => {
            const unlocked = isUnlocked(activeVault);
            const info = getVaultIconInfo(activeVault.name, activeVault.description);
            const daysLeft = Math.max(0, Math.ceil((new Date(activeVault.unlockAt).getTime() - now) / (24 * 60 * 60 * 1000)));

            return (
              <div className="space-y-4">
                <DialogHeader className="space-y-1">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${info.bg} flex items-center justify-center shrink-0`}>
                      <EganyeIcon name={info.icon} size={20} />
                    </div>
                    <div>
                      <DialogTitle className="font-serif text-lg font-black">{activeVault.name}</DialogTitle>
                      <p className="text-xs text-muted-foreground">{activeVault.description || "Épargne personnelle"}</p>
                    </div>
                  </div>
                </DialogHeader>

                {/* Status notice */}
                <div className={`p-3.5 rounded-2xl text-xs space-y-1 ${
                  unlocked
                    ? 'bg-[#EBF5EA] text-[#718A68] border border-[#718A68]/25'
                    : 'bg-[#FFF8F2] text-[#C96F4A] border border-[#C96F4A]/20'
                }`}>
                  <p className="font-bold flex items-center gap-1.5">
                    <EganyeIcon name={unlocked ? "check" : "shield"} size={14} />
                    {unlocked ? "Fonds disponibles" : `Réservé encore ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`}
                  </p>
                  <p className="text-muted-foreground">
                    {unlocked
                      ? "La période de blocage est terminée. Vous pouvez récupérer vos fonds ou prolonger le coffre."
                      : `Date prévue : ${new Date(activeVault.unlockAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                  </p>
                </div>

                {/* Balances */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-muted/60 border border-border">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase">Solde du coffre</p>
                    <p className="text-base font-serif font-black text-foreground mt-0.5">
                      {activeVault.balance.toLocaleString()} FCFA
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/60 border border-border">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase">Mon disponible</p>
                    <p className="text-base font-serif font-black text-foreground mt-0.5">
                      {user.walletBalance.toLocaleString()} FCFA
                    </p>
                  </div>
                </div>

                {/* Saisie montant */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Montant de l'opération (FCFA)</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Ex: 25 000"
                    value={actionAmount}
                    onChange={(e) => setActionAmount(e.target.value)}
                    className="rounded-xl h-11"
                  />
                  <div className="flex gap-1.5 pt-0.5">
                    {['10000', '25000', '50000'].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setActionAmount(amt)}
                        className="py-1 px-2 text-[11px] font-bold rounded-lg border border-border text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        +{parseInt(amt).toLocaleString()}
                      </button>
                    ))}
                    {unlocked && activeVault.balance > 0 && (
                      <button
                        type="button"
                        onClick={() => setActionAmount(activeVault.balance.toString())}
                        className="py-1 px-2 text-[11px] font-bold rounded-lg border border-[#718A68] text-[#718A68] bg-[#718A68]/10 cursor-pointer ml-auto"
                      >
                        Tout retirer
                      </button>
                    )}
                  </div>
                </div>

                {/* Buttons Déposer / Retirer */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    className="btn-shine h-11 font-bold rounded-xl bg-[#718A68] hover:bg-[#607757] text-white cursor-pointer"
                    onClick={handleDeposit}
                    disabled={actionBusy}
                  >
                    <EganyeIcon name="plus" size={14} className="mr-1.5" /> Déposer
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 font-bold rounded-xl border-[#C96F4A]/40 text-[#C96F4A] hover:bg-[#C96F4A]/10 cursor-pointer"
                    onClick={() => handleWithdraw(false)}
                    disabled={actionBusy || activeVault.balance <= 0}
                  >
                    <EganyeIcon name="withdraw" size={14} className="mr-1.5" /> Retirer
                  </Button>
                </div>

                {/* Prolonger ou Supprimer si 0 */}
                {unlocked && (
                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleRelock(activeVault, 90)}
                      disabled={actionBusy}
                      className="text-xs font-bold text-[#718A68] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <EganyeIcon name="refresh" size={12} /> Prolonger de 3 mois
                    </button>

                    {activeVault.balance === 0 && (
                      <button
                        type="button"
                        onClick={() => handleDelete(activeVault)}
                        disabled={actionBusy}
                        className="text-xs font-bold text-destructive hover:underline cursor-pointer"
                      >
                        Supprimer ce coffre
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── MODAL AVERTISSEMENT DÉBLOCAGE ANTICIPÉ ── */}
      <Dialog open={showEarlyUnlockConfirm} onOpenChange={setShowEarlyUnlockConfirm}>
        <DialogContent className="max-w-sm rounded-3xl p-6 bg-background border border-border text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-warning-soft text-warning mx-auto flex items-center justify-center">
            <EganyeIcon name="shield" size={24} />
          </div>
          <DialogTitle className="font-serif text-lg font-black">Déblocage anticipé</DialogTitle>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Cet argent est réservé pour votre objectif. Le débloquer avant terme interrompt votre discipline d'épargne. Confirmez-vous le retrait vers votre solde disponible ?
          </p>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowEarlyUnlockConfirm(false)}
              className="flex-1 rounded-xl h-11 font-bold"
            >
              Conserver
            </Button>
            <Button
              onClick={() => handleWithdraw(true)}
              className="flex-1 rounded-xl h-11 font-bold bg-[#C96F4A] hover:bg-[#B8623E] text-white"
            >
              Confirmer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MODAL RECHARGE MOBILE MONEY ── */}
      <Dialog open={rechargeModalOpen} onOpenChange={setRechargeModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-background border border-border">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-bold">
              {t('recharge_wallet_title') || "Recharger mon solde disponible"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              {t('recharge_wallet_desc') || "Ajoutez des fonds via Mobile Money pour alimenter vos coffres et cotisations."}
            </p>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Montant (FCFA)</Label>
              <Input
                type="number"
                min={500}
                step={500}
                placeholder="25 000"
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(e.target.value)}
                className="rounded-xl h-12 text-lg font-serif font-black"
              />
              <div className="flex gap-2 pt-1">
                {['5000', '10000', '25000', '50000'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setRechargeAmount(amt)}
                    className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                      rechargeAmount === amt
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {parseInt(amt).toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Opérateur</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRechargeMethod('tmoney')}
                  className={`p-3 rounded-xl border-2 flex items-center gap-2 font-bold text-xs cursor-pointer transition-colors ${
                    rechargeMethod === 'tmoney'
                      ? 'border-[#C96F4A] bg-[#C96F4A]/5 text-[#C96F4A]'
                      : 'border-border text-foreground hover:bg-muted'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#C96F4A]" />
                  <span>T-Money (Togo)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRechargeMethod('flooz')}
                  className={`p-3 rounded-xl border-2 flex items-center gap-2 font-bold text-xs cursor-pointer transition-colors ${
                    rechargeMethod === 'flooz'
                      ? 'border-[#718A68] bg-[#718A68]/5 text-[#718A68]'
                      : 'border-border text-foreground hover:bg-muted'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#718A68]" />
                  <span>Moov Flooz</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Numéro de téléphone</Label>
              <Input
                type="tel"
                placeholder="90 00 00 00"
                value={rechargePhone}
                onChange={(e) => setRechargePhone(e.target.value)}
                className="rounded-xl h-11 text-sm font-mono"
              />
            </div>

            <Button
              onClick={handleQuickRecharge}
              disabled={isRecharging}
              className="btn-shine w-full h-11 rounded-xl bg-gradient-to-r from-[#C96F4A] to-[#B8623E] hover:from-[#B8623E] hover:to-[#A95636] text-white font-bold text-sm cursor-pointer"
            >
              {isRecharging ? (
                <EganyeIcon name="refresh" size={16} className="animate-spin mr-2" />
              ) : (
                <EganyeIcon name="plus" size={14} className="mr-2" />
              )}
              {isRecharging ? "Traitement..." : "Confirmer la recharge"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MODAL RETRAIT MOBILE MONEY ── */}
      <Dialog open={withdrawModalOpen} onOpenChange={setWithdrawModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-background border border-border">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-bold">
              Retirer vers Mobile Money
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Transférez directement vos fonds disponibles vers votre compte mobile.
            </p>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground">Montant (FCFA)</Label>
                <span className="text-[11px] text-muted-foreground">
                  Dispo : {(user.walletBalance || 0).toLocaleString()} FCFA
                </span>
              </div>
              <Input
                type="number"
                min={500}
                step={500}
                placeholder="10 000"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="rounded-xl h-12 text-lg font-serif font-black"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Opérateur de réception</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setWithdrawMethod('tmoney')}
                  className={`p-3 rounded-xl border-2 flex items-center gap-2 font-bold text-xs cursor-pointer transition-colors ${
                    withdrawMethod === 'tmoney'
                      ? 'border-[#C96F4A] bg-[#C96F4A]/5 text-[#C96F4A]'
                      : 'border-border text-foreground hover:bg-muted'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#C96F4A]" />
                  <span>T-Money (Togo)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawMethod('flooz')}
                  className={`p-3 rounded-xl border-2 flex items-center gap-2 font-bold text-xs cursor-pointer transition-colors ${
                    withdrawMethod === 'flooz'
                      ? 'border-[#718A68] bg-[#718A68]/5 text-[#718A68]'
                      : 'border-border text-foreground hover:bg-muted'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#718A68]" />
                  <span>Moov Flooz</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Numéro de téléphone bénéficiaire</Label>
              <Input
                type="tel"
                placeholder="90 00 00 00"
                value={withdrawPhone}
                onChange={(e) => setWithdrawPhone(e.target.value)}
                className="rounded-xl h-11 text-sm font-mono"
              />
            </div>

            <Button
              onClick={handleQuickWithdraw}
              disabled={isWithdrawing}
              className="btn-shine w-full h-11 rounded-xl bg-gradient-to-r from-[#C96F4A] to-[#B8623E] hover:from-[#B8623E] hover:to-[#A95636] text-white font-bold text-sm cursor-pointer"
            >
              {isWithdrawing ? (
                <EganyeIcon name="refresh" size={16} className="animate-spin mr-2" />
              ) : (
                <EganyeIcon name="withdraw" size={14} className="mr-2" />
              )}
              {isWithdrawing ? "Traitement..." : "Confirmer le retrait"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
