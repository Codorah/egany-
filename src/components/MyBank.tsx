import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Group, UserProfile, PersonalVault } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { SuccessState } from './ui/SuccessState';
import { ErrorState } from './ui/ErrorState';
import { EganyeIcon, type EganyeIconName } from './ui/EganyeIcon';
import { AmountField, FlowNotice, FlowRow, FlowScreen } from './ui/FlowScreen';
import { ConfirmationBottomSheet } from './ui/ConfirmationBottomSheet';
import { EmptyState } from './ui/EmptyState';
import { EganyeProgress } from './ui/EganyeProgress';
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

const PROJECT_CATEGORIES: { id: ProjectCategory; labelKey: string; icon: EganyeIconName }[] = [
  { id: 'scolaire', labelKey: 'bank_project_scolaire', icon: 'studies' },
  { id: 'voyage', labelKey: 'bank_project_voyage', icon: 'travel' },
  { id: 'maison', labelKey: 'bank_project_maison', icon: 'house' },
  { id: 'urgence', labelKey: 'bank_project_urgence', icon: 'shield' },
  { id: 'commerce', labelKey: 'bank_project_commerce', icon: 'coin' },
  { id: 'autre', labelKey: 'bank_project_autre', icon: 'savings' },
];

const GOAL_SUGGESTIONS = [50000, 100000, 250000, 500000];
/** Ajoutés au montant saisi, jamais à sa place. */
const ADD_AMOUNTS = [10000, 25000, 50000];

const fcfa = (value: number) => `${value.toLocaleString('fr-FR')} FCFA`;

export function MyBank({ user, groups, onNavigate }: MyBankProps) {
  const { t } = useLanguage();
  const [vaults, setVaults] = useState<PersonalVault[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [subscribing, setSubscribing] = useState<BankTier | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [showAllReservations, setShowAllReservations] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [confirmTier, setConfirmTier] = useState<BankTier | null>(null);

  // Creation Flow — 4-step wizard
  const [view, setView] = useState<'list' | 'create'>('list');
  const [createStep, setCreateStep] = useState(1);
  const [createProject, setCreateProject] = useState<ProjectCategory>('scolaire');
  const [createProjectCustom, setCreateProjectCustom] = useState('');
  const [createAmount, setCreateAmount] = useState('100000');
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
      setConfirmTier(null);
    }
  };

  const openCreateFlow = (presetProject?: ProjectCategory, presetAmount?: string) => {
    setCreateStep(1);
    setCreateProject(presetProject || 'scolaire');
    setCreateProjectCustom('');
    setCreateAmount(presetAmount || '100000');
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

      const result = await createPersonalVault({
        name: getProjectLabel(),
        description: `Objectif : ${goalAmount} FCFA`,
        lockDays,
      });
      if (!result.success) throw new Error(result.message);

      const freshVaults = await fetchMyVaults(user.uid);
      setVaults(freshVaults);
      setCreatedVault(freshVaults.find((v) => v.id === result.vaultId) || null);
      setJustCreated(true);
      toast.success(t('mb_toast_created'));
    } catch (err: any) {
      toast.error(err.message || t('bank_create_error'));
    } finally {
      setCreating(false);
    }
  };

  const handleCreateNextStep = () => {
    if (createStep === 1) {
      if (createProject === 'autre' && !createProjectCustom.trim()) {
        toast.error(t('mb_toast_name_required'));
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

  // Même opération (coffre + montant) = même clé : si la réponse se perd et que
  // la personne retape, le serveur ne l'exécute pas deux fois.
  const vaultOpKeys = React.useRef(new Map<string, string>());
  const vaultOpKey = (op: string, vaultId: string, value: number) => {
    const id = `${op}:${vaultId}:${value}`;
    if (!vaultOpKeys.current.has(id)) vaultOpKeys.current.set(id, crypto.randomUUID());
    return { id, key: vaultOpKeys.current.get(id)! };
  };

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
      const op = vaultOpKey('deposit', activeVault.id, value);
      const result = await depositToVault(activeVault.id, value, op.key);
      if (!result.success) throw new Error(result.message);
      vaultOpKeys.current.delete(op.id);
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
      toast.error(t('mb_toast_over_vault'));
      return;
    }

    if (!isUnlocked(activeVault) && !forced) {
      setShowEarlyUnlockConfirm(true);
      return;
    }

    setActionBusy(true);
    try {
      const op = vaultOpKey('withdraw', activeVault.id, value);
      const result = await withdrawFromVault(activeVault.id, value, op.key);
      if (!result.success) throw new Error(result.message);
      vaultOpKeys.current.delete(op.id);
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
      toast.error(t('mb_toast_withdraw_first'));
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

  // handleCreateVault embarque l'objectif choisi dans la description au
  // format « Objectif : N FCFA » faute de colonne dédiée côté DB — un seul
  // point d'analyse pour ne pas diverger entre le total et l'affichage par coffre.
  const getVaultGoal = (vault: PersonalVault) => {
    const match = vault.description?.match(/(\d[\d\s.,]*)/);
    const parsed = match ? parseInt(match[0].replace(/\D/g, ''), 10) : 0;
    return parsed > 0 ? parsed : Math.max(vault.balance, 100000);
  };

  const getVaultIcon = (vaultName: string, description?: string): EganyeIconName => {
    const text = `${vaultName} ${description || ''}`.toLowerCase();
    if (text.includes('voyag') || text.includes('trave') || text.includes('vol') || text.includes('vacanc')) return 'travel';
    if (text.includes('étud') || text.includes('etud') || text.includes('scol') || text.includes('ecol') || text.includes('univ')) return 'studies';
    if (text.includes('urgenc') || text.includes('santé') || text.includes('sante') || text.includes('secours') || text.includes('imprévu')) return 'shield';
    if (text.includes('maison') || text.includes('logem') || text.includes('loyer') || text.includes('habit')) return 'house';
    if (text.includes('commerc') || text.includes('affair') || text.includes('boutiqu')) return 'coin';
    return 'savings';
  };

  // Calculations for Total Savings — jamais de chiffre inventé : à 0 coffre,
  // l'épargne et l'objectif affichés sont 0, pas une donnée de démonstration.
  const totalSaved = vaults.reduce((sum, v) => sum + (v.balance || 0), 0);
  const totalGoal = vaults.reduce((sum, v) => sum + getVaultGoal(v), 0);
  const progressPercent = totalGoal > 0 ? Math.min(100, Math.round((totalSaved / totalGoal) * 100)) : 0;

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

  const dateLong = (value: string) => new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  // ── NOUVEAU COFFRE : une question par écran ──
  if (view === 'create') {
    if (justCreated) {
      return (
        <FlowScreen title="Nouveau coffre" onBack={closeCreateFlow}>
          <SuccessState
            title="Coffre créé"
            description="Ajoutez-y de l'argent quand vous voulez."
            actionText="Ajouter de l'argent"
            onAction={() => {
              closeCreateFlow();
              if (createdVault) {
                setActiveVault(createdVault);
                setActionAmount('');
              }
            }}
            secondaryActionText="Voir mon épargne"
            onSecondaryAction={closeCreateFlow}
          />
        </FlowScreen>
      );
    }

    const next = (
      <Button onClick={handleCreateNextStep} className="w-full h-12 rounded-xl font-bold text-[15px] cursor-pointer">
        {t('mb_continue')}
      </Button>
    );

    if (createStep === 1) {
      return (
        <FlowScreen title="Nouveau coffre" step={1} totalSteps={CREATE_TOTAL_STEPS} heading="Pour quel projet ?" onBack={closeCreateFlow} footer={next}>
          <div role="radiogroup" aria-label="Projet" className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {PROJECT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="radio"
                aria-checked={createProject === cat.id}
                onClick={() => setCreateProject(cat.id)}
                className="w-full min-h-[52px] flex items-center gap-3 px-4 text-left cursor-pointer active:bg-muted transition-colors duration-150"
              >
                <EganyeIcon name={cat.icon} size={20} className="text-muted-foreground shrink-0" />
                <span className="flex-1 text-[15px] font-semibold text-foreground">{t(cat.labelKey) || cat.id}</span>
                {createProject === cat.id && <EganyeIcon name="check" size={18} strokeWidth={2.5} className="text-primary-ink shrink-0" />}
              </button>
            ))}
          </div>

          {createProject === 'autre' && (
            <div className="space-y-1.5">
              <Label htmlFor="vault_custom_name" className="text-sm font-bold text-foreground">Nom de votre projet</Label>
              <Input
                id="vault_custom_name"
                value={createProjectCustom}
                onChange={(e) => setCreateProjectCustom(e.target.value)}
                placeholder="Ex : achat d'une moto"
                className="rounded-xl h-12 text-base"
                autoFocus
              />
            </div>
          )}
        </FlowScreen>
      );
    }

    if (createStep === 2) {
      return (
        <FlowScreen title="Nouveau coffre" step={2} totalSteps={CREATE_TOTAL_STEPS} heading="Combien voulez-vous atteindre ?" onBack={handleCreatePrevStep} footer={next}>
          <AmountField value={createAmount} onChange={setCreateAmount} suggestions={GOAL_SUGGESTIONS} />
        </FlowScreen>
      );
    }

    if (createStep === 3) {
      return (
        <FlowScreen title="Nouveau coffre" step={3} totalSteps={CREATE_TOTAL_STEPS} heading="Jusqu'à quand ?" onBack={handleCreatePrevStep} footer={next}>
          <div className="space-y-1.5">
            <Label htmlFor="vault_deadline" className="text-sm font-bold text-foreground">Date de déblocage</Label>
            <Input
              id="vault_deadline"
              type="date"
              min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
              value={createDeadline}
              onChange={(e) => setCreateDeadline(e.target.value)}
              className="rounded-xl h-12 text-base"
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: t('mb_dur_1m'), months: 1 },
              { label: t('mb_dur_3m'), months: 3 },
              { label: t('mb_dur_6m'), months: 6 },
              { label: t('mb_dur_1y'), months: 12 },
            ].map((dur) => (
              <button
                key={dur.label}
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setMonth(d.getMonth() + dur.months);
                  setCreateDeadline(d.toISOString().slice(0, 10));
                }}
                className="min-h-11 text-center text-sm font-bold rounded-xl border border-border bg-card text-foreground cursor-pointer active:bg-muted transition-colors duration-150"
              >
                {dur.label}
              </button>
            ))}
          </div>
          <FlowNotice>{t('mb_reserved_desc')}</FlowNotice>
        </FlowScreen>
      );
    }

    return (
      <FlowScreen
        title="Nouveau coffre"
        step={4}
        totalSteps={CREATE_TOTAL_STEPS}
        heading="Vérifiez votre coffre"
        onBack={handleCreatePrevStep}
        footer={
          <Button onClick={handleCreateVault} disabled={creating} className="w-full h-12 rounded-xl font-bold text-[15px] cursor-pointer">
            {creating ? 'Création en cours…' : 'Créer mon coffre'}
          </Button>
        }
      >
        <div className="rounded-2xl border border-border bg-card px-4 divide-y divide-border">
          <FlowRow label="Projet" value={getProjectLabel()} />
          <FlowRow label="Objectif" value={fcfa(parseFloat(createAmount) || 0)} strong />
          <FlowRow label="Date de déblocage" value={createDeadline ? dateLong(createDeadline) : '—'} />
        </div>
      </FlowScreen>
    );
  }

  const tierIndex = hasActiveSubscription ? TIERS.indexOf(user.bankTier as BankTier) : -1;
  const offeredTiers = TIERS.filter((_, index) => index > tierIndex);
  const tierCapacity = (tier: BankTier) =>
    BANK_TIER_MAX_VAULTS[tier] >= 999 ? 'Coffres sans limite' : `${BANK_TIER_MAX_VAULTS[tier]} coffres`;

  // ── MON ÉPARGNE ──
  return (
    <div className="space-y-6 pb-20 max-w-lg mx-auto">
      <p className="text-sm text-muted-foreground">{t('my_bank_subtitle')}</p>

      {vaults.length > 0 && (
        <div className="px-1 space-y-2">
          <div>
            <p className="text-sm text-muted-foreground">{t('bank_total_savings') || 'Épargne totale'}</p>
            <p className="text-[34px] leading-tight font-bold text-foreground tabular-nums">{fcfa(totalSaved)}</p>
          </div>
          <EganyeProgress value={totalSaved} max={totalGoal || 1} variant="bar" tone="secondary" />
          <p className="text-[13px] text-muted-foreground">
            {progressPercent} % de {fcfa(totalGoal)}
          </p>
        </div>
      )}

      {vaults.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-3">
            <h2 className="text-[13px] font-bold text-muted-foreground">{t('bank_my_reservations') || 'Mes coffres'}</h2>
            {vaults.length > 4 && (
              <button
                type="button"
                onClick={() => setShowAllReservations(!showAllReservations)}
                className="min-h-11 -my-3 text-[13px] font-bold text-primary-ink cursor-pointer"
              >
                {showAllReservations ? 'Réduire' : (t('bank_view_all') || 'Voir tout')}
              </button>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {(showAllReservations ? vaults : vaults.slice(0, 4)).map((vault) => {
              const unlocked = isUnlocked(vault);
              return (
                <button
                  key={vault.id}
                  type="button"
                  onClick={() => { setActiveVault(vault); setActionAmount(''); }}
                  className="w-full min-h-[60px] flex items-center gap-3 px-4 py-3 text-left cursor-pointer active:bg-muted transition-colors duration-150"
                >
                  <EganyeIcon name={getVaultIcon(vault.name, vault.description)} size={20} className="text-muted-foreground shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold text-foreground truncate">{vault.name}</span>
                    <span className="block text-[13px] text-muted-foreground">
                      {unlocked
                        ? t('mb_available_for_withdrawal')
                        : `${t('mb_unlock_prefix')} ${new Date(vault.unlockAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-sm font-bold text-foreground tabular-nums">{vault.balance.toLocaleString('fr-FR')} F</span>
                    <span className="block text-[13px] text-muted-foreground tabular-nums">sur {getVaultGoal(vault).toLocaleString('fr-FR')}</span>
                  </span>
                  <EganyeIcon name="chevron-right" size={16} className="text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <EmptyState
          illustration="circle-empty"
          title={t('bank_empty_title') || 'Aucune épargne pour le moment'}
          description={t('bank_empty_desc')}
          actionText="Créer mon premier coffre"
          onAction={() => openCreateFlow()}
        />
      )}

      {vaults.length > 0 && (
        <div>
          <Button
            onClick={() => openCreateFlow()}
            disabled={!canCreateVault}
            className="w-full h-12 rounded-xl font-bold text-[15px] cursor-pointer"
          >
            Créer un coffre
          </Button>
          {!canCreateVault && (
            <p className="text-[13px] text-center text-muted-foreground mt-2">{t('bank_cap_reached_note')}</p>
          )}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-[13px] font-bold text-muted-foreground px-3">{t('bank_wallet_balance_label') || 'Mon solde disponible'}</h2>
        <div className="rounded-2xl border border-border bg-card px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-[15px] font-bold text-foreground tabular-nums truncate">{fcfa(user.walletBalance || 0)}</span>
          <span className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate?.('wallet-recharge')}
              className="min-h-11 px-3 text-sm font-bold text-primary-ink cursor-pointer"
            >
              {t('recharge') || 'Recharger'}
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('wallet-withdraw')}
              className="min-h-11 px-3 text-sm font-bold text-foreground cursor-pointer"
            >
              {t('withdraw') || 'Retirer'}
            </button>
          </span>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] font-bold text-muted-foreground px-3">Ma formule</h2>
        <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          <div className="min-h-[52px] flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-[15px] font-semibold text-foreground">
              {hasActiveSubscription ? t(`bank_tier_${user.bankTier}`) : 'Gratuite'}
            </span>
            <span className="text-sm text-muted-foreground shrink-0">
              {vaults.length} sur {maxVaults >= 999 ? '∞' : maxVaults} {maxVaults > 1 ? 'coffres' : 'coffre'}
            </span>
          </div>
          {/* Le prix se lit sur la ligne, et rien n'est débité sans confirmation. */}
          {offeredTiers.map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setConfirmTier(tier)}
              disabled={subscribing !== null}
              className="w-full min-h-[60px] flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer active:bg-muted transition-colors duration-150 disabled:opacity-50"
            >
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold text-foreground">{t(`bank_tier_${tier}`)}</span>
                <span className="block text-[13px] text-muted-foreground">{tierCapacity(tier)}</span>
              </span>
              <span className="text-sm font-bold text-foreground shrink-0 tabular-nums">
                {BANK_TIER_PRICE[tier].toLocaleString('fr-FR')} F {t('bank_per_month')}
              </span>
              <EganyeIcon name="chevron-right" size={16} className="text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </section>

      {/* Les graphiques consomment des données : on ne les charge que sur demande. */}
      {showCharts ? (
        <DashboardCharts user={user} groups={groups} />
      ) : (
        <button
          type="button"
          onClick={() => setShowCharts(true)}
          className="w-full min-h-[52px] flex items-center justify-between gap-3 px-4 rounded-2xl border border-border bg-card text-left cursor-pointer active:bg-muted transition-colors duration-150"
        >
          <span className="text-[15px] font-semibold text-foreground">Voir l'évolution de mon épargne</span>
          <EganyeIcon name="chevron-right" size={16} className="text-muted-foreground shrink-0" />
        </button>
      )}

      {/* ── COFFRE EN PLEIN ÉCRAN ── */}
      {activeVault && (() => {
        const unlocked = isUnlocked(activeVault);
        const daysLeft = Math.max(0, Math.ceil((new Date(activeVault.unlockAt).getTime() - now) / (24 * 60 * 60 * 1000)));

        return (
          <FlowScreen
            title={activeVault.name}
            onBack={() => setActiveVault(null)}
            footer={
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="h-12 rounded-xl font-bold text-[15px] cursor-pointer"
                  onClick={() => handleWithdraw(false)}
                  disabled={actionBusy || activeVault.balance <= 0}
                >
                  Retirer
                </Button>
                <Button className="h-12 rounded-xl font-bold text-[15px] cursor-pointer" onClick={handleDeposit} disabled={actionBusy}>
                  Déposer
                </Button>
              </div>
            }
          >
            <div className="px-1">
              <p className="text-sm text-muted-foreground">Dans ce coffre</p>
              <p className="text-[34px] leading-tight font-bold text-foreground tabular-nums">{fcfa(activeVault.balance)}</p>
              <p className="text-[13px] text-muted-foreground mt-1">
                {unlocked
                  ? t('mb_lock_over_desc')
                  : `${t('mb_reserved_for')} ${daysLeft} ${daysLeft > 1 ? t('gd_days') : t('gd_day')} · ${dateLong(activeVault.unlockAt)}`}
              </p>
            </div>

            <AmountField value={actionAmount} onChange={setActionAmount} />
            <div className="flex flex-wrap gap-2">
              {ADD_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setActionAmount(String((parseFloat(actionAmount) || 0) + amt))}
                  className="min-h-11 px-3 text-sm font-bold rounded-xl border border-border bg-card text-foreground cursor-pointer active:bg-muted transition-colors duration-150"
                >
                  +{amt.toLocaleString('fr-FR')}
                </button>
              ))}
              {unlocked && activeVault.balance > 0 && (
                <button
                  type="button"
                  onClick={() => setActionAmount(activeVault.balance.toString())}
                  className="min-h-11 px-3 text-sm font-bold rounded-xl border border-border bg-card text-foreground cursor-pointer active:bg-muted transition-colors duration-150"
                >
                  {t('mb_withdraw_all')}
                </button>
              )}
            </div>
            <p className="text-[13px] text-muted-foreground">Sur votre portefeuille : {fcfa(user.walletBalance || 0)}</p>

            {unlocked && (
              <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleRelock(activeVault, 90)}
                  disabled={actionBusy}
                  className="w-full min-h-[52px] px-4 text-left text-[15px] font-semibold text-foreground cursor-pointer active:bg-muted disabled:opacity-50"
                >
                  Prolonger de 3 mois
                </button>
                {activeVault.balance === 0 && (
                  <button
                    type="button"
                    onClick={() => handleDelete(activeVault)}
                    disabled={actionBusy}
                    className="w-full min-h-[52px] px-4 text-left text-[15px] font-semibold text-danger cursor-pointer active:bg-muted disabled:opacity-50"
                  >
                    {t('mb_delete_vault')}
                  </button>
                )}
              </div>
            )}
          </FlowScreen>
        );
      })()}

      {/* ── RETRAIT AVANT LA DATE ── */}
      <ConfirmationBottomSheet
        isOpen={showEarlyUnlockConfirm}
        onClose={() => setShowEarlyUnlockConfirm(false)}
        onConfirm={() => handleWithdraw(true)}
        isLoading={actionBusy}
        title={t('mb_early_unlock_title')}
        description={t('mb_early_unlock_desc')}
        confirmLabel={t('mb_confirm')}
      />

      {/* ── ABONNEMENT : rien n'est débité sans ce geste ── */}
      <ConfirmationBottomSheet
        isOpen={confirmTier !== null}
        onClose={() => setConfirmTier(null)}
        onConfirm={() => { if (confirmTier) handleSubscribe(confirmTier); }}
        isLoading={subscribing !== null}
        type="debit"
        title={confirmTier ? t(`bank_tier_${confirmTier}`) : ''}
        description={confirmTier ? `${tierCapacity(confirmTier)}. Le prix est prélevé sur votre portefeuille.` : ''}
        amount={confirmTier ? BANK_TIER_PRICE[confirmTier] : undefined}
        confirmLabel="Confirmer"
      />
    </div>
  );
}
