import React, { useEffect, useState } from 'react';
import { Landmark, Lock, LockOpen, Loader2, AlertCircle, PlusCircle, Wallet, RefreshCw, Trash2, CalendarClock, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { UserProfile, PersonalVault } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
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
}

type BankTier = 'starter' | 'growth' | 'unlimited';
const TIERS: BankTier[] = ['starter', 'growth', 'unlimited'];

export function MyBank({ user }: MyBankProps) {
  const { t } = useLanguage();
  const [vaults, setVaults] = useState<PersonalVault[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [subscribing, setSubscribing] = useState<BankTier | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLockDays, setNewLockDays] = useState('30');
  const [creating, setCreating] = useState(false);

  const [activeVault, setActiveVault] = useState<PersonalVault | null>(null);
  const [amount, setAmount] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const hasActiveSubscription = user.bankTier && user.bankTier !== 'none'
    && !!user.bankSubscriptionExpiresAt
    && new Date(user.bankSubscriptionExpiresAt).getTime() > now;
  const maxVaults = hasActiveSubscription ? BANK_TIER_MAX_VAULTS[user.bankTier as string] : 0;

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
      toast.error(err.message || "Erreur lors de l'abonnement.");
    } finally {
      setSubscribing(null);
    }
  };

  const handleCreateVault = async () => {
    const lockDays = parseInt(newLockDays, 10);
    if (!newName.trim()) {
      toast.error(t('bank_name_label'));
      return;
    }
    if (!lockDays || lockDays <= 0) {
      toast.error(t('bank_lock_days_label'));
      return;
    }
    setCreating(true);
    try {
      const result = await createPersonalVault({ name: newName.trim(), description: newDescription.trim(), lockDays });
      if (!result.success) throw new Error(result.message);
      toast.success(result.message);
      setCreateOpen(false);
      setNewName('');
      setNewDescription('');
      setNewLockDays('30');
      await loadVaults();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création.');
    } finally {
      setCreating(false);
    }
  };

  const isUnlocked = (vault: PersonalVault) => new Date(vault.unlockAt).getTime() <= now;

  const handleDeposit = async () => {
    if (!activeVault) return;
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      toast.error('Veuillez indiquer un montant valide.');
      return;
    }
    if (value > user.walletBalance) {
      toast.error('Solde du portefeuille insuffisant.');
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
      toast.error(err.message || 'Erreur lors du dépôt.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleWithdraw = async () => {
    if (!activeVault) return;
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      toast.error('Veuillez indiquer un montant valide.');
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
      toast.error(err.message || 'Erreur lors du retrait.');
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
      toast.error(err.message || 'Erreur lors du re-blocage.');
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
      toast.error(err.message || 'Erreur lors de la suppression.');
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
        <AlertCircle className="w-8 h-8 text-danger" />
        <p className="text-sm font-bold text-foreground">Impossible de charger Ma Banque</p>
        <Button variant="outline" size="sm" onClick={loadVaults} className="mt-2 font-bold">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Hero Card with uncropped 3D avatar */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 shadow-soft border border-border/70 relative overflow-hidden flex items-center justify-between gap-3 bg-gradient-to-br from-card via-card to-amber-500/5">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[13px] font-bold border border-amber-500/20">
            <Lock className="w-3 h-3" />
            <span>Tirelire Personnelle Sécurisée</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">{t('my_bank')}</h1>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{t('my_bank_subtitle')}</p>
        </div>
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shadow-soft border-2 border-amber-500/30 shrink-0 bg-muted">
          <img
            src="/feature-my-bank.png"
            alt="Ma Banque"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {!hasActiveSubscription ? (
        <div className="space-y-4">
          <div className="glass-card rounded-3xl p-6 shadow-soft text-center space-y-2">
            <Lock className="w-8 h-8 text-brand mx-auto" />
            <h2 className="text-lg font-black text-foreground">{t('bank_no_subscription_title')}</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">{t('bank_no_subscription_desc')}</p>
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
                  className="w-full h-11 font-bold rounded-xl"
                  onClick={() => handleSubscribe(tier)}
                  disabled={subscribing !== null}
                >
                  {subscribing === tier ? <Loader2 className="w-4 h-4 animate-spin" /> : t('bank_subscribe_cta')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="glass-card rounded-2xl p-4 shadow-soft flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{t('bank_current_tier')}</p>
              <p className="font-bold text-foreground">{t(`bank_tier_${user.bankTier}`)}</p>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                {t('bank_vaults_used')}: {vaults.length}/{maxVaults}
              </p>
            </div>
            {user.bankTier !== 'unlimited' && (
              <Button
                variant="outline"
                size="sm"
                className="font-bold border-brand/30 text-brand hover:bg-brand/10"
                onClick={() => handleSubscribe(user.bankTier === 'starter' ? 'growth' : 'unlimited')}
                disabled={subscribing !== null}
              >
                {t('bank_upgrade_cta')}
              </Button>
            )}
          </div>

          <Button
            className="w-full h-12 font-bold rounded-xl"
            onClick={() => setCreateOpen(true)}
            disabled={vaults.length >= maxVaults}
          >
            <PlusCircle className="w-4 h-4 mr-2" /> {t('bank_create_new')}
          </Button>

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
                  <div key={vault.id} className="glass-card rounded-2xl p-5 shadow-soft space-y-3">
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

                    <p className="text-2xl font-black text-foreground">{vault.balance.toLocaleString()} FCFA</p>

                    <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                      <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                      {unlocked
                        ? t('bank_unlocked_label')
                        : `${t('bank_locked_until')} ${new Date(vault.unlockAt).toLocaleDateString()} ${new Date(vault.unlockAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
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
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('bank_create_new')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{t('bank_name_label')}</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('bank_name_placeholder')}
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{t('bank_description_label')}</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="rounded-xl"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{t('bank_lock_days_label')}</Label>
              <Input
                type="number"
                min={1}
                value={newLockDays}
                onChange={(e) => setNewLockDays(e.target.value)}
                className="rounded-xl h-11"
              />
              <p className="text-[13px] text-muted-foreground">{t('bank_lock_days_hint')}</p>
            </div>
            <Button className="w-full h-12 font-bold rounded-xl" onClick={handleCreateVault} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : t('bank_create_confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!activeVault} onOpenChange={(open) => !open && setActiveVault(null)}>
        <DialogContent className="max-w-md">
          {activeVault && (
            <>
              <DialogHeader>
                <DialogTitle>{activeVault.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Solde du portefeuille : {user.walletBalance.toLocaleString()} FCFA · Solde de la banque : {activeVault.balance.toLocaleString()} FCFA
                </p>
                <Input
                  type="number"
                  min={1}
                  placeholder="Montant (FCFA)"
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
