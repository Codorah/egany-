import React, { useEffect, useMemo, useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { EganyeIcon, type EganyeIconName } from '@/components/ui/EganyeIcon';
import { EganyeIllustration } from '@/components/ui/EganyeIllustration';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase, createChannel } from '@/lib/supabase';
import { mapWalletTransactionRow } from '@/lib/mappers';
import { WalletTransaction } from '@/types';
import { format, isToday, isYesterday, subDays, isAfter } from 'date-fns';
import { enUS, fr } from 'date-fns/locale';

interface ActivityScreenProps {
  userId: string;
  onManageContributions: (id: string) => void;
  onSelectGroup: (id: string) => void;
  onNavigateToProfileTab?: (tab: string) => void;
  onNavigate?: (view: string) => void;
}

interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  icon: EganyeIconName;
  date: Date;
  /** Mouvement réel uniquement : une notification ne porte jamais de montant. */
  amount?: number;
  pending?: boolean;
  unread?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
}

const TX_ICON: Record<string, EganyeIconName> = {
  recharge: 'deposit',
  contribution_debit: 'cotisation',
  payout_credit: 'distribution',
  withdraw: 'withdraw',
};

/** Ce qui est arrivé à votre argent et à vos cercles, du plus récent au plus ancien. */
export function ActivityScreen({ userId, onSelectGroup, onNavigateToProfileTab, onNavigate }: ActivityScreenProps) {
  const { t, language } = useLanguage();
  const locale = language === 'en' ? enUS : fr;
  const { notifications, loading: notificationsLoading, markAsRead, deleteNotification } = useNotifications(userId);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (error) console.error('Activity transactions error:', error);
      else setTransactions((data ?? []).map(mapWalletTransactionRow));
      setTransactionsLoading(false);
    };
    load();
    const channel = createChannel(`activity-tx-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallet_transactions', filter: `user_id=eq.${userId}` },
        () => load()
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [userId]);

  const groups = useMemo(() => {
    const items: ActivityItem[] = [
      ...transactions.map((tx): ActivityItem => ({
        id: `tx-${tx.id}`,
        title: tx.description || t('dash_operation_fallback'),
        subtitle: tx.status === 'pending' ? t('status_pending') : tx.status === 'failed' ? t('act_status_failed') : '',
        icon: TX_ICON[tx.type] ?? 'money',
        date: new Date(tx.date),
        amount: tx.amount,
        pending: tx.status === 'pending',
        onClick: () => { setSelectedProfileWallet(); },
      })),
      ...notifications.map((n): ActivityItem => ({
        id: `n-${n.id}`,
        title: n.title,
        subtitle: n.message,
        icon: 'bell',
        date: n.createdAt ? new Date(n.createdAt) : new Date(),
        unread: !n.read,
        onClick: () => {
          if (!n.read) markAsRead(n.id);
          const match = (n.link || '').match(/^\/group\/(.+)$/);
          if (match) onSelectGroup(match[1]);
        },
        onDelete: () => deleteNotification(n.id),
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    // Regroupement par période réelle : une date fausse ferait douter de tout le relevé.
    const weekAgo = subDays(new Date(), 7);
    const monthAgo = subDays(new Date(), 30);
    const periods: { period: string; items: ActivityItem[] }[] = [
      { period: t('act_period_today'), items: items.filter((i) => isToday(i.date)) },
      { period: t('act_period_yesterday'), items: items.filter((i) => isYesterday(i.date)) },
      { period: t('act_period_this_week'), items: items.filter((i) => !isToday(i.date) && !isYesterday(i.date) && isAfter(i.date, weekAgo)) },
      { period: t('act_period_this_month'), items: items.filter((i) => !isAfter(i.date, weekAgo) && isAfter(i.date, monthAgo)) },
      { period: t('act_period_older'), items: items.filter((i) => !isAfter(i.date, monthAgo)) },
    ];
    return periods.filter((p) => p.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, notifications, language]);

  function setSelectedProfileWallet() {
    onNavigateToProfileTab?.('wallet');
  }

  if (notificationsLoading || transactionsLoading) {
    return (
      <div className="space-y-3 max-w-lg mx-auto" aria-hidden="true">
        <div className="h-5 w-24 rounded bg-muted animate-pulse" />
        <div className="h-48 rounded-2xl bg-muted animate-pulse" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 px-6 text-center space-y-4 max-w-lg mx-auto">
        <EganyeIllustration name="no-activity" width={140} />
        <div className="space-y-1">
          <h2 className="font-bold text-base text-foreground">{t('act_empty_title')}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{t('act_empty_desc')}</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate?.('my-circles')}
          className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm cursor-pointer"
        >
          {t('act_empty_cta')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4 max-w-lg mx-auto">
      {groups.map((group) => (
        <section key={group.period} className="space-y-2">
          <h2 className="text-[13px] font-bold text-muted-foreground px-1">{group.period}</h2>
          <div className="rounded-2xl bg-card border border-border divide-y divide-border overflow-hidden">
            {group.items.map((item) => (
              <div key={item.id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={item.onClick}
                  className="flex-1 min-w-0 min-h-[60px] pl-4 pr-3 py-3 flex items-center gap-3 text-left cursor-pointer transition-colors duration-150 active:bg-muted"
                >
                  <span className="relative shrink-0 text-muted-foreground">
                    <EganyeIcon name={item.icon} size={20} />
                    {item.unread && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary" aria-label={t('act_unread')} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground truncate">{item.title}</span>
                    {item.subtitle && <span className="block text-[13px] text-muted-foreground truncate mt-0.5">{item.subtitle}</span>}
                  </span>
                  <span className="shrink-0 text-right">
                    {item.amount !== undefined && (
                      <span className={`block text-sm font-bold tabular-nums ${item.amount >= 0 ? 'text-secondary' : 'text-foreground'}`}>
                        {item.amount >= 0 ? '+' : '−'}{Math.abs(item.amount).toLocaleString('fr-FR')} F
                      </span>
                    )}
                    <span className="block text-[13px] text-muted-foreground">
                      {isToday(item.date) || isYesterday(item.date) ? format(item.date, 'HH:mm') : format(item.date, 'd MMM', { locale })}
                    </span>
                  </span>
                </button>
                {item.onDelete && (
                  <button
                    type="button"
                    onClick={item.onDelete}
                    className="w-11 shrink-0 flex items-center justify-center text-muted-foreground cursor-pointer transition-colors duration-150 active:bg-muted"
                    aria-label={t('act_delete_notification')}
                  >
                    <EganyeIcon name="close" size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
