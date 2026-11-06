import React, { useState, useEffect } from 'react';
import { SettingsGroup, SettingsRow } from './ui/SettingsList';
import { EganyeIcon, type EganyeIconName } from '@/components/ui/EganyeIcon';
import { Group, UserProfile, WalletTransaction } from '@/types';
import { CreateGroupDialog } from './CreateGroupDialog';
import { EmptyState } from './ui/EmptyState';
import { AmountDisplay } from './ui/AmountDisplay';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMyDues } from '@/hooks/useMyDues';
import { supabase, createChannel } from '@/lib/supabase';
import { mapWalletTransactionRow } from '@/lib/mappers';
import { format, formatDistanceToNowStrict, isToday } from 'date-fns';
import { enUS, fr } from 'date-fns/locale';
import { AssistantInsight } from './AssistantInsight';

interface DashboardProps {
  user: UserProfile;
  groups: Group[];
  onSelectGroup: (id: string) => void;
  onManageContributions: (id: string) => void;
  onNavigateToProfileTab?: (tab: string) => void;
  onNavigate?: (view: string) => void;
}

const SECTION_TITLE = 'text-base font-bold text-foreground';
const SECTION_LINK = 'h-11 -my-2 -mr-2 px-2 inline-flex items-center gap-0.5 text-[13px] font-bold text-primary-ink cursor-pointer';

export function Dashboard({
  user,
  groups,
  onSelectGroup,
  onManageContributions,
  onNavigateToProfileTab,
  onNavigate,
}: DashboardProps) {
  const { t, language } = useLanguage();
  const locale = language === 'en' ? enUS : fr;
  const [showBalance, setShowBalance] = useState(true);
  const { dues, loading: duesLoading } = useMyDues(user.uid, groups);

  const payable = dues.filter((d) => !d.awaitingApproval);
  const awaiting = dues.filter((d) => d.awaitingApproval);
  const nextDue = payable[0] ?? null;

  // Activité récente — les VRAIES opérations du portefeuille. Le solde se met à
  // jour tout seul (temps réel de `profiles`) : sans ce canal, la liste juste en
  // dessous resterait figée et les deux se contrediraient à l'écran.
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

    const channel = createChannel(`dashboard-tx-${user.uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallet_transactions', filter: `user_id=eq.${user.uid}` },
        () => loadActivities()
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [user.uid]);

  /** « 09:24 » aujourd'hui, « il y a 3 j » ensuite. */
  const formatRelativeDate = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    if (isToday(date)) return format(date, 'HH:mm');
    return language === 'en'
      ? `${formatDistanceToNowStrict(date, { locale: enUS })} ago`
      : `il y a ${formatDistanceToNowStrict(date, { locale: fr })}`;
  };

  const activityIcon = (tx: WalletTransaction): EganyeIconName => {
    switch (tx.type) {
      case 'recharge': return 'deposit';
      case 'contribution_debit': return 'cotisation';
      case 'payout_credit': return 'distribution';
      case 'withdraw': return 'withdraw';
      default: return 'money';
    }
  };

  /** Ce que le cercle attend de la personne, s'il attend quelque chose. */
  const circleStatus = (group: Group): { label: string; tone: string } | null => {
    if (dues.some((d) => d.groupId === group.id && !d.awaitingApproval)) {
      return { label: t('cir_status_to_pay'), tone: 'text-primary-ink' };
    }
    if (group.status === 'active' && group.payoutOrder.indexOf(user.uid) === group.currentPayoutIndex) {
      return { label: t('cir_your_turn'), tone: 'text-secondary' };
    }
    return null;
  };

  return (
    <div className="space-y-7 pb-4 max-w-lg mx-auto">
      {/* ── Solde : la première réponse de cet écran ── */}
      <section className="space-y-4" aria-label={t('available_balance')}>
        <div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold text-muted-foreground">{t('available_balance')}</span>
            <button
              type="button"
              onClick={() => setShowBalance(!showBalance)}
              className="w-11 h-11 -my-3 flex items-center justify-center rounded-full text-muted-foreground cursor-pointer"
              aria-label={showBalance ? t('dash_hide_balance') : t('dash_show_balance')}
            >
              <EganyeIcon name={showBalance ? 'eye' : 'eye-off'} size={18} />
            </button>
          </div>
          <AmountDisplay amount={user.walletBalance || 0} hidden={!showBalance} size="xl" className="text-foreground" currencyClassName="text-muted-foreground" />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate?.('wallet-recharge')}
            className="h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-opacity duration-150 active:opacity-85"
          >
            <EganyeIcon name="plus" size={18} />
            <span>{t('recharge')}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('wallet-withdraw')}
            className="h-12 rounded-xl border border-input bg-card text-foreground font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors duration-150 active:bg-muted"
          >
            <EganyeIcon name="withdraw" size={18} />
            <span>{t('withdraw')}</span>
          </button>
        </div>
      </section>

      <AssistantInsight user={user} groups={groups} onNavigate={onNavigate} />

      {/* ── À payer : lu dans les cotisations réelles ── */}
      {duesLoading ? (
        <div className="h-24 rounded-2xl bg-muted animate-pulse" aria-hidden="true" />
      ) : nextDue ? (
        <section className="rounded-2xl bg-card border border-border p-4 space-y-3" aria-label={t('dash_to_pay')}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-[13px] font-bold ${nextDue.isLate ? 'text-danger' : 'text-muted-foreground'}`}>
                {nextDue.isLate ? t('dash_to_pay_late') : t('dash_to_pay')}
              </p>
              <h2 className="text-base font-bold text-foreground truncate mt-0.5">{nextDue.groupName}</h2>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                {t('dash_due_prefix')} {format(new Date(nextDue.dueDate), 'd MMMM', { locale })}
              </p>
            </div>
            <p className="text-lg font-bold text-foreground tabular-nums shrink-0">
              {nextDue.amount.toLocaleString('fr-FR')} {nextDue.currency}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onManageContributions(nextDue.groupId)}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm cursor-pointer transition-opacity duration-150 active:opacity-85"
          >
            {t('dash_contribute_cta')}
          </button>
          {payable.length > 1 && (
            <button
              type="button"
              onClick={() => onNavigate?.('cotiser')}
              className="w-full h-11 -mb-2 text-[13px] font-bold text-primary-ink cursor-pointer"
            >
              {payable.length - 1} {t('dash_others_to_pay')}
            </button>
          )}
        </section>
      ) : groups.length > 0 ? (
        <section className="flex items-center gap-3 px-1" aria-label={t('dash_to_pay')}>
          <EganyeIcon name="check" size={20} className="text-secondary shrink-0" />
          <p className="text-sm font-semibold text-foreground">
            {awaiting.length > 0 ? t('dash_awaiting_approval') : t('dash_nothing_to_pay')}
          </p>
        </section>
      ) : null}

      {/* ── Mes cercles ── */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className={SECTION_TITLE}>{t('active_circles')}</h2>
          {groups.length > 0 && (
            <button type="button" onClick={() => onNavigate?.('my-circles')} className={SECTION_LINK}>
              <span>{t('view_all')}</span>
              <EganyeIcon name="chevron-right" size={14} />
            </button>
          )}
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
          <div className="rounded-2xl bg-card border border-border divide-y divide-border overflow-hidden">
            {groups.slice(0, 3).map((group) => {
              const status = circleStatus(group);
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => onSelectGroup(group.id)}
                  className="w-full min-h-[60px] px-4 py-3 flex items-center justify-between gap-3 text-left cursor-pointer transition-colors duration-150 active:bg-muted"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-foreground text-sm truncate">{group.name}</p>
                    <p className="text-[13px] text-muted-foreground mt-0.5">
                      {group.contributionAmount.toLocaleString('fr-FR')} {group.currency} · {t('dash_next_prefix')} {format(new Date(group.nextPayoutDate), 'd MMM', { locale })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {status && <span className={`text-[13px] font-bold ${status.tone}`}>{status.label}</span>}
                    <EganyeIcon name="chevron-right" size={16} className="text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Derniers mouvements ── */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className={SECTION_TITLE}>{t('dash_recent_activity')}</h2>
          <button type="button" onClick={() => onNavigate?.('activity')} className={SECTION_LINK}>
            <span>{t('dash_view_all_activity')}</span>
            <EganyeIcon name="chevron-right" size={14} />
          </button>
        </div>

        {activitiesLoading ? (
          <div className="h-32 rounded-2xl bg-muted animate-pulse" aria-hidden="true" />
        ) : recentActivities.length === 0 ? (
          <div className="rounded-2xl bg-card border border-border px-4 py-5 text-center">
            <p className="font-bold text-foreground text-sm">{t('dash_no_operation_title')}</p>
            <p className="text-[13px] text-muted-foreground leading-relaxed mt-1">{t('dash_no_operation_desc')}</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-card border border-border divide-y divide-border overflow-hidden">
            {recentActivities.map((act) => {
              const positive = act.amount >= 0;
              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => onNavigate?.('activity')}
                  className="w-full min-h-[60px] px-4 py-3 flex items-center gap-3 text-left cursor-pointer transition-colors duration-150 active:bg-muted"
                >
                  <EganyeIcon name={activityIcon(act)} size={20} className="text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground text-sm truncate">{act.description || t('dash_operation_fallback')}</p>
                    <p className="text-[13px] text-muted-foreground truncate">
                      {act.status === 'pending' ? t('status_pending') : formatRelativeDate(act.date)}
                    </p>
                  </div>
                  {/* Le signe porte le sens, la couleur ne fait que le souligner. */}
                  <p className={`font-bold text-sm tabular-nums shrink-0 ${positive ? 'text-secondary' : 'text-foreground'}`}>
                    {positive ? '+' : '−'}{Math.abs(act.amount).toLocaleString('fr-FR')} F
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Le reste, en une ligne chacun ── */}
      <SettingsGroup>
        <SettingsRow
          icon="vault"
          tone="muted"
          label={t('my_bank')}
          hint={`${t('dash_total_contributed')} : ${(user.totalSaved ?? 0).toLocaleString('fr-FR')} FCFA`}
          onClick={() => onNavigate?.('my-bank')}
        />
        <SettingsRow
          icon="calendar-finance"
          tone="muted"
          label={t('calendar')}
          onClick={() => onNavigate?.('calendar')}
        />
        <SettingsRow
          icon="investment"
          tone="muted"
          label={t('marketplace')}
          hint={t('dash_services_card_subtitle')}
          onClick={() => onNavigate?.('marketplace')}
        />
      </SettingsGroup>
    </div>
  );
}
