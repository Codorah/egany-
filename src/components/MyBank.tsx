import React, { useEffect, useState } from 'react';
import { Landmark, Lock, LockOpen, Loader2, AlertCircle, PlusCircle, Wallet, RefreshCw, Trash2, CalendarClock, Crown, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Group, UserProfile, PersonalVault } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { AmountDisplay } from './ui/AmountDisplay';
import { SuccessState } from './ui/SuccessState';
import { Skeleton } from './ui/Skeleton';
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
}

type BankTier = 'starter' | 'growth' | 'unlimited';
const TIERS: BankTier[] = ['starter', 'growth', 'unlimited'];

export function MyBank({ user, groups }: MyBankProps) {
  const { t } = useLanguage();
  const [vaults, setVaults] = useState<PersonalVault[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [subscribing, setSubscribing] = useState<BankTier | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Parcours « Créer une réservation » — 3 étapes (combien / jusqu'à quand /
  // pour quel projet) plutôt qu'un seul dialogue à champs libres, pour que
  // le geste d'épargner reste aussi simple qu'il l'est censé être. En vraie
  // page plutôt qu'en modale — une modale ne convainc pas que c'est une
  // action à part entière, surtout sur mobile.
  const [view, setView] = useState<'list' | 'create'>('list');
  const [createStep, setCreateStep] = useState(1);
  const [createAmount, setCreateAmount] = useState('');
  const [createDeadline, setCreateDeadline] = useState('');
  const [createProject, setCreateProject] = useState<'scolaire' | 'voyage' | 'maison' | 'autre'>('scolaire');
  const [createProjectCustom, setCreateProjectCustom] = useState('');
  const [justCreated, setJustCreated] = useState(false);
  const [creating, setCreating] = useState(false);
  const CREATE_TOTAL_STEPS = 4;

  const [activeVault, setActiveVault] = useState<PersonalVault | null>(null);
  const [amount, setAmount] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const hasActiveSubscription = user.bankTier && user.bankTier !== 'none'
    && !!user.bankSubscriptionExpiresAt
    && new Date(user.bankSubscriptionExpiresAt).getTime() > now;
  // Tout le monde peut essayer Ma Banque gratuitement avec un compte
  // épargne — l'abonnement ne sert qu'à en ouvrir plusieurs en parallèle.
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

  // Refresh the locked/unlocked state as the clock passes an unlock_at time,
  // without needing another network round-trip.
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

  const openCreateFlow = () => {
    setCreateStep(1);
    setCreateAmount('');
    setCreateDeadline('');
    setCreateProject('scolaire');
    setCreateProjectCustom('');
    setJustCreated(false);
    setView('create');
  };

  const closeCreateFlow = () => setView('list');

  const projectLabel = () => createProject === 'autre' ? createProjectCustom.trim() : t(`bank_project_${createProject}`);

  // Créer la réservation n'exige plus d'avoir déjà l'argent — on ne
  // demande le paiement qu'au moment où la personne choisit d'ajouter de
  // l'argent, jamais avant. Le montant du départ n'est qu'un objectif :
  // le coffre est créé vide, et se remplit ensuite via « Déposer ».
  const [createdVault, setCreatedVault] = useState<PersonalVault | null>(null);

  const handleCreateVault = async () => {
    setCreating(true);
    try {
      const lockDays = Math.max(1, Math.ceil((new Date(createDeadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
      const goalAmount = parseFloat(createAmount) || 0;
      const result = await createPersonalVault({
        name: projectLabel(),
        description: `${t('bank_create_step1_title')} ${goalAmount.toLocaleString()} FCFA`,
        lockDays,
      });
      if (!result.success) throw new Error(result.message);
      const freshVaults = await fetchMyVaults(user.uid);
      setVaults(freshVaults);
      setCreatedVault(freshVaults.find((v) => v.id === result.vaultId) || null);
      setJustCreated(true);
    } catch (err: any) {
      toast.error(err.message || t('bank_create_error'));
    } finally {
      setCreating(false);
    }
  };

  const handleCreateNextStep = () => {
    if (createStep === 1) {
      const amt = parseFloat(createAmount);
      if (!amt || amt <= 0) { toast.error(t('bank_invalid_amount_error')); return; }
      setCreateStep(2);
      return;
    }
    if (createStep === 2) {
      if (!createDeadline || new Date(createDeadline).getTime() <= Date.now()) { toast.error(t('bank_create_deadline_error')); return; }
      setCreateStep(3);
      return;
    }
    if (createStep === 3) {
      if (createProject === 'autre' && !createProjectCustom.trim()) { toast.error(t('bank_create_project_error')); return; }
      setCreateStep(4);
    }
  };
  const handleCreatePrevStep = () => setCreateStep((s) => Math.max(1, s - 1));

  const isUnlocked = (vault: PersonalVault) => new Date(vault.unlockAt).getTime() <= now;

  const handleDeposit = async () => {
    if (!activeVault) return;
    const value = parseFloat(amount);
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
      setAmount('');
      await loadVaults();
    } catch (err: any) {
      toast.error(err.message || t('bank_deposit_error'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleWithdraw = async () => {
    if (!activeVault) return;
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      toast.error(t('bank_invalid_amount_error'));
      return;
    }
    setActionBusy(true);
    try {
      const result = await withdrawFromVault(activeVault.id, value);
      if (!result.success) throw new Error(result.message);
      toast.success(result.message);
      setActiveVault(null);
      setAmount('');
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
    } catch (err: any) {
      toast.error(err.message || t('bank_relock_error'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleDelete = async (vault: PersonalVault) => {
    setActionBusy(true);
    try {
      const result = await deleteEmptyVault(vault.id);
      if (!result.success) throw new Error(result.message);
      toast.success(result.message);
      await loadVaults();
    } catch (err: any) {
      toast.error(err.message || t('bank_delete_error'));
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-5 pb-20">
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-24 rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
        <AlertCircle className="w-8 h-8 text-danger" />
        <p className="text-sm font-bold text-foreground">{t('bank_load_error_title')}</p>
        <Button variant="outline" size="sm" onClick={loadVaults} className="mt-2 font-bold rounded-xl cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> {t('bank_retry')}
        </Button>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="space-y-5 pb-20">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={closeCreateFlow} className="rounded-xl shrink-0 cursor-pointer active:scale-95 transition-transform">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-serif font-black text-foreground">{t('bank_create_page_title')}</h1>
        </div>

        {justCreated ? (
          <SuccessState
            title={t('bank_create_step4_title')}
            description={t('bank_reservation_ready_desc')}
            actionText={t('bank_add_money_now_cta')}
            onAction={() => {
              closeCreateFlow();
              if (createdVault) {
                setActiveVault(createdVault);
                setAmount(createAmount);
              }
            }}
            secondaryActionText={t('bank_later_cta')}
            onSecondaryAction={closeCreateFlow}
          />
        ) : (
          <>
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                {Array.from({ length: CREATE_TOTAL_STEPS }).map((_, i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < createStep ? 'bg-primary' : 'bg-muted'}`} />
                ))}
              </div>
              <p className="text-[13px] font-bold text-muted-foreground">
                {t('cgd_step_word')} {createStep} {t('cgd_step_of_word')} {CREATE_TOTAL_STEPS}
              </p>
            </div>

            <div className="space-y-4">
              {createStep === 1 && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-foreground">{t('bank_create_step1_title')}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={createAmount}
                    onChange={(e) => setCreateAmount(e.target.value)}
                    placeholder="50 000"
                    className="rounded-xl h-14 text-xl font-serif font-black"
                    autoFocus
                  />
                  <p className="text-[13px] text-muted-foreground">
                    {t('bank_wallet_balance_label')} : {user.walletBalance.toLocaleString()} FCFA
                  </p>
                </div>
              )}

              {createStep === 2 && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-foreground">{t('bank_create_step2_title')}</Label>
                  <Input
                    type="date"
                    min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                    value={createDeadline}
                    onChange={(e) => setCreateDeadline(e.target.value)}
                    className="rounded-xl h-12"
                    autoFocus
                  />
                </div>
              )}

              {createStep === 3 && (
                <div className="space-y-3">
                  <Label className="text-sm font-bold text-foreground">{t('bank_create_step3_title')}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['scolaire', 'voyage', 'maison', 'autre'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCreateProject(p)}
                        className={`p-3 rounded-2xl border-2 text-left font-bold text-sm cursor-pointer transition-colors ${
                          createProject === p ? 'border-primary bg-primary/5 text-primary' : 'border-border text-foreground hover:bg-muted'
                        }`}
                      >
                        {t(`bank_project_${p}`)}
                      </button>
                    ))}
                  </div>
                  {createProject === 'autre' && (
                    <Input
                      value={createProjectCustom}
                      onChange={(e) => setCreateProjectCustom(e.target.value)}
                      placeholder={t('bank_project_custom_placeholder')}
                      className="rounded-xl h-11"
                      autoFocus
                    />
                  )}
                </div>
              )}

              {createStep === 4 && (
                <div className="space-y-3">
                  <div className="glass-card rounded-2xl p-4 border border-border/70 space-y-2">
                    <p className="text-xs font-bold text-muted-foreground">{t('bank_create_confirm_prefix')}</p>
                    <AmountDisplay amount={parseFloat(createAmount) || 0} size="lg" />
                    <p className="text-xs font-bold text-muted-foreground pt-1">
                      {t('bank_create_confirm_until')} <span className="text-foreground font-black">{createDeadline ? new Date(createDeadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</span>
                    </p>
                    <p className="text-xs font-bold text-muted-foreground">{projectLabel()}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                {createStep > 1 && (
                  <Button variant="outline" onClick={handleCreatePrevStep} disabled={creating} className="flex-1 h-11 rounded-xl font-bold cursor-pointer">
                    {t('a11y_back')}
                  </Button>
                )}
                {createStep < CREATE_TOTAL_STEPS ? (
                  <Button onClick={handleCreateNextStep} className="flex-1 h-11 rounded-xl font-bold cursor-pointer">
                    {t('onb_next_step_button')}
                  </Button>
                ) : (
                  <Button onClick={handleCreateVault} disabled={creating} className="flex-1 h-11 rounded-xl font-bold cursor-pointer">
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : t('bank_create_confirm_cta')}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5 pb-20">
      {/* Pas de bloc « solde + Ajouter/Retirer » ici : c'est le rôle du
          portefeuille sur l'Accueil (argent libre). Ma Banque ne montre que
          les coffres verrouillés — sa seule raison d'être — pour ne pas
          donner l'impression d'un portefeuille en double. */}

      {/* Hero Card with uncropped 3D avatar */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 shadow-soft border border-border/70 relative overflow-hidden flex items-center justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[13px] font-bold border border-primary/20">
            <Lock className="w-3 h-3" />
            <span>{t('bank_secure_badge')}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-serif font-black text-foreground tracking-tight">{t('my_bank')}</h1>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{t('my_bank_subtitle')}</p>
        </div>
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shadow-soft border-2 border-primary/30 shrink-0 bg-muted">
          <img
            src="/feature-my-bank.png"
            alt="Ma Banque"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Statut — toujours visible, jamais bloquant : tout le monde a droit
          à un compte épargne gratuit pour essayer. L'abonnement n'ouvre que
          la possibilité d'en avoir plusieurs en même temps. */}
      <div className="glass-card rounded-2xl p-4 shadow-soft flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{hasActiveSubscription ? t('bank_current_tier') : t('bank_free_trial_label')}</p>
          <p className="font-bold text-foreground">{hasActiveSubscription ? t(`bank_tier_${user.bankTier}`) : t('bank_free_trial_desc')}</p>
          <p className="text-[13px] text-muted-foreground mt-0.5">
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

      <div>
        <Button
          className="w-full h-12 font-bold rounded-xl cursor-pointer active:scale-95 transition-transform"
          onClick={openCreateFlow}
          disabled={!canCreateVault}
        >
          <PlusCircle className="w-4 h-4 mr-2" /> {t('bank_create_new')}
        </Button>
        {!canCreateVault && (
          <p className="text-[12px] text-center text-muted-foreground mt-1.5">{t('bank_cap_reached_note')}</p>
        )}
      </div>

      {vaults.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6 glass-card rounded-3xl shadow-soft">
          <Landmark className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm font-bold text-foreground">{t('bank_empty_title')}</p>
          <p className="text-xs text-muted-foreground max-w-xs">{t('bank_empty_desc')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vaults.map((vault) => {
                const unlocked = isUnlocked(vault);
                return (
                  <div
                    key={vault.id}
                    className={`rounded-2xl p-5 shadow-soft space-y-3 border-2 ${
                      unlocked ? 'glass-card border-secondary/25' : 'bg-brand/5 border-brand/25'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-foreground text-lg leading-tight">{vault.name}</h3>
                        {vault.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{vault.description}</p>
                        )}
                      </div>
                      <div className={`p-2 rounded-xl shrink-0 ${unlocked ? 'bg-secondary/10' : 'bg-brand/10'}`}>
                        {unlocked ? <LockOpen className="w-5 h-5 text-secondary" /> : <Lock className="w-5 h-5 text-brand" />}
                      </div>
                    </div>

                    <AmountDisplay amount={vault.balance} size="lg" />

                    <div className={`rounded-xl p-2.5 space-y-0.5 ${unlocked ? 'bg-success-soft' : 'bg-brand/10'}`}>
                      <div className={`flex items-center gap-1.5 text-[13px] font-bold ${unlocked ? 'text-secondary' : 'text-brand'}`}>
                        <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                        {unlocked
                          ? t('bank_unlocked_label')
                          : `${t('bank_locked_until')} ${new Date(vault.unlockAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                      </div>
                      {!unlocked && (
                        <p className="text-[11px] text-muted-foreground">{t('bank_locked_strict_note')}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="font-bold rounded-xl"
                        onClick={() => { setActiveVault(vault); setAmount(''); }}
                        disabled={actionBusy}
                      >
                        <Wallet className="w-3.5 h-3.5 mr-1.5" /> {t('bank_deposit_cta')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="font-bold rounded-xl"
                        onClick={() => { setActiveVault(vault); setAmount(''); }}
                        disabled={!unlocked || vault.balance <= 0 || actionBusy}
                      >
                        {t('bank_withdraw_cta')}
                      </Button>
                    </div>
                    {unlocked && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="font-bold rounded-xl text-brand"
                          onClick={() => handleRelock(vault, vault.lockDays)}
                          disabled={actionBusy}
                        >
                          <Lock className="w-3.5 h-3.5 mr-1.5" /> {t('bank_relock_cta')}
                        </Button>
                        {vault.balance <= 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="font-bold rounded-xl text-danger"
                            onClick={() => handleDelete(vault)}
                            disabled={actionBusy}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> {t('bank_delete_cta')}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
      )}

      {/* Abonnement — jamais un mur, juste une option pour qui veut
          plusieurs coffres en même temps. */}
      {!hasActiveSubscription && (
        <div className="space-y-3 pt-2">
          <div>
            <h2 className="text-base font-serif font-black text-foreground">{t('bank_upsell_title')}</h2>
            <p className="text-[13px] text-muted-foreground">{t('bank_upsell_desc')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {TIERS.map((tier) => (
              <div key={tier} className="glass-card rounded-2xl p-5 shadow-soft flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Crown className="w-4 h-4 text-brand" />
                    <h3 className="font-bold text-foreground">{t(`bank_tier_${tier}`)}</h3>
                  </div>
                  <p className="text-2xl font-black text-brand mb-1">
                    {BANK_TIER_PRICE[tier].toLocaleString()} FCFA
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">{t('bank_per_month')}</p>
                </div>
                <Button
                  className="w-full h-11 font-bold rounded-xl cursor-pointer active:scale-95 transition-transform"
                  onClick={() => handleSubscribe(tier)}
                  disabled={subscribing !== null}
                >
                  {subscribing === tier ? <Loader2 className="w-4 h-4 animate-spin" /> : t('bank_subscribe_cta')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historique & évolution — déplacé ici depuis l'Accueil : utile,
          mais pas la première chose qu'on doit lire en ouvrant l'app. */}
      <DashboardCharts user={user} groups={groups} />

      <Dialog open={!!activeVault} onOpenChange={(open) => !open && setActiveVault(null)}>
        <DialogContent className="max-w-md">
          {activeVault && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif">{activeVault.name}</DialogTitle>
                <p className="text-xs text-muted-foreground">{t('bank_manage_vault_subtitle')}</p>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-muted border border-border">
                    <p className="text-[11px] font-bold uppercase text-muted-foreground">{t('bank_wallet_balance_label')}</p>
                    <p className="text-sm font-serif font-black text-foreground mt-0.5">{user.walletBalance.toLocaleString()} FCFA</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-muted border border-border">
                    <p className="text-[11px] font-bold uppercase text-muted-foreground">{t('bank_vault_balance_label')}</p>
                    <p className="text-sm font-serif font-black text-foreground mt-0.5">{activeVault.balance.toLocaleString()} FCFA</p>
                  </div>
                </div>
                <Input
                  type="number"
                  min={1}
                  placeholder={t('bank_amount_placeholder')}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="rounded-xl h-11"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button className="h-12 font-bold rounded-xl" onClick={handleDeposit} disabled={actionBusy}>
                    <Wallet className="w-4 h-4 mr-2" /> {t('bank_deposit_cta')}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 font-bold rounded-xl"
                    onClick={handleWithdraw}
                    disabled={actionBusy || !isUnlocked(activeVault) || activeVault.balance <= 0}
                  >
                    {t('bank_withdraw_cta')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
