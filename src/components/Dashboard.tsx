import React, { useState, useEffect } from 'react';
import { motion, Variants } from 'motion/react';
import { EganyeIcon, type EganyeIconName } from '@/components/ui/EganyeIcon';
import { EganyeLogo } from '@/components/ui/EganyeLogo';
import { Group, UserProfile, WalletTransaction } from '@/types';
import { CreateGroupDialog } from './CreateGroupDialog';
import { EmptyState } from './ui/EmptyState';
import { CustomAvatar } from './CustomAvatar';
import { AmountDisplay } from './ui/AmountDisplay';
import { EganyeProgress } from './ui/EganyeProgress';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotifications } from '@/hooks/useNotifications';
import { supabase, createChannel } from '@/lib/supabase';
import { mapWalletTransactionRow } from '@/lib/mappers';
import { format, formatDistanceToNowStrict, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DashboardProps {
  user: UserProfile;
  groups: Group[];
  onSelectGroup: (id: string) => void;
  onManageContributions: (id: string) => void;
  onNavigateToProfileTab?: (tab: string) => void;
  onNavigate?: (view: string) => void;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.02,
    },
  },
};

const itemVariants: Variants = {
  hidden: { y: 12, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 140,
      damping: 18,
    },
  },
};

export function Dashboard({
  user,
  groups,
  onSelectGroup,
  onManageContributions,
  onNavigateToProfileTab,
  onNavigate,
}: DashboardProps) {
  const { t } = useLanguage();
  const [showBalance, setShowBalance] = useState(true);
  const { unreadCount } = useNotifications(user.uid);

  // Financial calculations
  const availableBalance = user.walletBalance || 0;
  const totalSaved = user.totalSaved ?? 0;
  const savingsGoal = 500000;
  const savingsPercent = Math.min(100, Math.round((totalSaved / savingsGoal) * 100));

  // Find next upcoming contribution
  const activeGroups = groups.filter((g) => g.status === 'active');
  const nextGroupToPay = activeGroups[0] || null;

  // Activité récente — les VRAIES opérations du portefeuille.
  //
  // Cet écran affichait jusqu'ici trois lignes écrites en dur (« Recharge
  // portefeuille +100 000 FCFA », « Cotisation enregistrée +50 000 FCFA »),
  // identiques pour tout le monde et sans aucun rapport avec le compte. Sur
  // un produit d'épargne, montrer des mouvements d'argent inventés sur
  // l'écran d'accueil ne relève pas du décor : on y lit son solde, on croit
  // ce qu'on y voit.
  const [recentActivities, setRecentActivities] = useState<WalletTransaction[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadActivities = async () => {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.uid)
        .order('date', { ascending: false })
        .limit(3);
      if (cancelled) return;
      if (error) console.error('Dashboard activities error:', error);
      setRecentActivities((data ?? []).map(mapWalletTransactionRow));
      setActivitiesLoading(false);
    };

    loadActivities();

    // Le solde se met à jour tout seul (canal temps réel de `profiles`) ; sans
    // ça, la liste juste en dessous resterait figée et les deux se
    // contrediraient à l'écran.
    const channel = createChannel(`dashboard-tx-${user.uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallet_transactions', filter: `user_id=eq.${user.uid}` },
        () => loadActivities()
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [user.uid]);

  /**
   * « 09:24 » aujourd'hui, « il y a 3 j » ensuite. Une heure précise n'a de
   * sens que pour ce qui vient d'arriver ; passé la journée, c'est l'ancienneté
   * qui renseigne.
   */
  const formatRelativeDate = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    if (isToday(date)) return format(date, 'HH:mm');
    return `il y a ${formatDistanceToNowStrict(date, { locale: fr })}`;
  };

  /** Icône et teinte selon la nature du mouvement. */
  const activityLook = (tx: WalletTransaction): { icon: EganyeIconName; bg: string } => {
    switch (tx.type) {
      case 'recharge':
        return { icon: 'wallet', bg: 'bg-[#FFF2E8] text-[#C96F4A]' };
      case 'contribution_debit':
        return { icon: 'cotisation', bg: 'bg-[#EBF5EA] text-[#718A68]' };
      case 'payout_credit':
        return { icon: 'distribution', bg: 'bg-[#EBF5EA] text-[#718A68]' };
      case 'withdraw':
        return { icon: 'withdraw', bg: 'bg-[#F4EFE6] text-[#3E2F24]' };
      default:
        return { icon: 'money', bg: 'bg-[#F4EFE6] text-[#3E2F24]' };
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4 sm:space-y-5 pb-20"
    >
      {/* ── 1. HEADER : Avatar + Bonjour [Prénom] 👋 + Notifications + Emblème ── */}
      <motion.div variants={itemVariants} className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => onNavigate?.('profile')}
            className="cursor-pointer shrink-0 transition-transform active:scale-95"
            title={t('profile')}
          >
            <CustomAvatar
              photoURL={user.photoURL}
              name={user.displayName || 'Eganyé'}
              size={46}
              className="border-2 border-[#EFE2D0] dark:border-border shadow-xs"
            />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-serif font-black text-foreground tracking-tight truncate flex items-center gap-1.5">
              <span>{t('dashboard_greeting')}</span>
              <span className="text-[#C96F4A]">
                {user.displayName?.split(' ')[0] || user.displayName || 'Ami'}
              </span>
              <span>👋</span>
            </h1>
            <p className="text-xs sm:text-[13px] text-muted-foreground font-medium truncate">
              {t('dashboard_subtitle') || 'Prends soin de ton argent, ensemble.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Notification bell with badge */}
          <button
            onClick={() => onNavigate?.('activity')}
            className="relative w-10 h-10 rounded-2xl bg-white dark:bg-card border border-[#EFE2D0] dark:border-border/80 shadow-soft flex items-center justify-center text-foreground hover:text-[#C96F4A] transition-colors cursor-pointer"
            aria-label="Notifications"
          >
            <EganyeIcon name="bell" size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[#C96F4A] ring-2 ring-white dark:ring-card" />
            )}
          </button>

          {/* Discreet Eganyé brand emblem */}
          <div className="w-10 h-10 rounded-2xl bg-[#F8F0E4] dark:bg-muted flex items-center justify-center shrink-0 border border-[#EFE2D0]/60 shadow-xs">
            <EganyeLogo size={24} />
          </div>
        </div>
      </motion.div>

      {/* ── 2. MON DISPONIBLE (Solde Portefeuille) ── */}
      <motion.div variants={itemVariants}>
        <div className="gradient-sunset-hero relative overflow-hidden rounded-[26px] p-5 sm:p-6 text-white shadow-soft">
          <div className="relative z-10 space-y-4">
            {/* Top row: Label & Visibility Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-[13px] font-medium text-white/90">
                  {t('available_balance') || 'Mon disponible'}
                </span>
                <button
                  onClick={() => setShowBalance(!showBalance)}
                  className="p-1 rounded-full hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
                  title={showBalance ? 'Masquer le solde' : 'Afficher le solde'}
                >
                  <EganyeIcon name={showBalance ? 'eye' : 'eye-off'} size={15} />
                </button>
              </div>

              <span className="text-[11px] font-bold text-white/75 uppercase tracking-wider bg-white/15 px-2.5 py-0.5 rounded-full border border-white/20">
                Portefeuille
              </span>
            </div>

            {/* Big Main Balance */}
            <div>
              <AmountDisplay
                amount={availableBalance}
                hidden={!showBalance}
                size="xl"
                className="text-white"
                currencyClassName="text-white/80"
              />
            </div>

            {/* Actions: Recharger & Retirer */}
            <div className="flex items-center gap-2.5 pt-1">
              <button
                onClick={() => onNavigate?.('wallet-recharge')}
                className="bg-white text-[#C96F4A] hover:bg-white/95 px-4 py-2 rounded-full font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition-transform active:scale-95"
              >
                <EganyeIcon name="plus" size={13} strokeWidth={2.5} />
                <span>{t('recharge') || 'Recharger'}</span>
              </button>

              <button
                onClick={() => onNavigate?.('wallet-withdraw')}
                className="bg-white/15 hover:bg-white/25 text-white border border-white/30 px-4 py-2 rounded-full font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition-transform active:scale-95"
              >
                <EganyeIcon name="withdraw" size={13} strokeWidth={2} />
                <span>{t('withdraw') || 'Retirer'}</span>
              </button>
            </div>
          </div>

          {/* Decorative background glow */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-black/10 rounded-full blur-xl pointer-events-none" />
        </div>
      </motion.div>

      {/* ── 3. ACTION PRIORITAIRE ("À faire maintenant") ── */}
      <motion.div variants={itemVariants}>
        <div className="bg-white dark:bg-card border border-[#EFE2D0] dark:border-border/80 rounded-2xl p-4 sm:p-5 shadow-soft">
          {nextGroupToPay ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#C96F4A] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#C96F4A] animate-pulse" />
                  <span>À faire maintenant</span>
                </span>
                <span className="text-[11px] font-bold text-muted-foreground">
                  Échéance : {format(new Date(nextGroupToPay.nextPayoutDate), 'dd MMMM', { locale: fr })}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-serif font-bold text-base text-foreground truncate">
                    {nextGroupToPay.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Votre cotisation de cycle est attendue.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-lg font-serif font-black text-foreground">
                    {nextGroupToPay.contributionAmount.toLocaleString()} FCFA
                  </span>
                </div>
              </div>

              <button
                onClick={() => onManageContributions(nextGroupToPay.id)}
                className="btn-shine gradient-sunset w-full h-11 rounded-xl text-white font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
              >
                <span>Cotiser — {nextGroupToPay.contributionAmount.toLocaleString()} FCFA</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EBF5EA] text-[#718A68] flex items-center justify-center shrink-0">
                  <EganyeIcon name="check" size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <p className="font-serif font-bold text-sm text-foreground">
                    {t('dash_all_caught_up_title') || 'Tout est à jour !'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Aucune cotisation en attente pour le moment.
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigate?.('my-circles')}
                className="text-xs font-bold text-[#C96F4A] hover:underline shrink-0 cursor-pointer"
              >
                Découvrir
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── 4. MES CERCLES (Épargne collective) ── */}
      <motion.div variants={itemVariants} className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-serif font-black text-foreground tracking-tight">
              {t('active_circles') || 'Mes cercles'}
            </h2>
          </div>
          <button
            onClick={() => onNavigate?.('my-circles')}
            className="text-xs font-bold text-[#C96F4A] hover:opacity-80 transition-opacity flex items-center gap-0.5 cursor-pointer"
          >
            <span>{t('view_all') || 'Voir tout'}</span>
            <EganyeIcon name="chevron-right" size={13} />
          </button>
        </div>

        {groups.length === 0 ? (
          <CreateGroupDialog
            onNavigateToVerification={() => onNavigateToProfileTab?.('kyc')}
            trigger={
              <div>
                <EmptyState
                  illustration="no-circles"
                  title={t('no_circle_title')}
                  description={t('no_circle_desc')}
                  actionText={t('create_first_circle')}
                  onAction={() => {}}
                />
              </div>
            }
          />
        ) : (
          <div className="space-y-2.5">
            {groups.slice(0, 3).map((group) => (
              <div
                key={group.id}
                onClick={() => onSelectGroup(group.id)}
                className="bg-white dark:bg-card border border-[#EFE2D0] dark:border-border/80 rounded-2xl p-4 shadow-soft flex items-center justify-between gap-3 hover:border-[#C96F4A]/40 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-[#F0E6D8] text-[#718A68] flex items-center justify-center shrink-0 font-serif font-black text-base">
                    {group.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-foreground text-sm truncate group-hover:text-[#C96F4A] transition-colors">
                      {group.name}
                    </h4>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                      {group.members.length} membres · {group.contributionAmount.toLocaleString()} FCFA
                    </p>
                    <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                      Prochaine : {format(new Date(group.nextPayoutDate), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#EBF5EA] text-[#718A68] border border-[#718A68]/25">
                    Actif
                  </span>
                  <EganyeIcon
                    name="chevron-right"
                    size={16}
                    className="text-muted-foreground group-hover:text-[#C96F4A] transition-colors"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── 5. MA BANQUE — APERÇU (Épargne personnelle) ── */}
      <motion.div variants={itemVariants} className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-serif font-black text-foreground tracking-tight">
            Mon épargne
          </h2>
          <button
            onClick={() => onNavigate?.('my-bank')}
            className="text-xs font-bold text-[#C96F4A] hover:opacity-80 transition-opacity flex items-center gap-0.5 cursor-pointer"
          >
            <span>Voir mon épargne</span>
            <EganyeIcon name="chevron-right" size={13} />
          </button>
        </div>

        <div className="bg-white dark:bg-card rounded-2xl p-4 sm:p-5 border border-[#EFE2D0] dark:border-border/80 shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F0E6D8] dark:bg-muted flex items-center justify-center text-[#718A68] shrink-0">
                <EganyeIcon name="savings" size={20} strokeWidth={2} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Épargne totale</p>
                <p className="text-lg sm:text-xl font-serif font-black text-foreground">
                  {totalSaved.toLocaleString()} FCFA
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-[#718A68] bg-[#EBF5EA] px-2.5 py-1 rounded-full border border-[#718A68]/20">
              {savingsPercent}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="space-y-1 pt-1">
            <EganyeProgress value={totalSaved} max={savingsGoal} variant="bar" tone="secondary" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Objectif : {savingsGoal.toLocaleString()} FCFA</span>
              <span className="font-bold text-[#718A68]">{savingsPercent}%</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── 6. ACTIVITÉ RÉCENTE (3 Derniers Flux) ── */}
      <motion.div variants={itemVariants} className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-serif font-black text-foreground tracking-tight">
            Activité récente
          </h2>
          <button
            onClick={() => onNavigate?.('activity')}
            className="text-xs font-bold text-[#C96F4A] hover:opacity-80 transition-opacity flex items-center gap-0.5 cursor-pointer"
          >
            <span>Voir toute l'activité</span>
            <EganyeIcon name="chevron-right" size={13} />
          </button>
        </div>

        <div className="bg-white dark:bg-card border border-[#EFE2D0] dark:border-border/80 rounded-2xl p-3 shadow-soft divide-y divide-[#EFE2D0]/60 dark:divide-border/60">
          {activitiesLoading ? (
            // Trois lignes grises plutôt qu'un vide : l'écran garde sa hauteur
            // et ne sursaute pas quand les données arrivent.
            <div className="space-y-3 py-1" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-2">
                  <div className="w-9 h-9 rounded-xl bg-muted animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-2/5 rounded bg-muted animate-pulse" />
                    <div className="h-2.5 w-1/4 rounded bg-muted animate-pulse" />
                  </div>
                  <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          ) : recentActivities.length === 0 ? (
            <div className="py-7 px-3 text-center space-y-1.5">
              <div className="w-11 h-11 rounded-2xl bg-[#FFF2E8] text-[#C96F4A] flex items-center justify-center mx-auto">
                <EganyeIcon name="wallet" size={20} />
              </div>
              <p className="font-bold text-foreground text-sm pt-1">Aucune opération pour l’instant</p>
              <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[15rem] mx-auto">
                Rechargez votre portefeuille pour commencer à cotiser.
              </p>
              <button
                type="button"
                onClick={() => onNavigate?.('wallet-recharge')}
                className="text-xs font-bold text-[#C96F4A] hover:opacity-80 transition-opacity pt-1 cursor-pointer"
              >
                Recharger mon portefeuille
              </button>
            </div>
          ) : (
            recentActivities.map((act) => {
              const look = activityLook(act);
              // Le montant est signé en base : le signe porte le sens, la
              // couleur ne fait que le souligner.
              const positive = act.amount >= 0;
              return (
                <div
                  key={act.id}
                  onClick={() => onNavigate?.('activity')}
                  className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors rounded-xl cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl ${look.bg} flex items-center justify-center shrink-0`}>
                      <EganyeIcon name={look.icon} size={17} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground text-xs sm:text-sm truncate">
                        {act.description || 'Opération'}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {act.status === 'pending' ? 'En attente' : formatRelativeDate(act.date)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className={`font-serif font-bold text-xs sm:text-sm tabular-nums ${
                        positive ? 'text-[#718A68]' : 'text-[#C96F4A]'
                      }`}
                    >
                      {positive ? '+' : '−'}{Math.abs(act.amount).toLocaleString()} FCFA
                    </p>
                    <p className="text-[10px] text-muted-foreground">{formatRelativeDate(act.date)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
