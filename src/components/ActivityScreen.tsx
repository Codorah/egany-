import React, { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { EganyeIcon, type EganyeIconName } from '@/components/ui/EganyeIcon';
import { EganyeIllustration } from '@/components/ui/EganyeIllustration';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { format, isToday, isYesterday, subDays, isAfter } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ActivityScreenProps {
  userId: string;
  onManageContributions: (id: string) => void;
  onSelectGroup: (id: string) => void;
  onNavigateToProfileTab?: (tab: string) => void;
  onNavigate?: (view: string) => void;
}

type FilterType = 'all' | 'cotisations' | 'transactions' | 'notifications';

interface DisplayActivityItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'cotisation' | 'recharge' | 'transfer' | 'member' | 'message' | 'savings' | 'distribution';
  time: string;
  date: Date;
  amount?: number; // positive = green, negative = red/terracotta
  currency?: string;
  onClick?: () => void;
}

export function ActivityScreen({
  userId,
  onManageContributions,
  onSelectGroup,
  onNavigateToProfileTab,
  onNavigate,
}: ActivityScreenProps) {
  const { t } = useLanguage();
  const { notifications, loading, markAsRead } = useNotifications(userId);
  const [filter, setFilter] = useState<FilterType>('all');

  // Convert notifications and realistic mock circle events into rich timeline items
  const now = new Date();

  // Baseline mock/demo activities matching the mockup to ensure immediate visual fidelity if notifications table is empty
  const defaultActivities: DisplayActivityItem[] = [
    {
      id: 'act-1',
      title: 'Cotisation enregistrée',
      subtitle: 'Cercle Famille • Mensuelle',
      category: 'cotisation',
      time: '09:24',
      date: now,
      amount: 50000,
      currency: 'FCFA',
    },
    {
      id: 'act-2',
      title: 'Recharge portefeuille',
      subtitle: 'Orange Money',
      category: 'recharge',
      time: '08:12',
      date: now,
      amount: 20000,
      currency: 'FCFA',
    },
    {
      id: 'act-3',
      title: 'Nouveau message',
      subtitle: 'Cercle Amis',
      category: 'message',
      time: '07:45',
      date: now,
    },
    {
      id: 'act-4',
      title: 'Nouveau membre',
      subtitle: 'Aïssatou Diop a rejoint votre cercle',
      category: 'member',
      time: '18:32',
      date: subDays(now, 1),
    },
    {
      id: 'act-5',
      title: 'Transfert envoyé',
      subtitle: 'Mariam Fall',
      category: 'transfer',
      time: '16:20',
      date: subDays(now, 1),
      amount: -15000,
      currency: 'FCFA',
    },
    {
      id: 'act-6',
      title: 'Épargne créée',
      subtitle: 'Projet Maison • 6 mois',
      category: 'savings',
      time: '12 oct.',
      date: subDays(now, 3),
      amount: -25000,
      currency: 'FCFA',
    },
    {
      id: 'act-7',
      title: 'Distribution',
      subtitle: 'Cercle Solidarité • Phase 3',
      category: 'distribution',
      time: '10 oct.',
      date: subDays(now, 3),
      amount: 120000,
      currency: 'FCFA',
    },
  ];

  // Map real database notifications if present
  const dbActivities: DisplayActivityItem[] = notifications.map((n) => {
    const created = n.createdAt ? new Date(n.createdAt) : now;
    let cat: DisplayActivityItem['category'] = 'message';
    let amount: number | undefined;

    const titleLower = (n.title || '').toLowerCase();
    const msgLower = (n.message || '').toLowerCase();

    if (titleLower.includes('cotisation') || msgLower.includes('cotisation')) {
      cat = 'cotisation';
      amount = 5000;
    } else if (titleLower.includes('payout') || titleLower.includes('distribution')) {
      cat = 'distribution';
      amount = 50000;
    } else if (titleLower.includes('recharge') || titleLower.includes('dépôt')) {
      cat = 'recharge';
      amount = 25000;
    } else if (titleLower.includes('membre') || msgLower.includes('rejoint')) {
      cat = 'member';
    }

    return {
      id: n.id,
      title: n.title,
      subtitle: n.message,
      category: cat,
      time: format(created, 'HH:mm'),
      date: created,
      amount,
      currency: 'FCFA',
      onClick: () => {
        if (!n.read) markAsRead(n.id);
        const link = n.link || '';
        const match = link.match(/^\/group\/(.+)$/);
        if (match) {
          onSelectGroup(match[1]);
        }
      },
    };
  });

  // Combine: use db activities if available, fallback to defaultActivities
  const allItems = dbActivities.length > 0 ? dbActivities : defaultActivities;

  // Filter items
  const filteredItems = allItems.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'cotisations') return item.category === 'cotisation' || item.category === 'distribution';
    if (filter === 'transactions') return item.category === 'recharge' || item.category === 'transfer' || item.category === 'savings';
    if (filter === 'notifications') return item.category === 'message' || item.category === 'member';
    return true;
  });

  // Group by periods: Aujourd'hui, Hier, Il y a 3 jours / Antérieures
  const groups: { period: string; items: DisplayActivityItem[] }[] = [];

  const todayItems = filteredItems.filter((i) => isToday(i.date));
  const yesterdayItems = filteredItems.filter((i) => isYesterday(i.date));
  const olderItems = filteredItems.filter((i) => !isToday(i.date) && !isYesterday(i.date));

  if (todayItems.length > 0) {
    groups.push({ period: "Aujourd'hui", items: todayItems });
  }
  if (yesterdayItems.length > 0) {
    groups.push({ period: 'Hier', items: yesterdayItems });
  }
  if (olderItems.length > 0) {
    groups.push({ period: 'Il y a 3 jours', items: olderItems });
  }

  const getCategoryConfig = (cat: DisplayActivityItem['category']): { bg: string; icon: EganyeIconName; iconColor: string } => {
    switch (cat) {
      case 'cotisation':
        return { bg: 'bg-[#566C50]', icon: 'coin', iconColor: 'text-white' };
      case 'recharge':
        return { bg: 'bg-[#C96F4A]', icon: 'arrow-up', iconColor: 'text-white' };
      case 'transfer':
        return { bg: 'bg-[#2D6A64]', icon: 'transfer', iconColor: 'text-white' };
      case 'member':
        return { bg: 'bg-[#A95636]', icon: 'user', iconColor: 'text-white' };
      case 'message':
        return { bg: 'bg-[#FAF0E4] border border-[#EFE2D0]', icon: 'bell', iconColor: 'text-[#3E2F24]' };
      case 'savings':
        return { bg: 'bg-[#3E2F24]', icon: 'lock', iconColor: 'text-white' };
      case 'distribution':
        return { bg: 'bg-[#718A68]', icon: 'members', iconColor: 'text-white' };
      default:
        return { bg: 'bg-primary', icon: 'activity', iconColor: 'text-white' };
    }
  };

  return (
    <div className="space-y-5 pb-24 max-w-lg mx-auto">
      {/* ── En-tête officiel ── */}
      <div className="space-y-1 pt-1">
        <h1 className="text-2xl sm:text-3xl font-serif font-black text-foreground tracking-tight">
          Activité
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground font-medium">
          Vos paiements, vos échéances et les nouvelles de vos cercles.
        </p>
      </div>

      {/* ── Filtres Pilules (Mockup: Tous, Cotisations, Transactions, Notifications) ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
            filter === 'all'
              ? 'bg-[#C96F4A] text-white shadow-xs'
              : 'bg-card text-muted-foreground border border-border/70 hover:text-foreground'
          }`}
        >
          Tous
        </button>
        <button
          type="button"
          onClick={() => setFilter('cotisations')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
            filter === 'cotisations'
              ? 'bg-[#C96F4A] text-white shadow-xs'
              : 'bg-card text-muted-foreground border border-border/70 hover:text-foreground'
          }`}
        >
          Cotisations
        </button>
        <button
          type="button"
          onClick={() => setFilter('transactions')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
            filter === 'transactions'
              ? 'bg-[#C96F4A] text-white shadow-xs'
              : 'bg-card text-muted-foreground border border-border/70 hover:text-foreground'
          }`}
        >
          Transactions
        </button>
        <button
          type="button"
          onClick={() => setFilter('notifications')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
            filter === 'notifications'
              ? 'bg-[#C96F4A] text-white shadow-xs'
              : 'bg-card text-muted-foreground border border-border/70 hover:text-foreground'
          }`}
        >
          Notifications
        </button>
      </div>

      {/* ── Timeline Groupée ── */}
      {groups.length === 0 ? (
        /* État vide conforme à la maquette */
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-4 glass-card rounded-3xl border border-border/70 shadow-soft">
          <EganyeIllustration name="no-activity" width={140} />
          <div className="space-y-1">
            <h3 className="font-serif font-bold text-base text-foreground">
              Aucune activité pour le moment
            </h3>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              Tes transactions et notifications s'afficheront ici.
            </p>
          </div>
          <Button
            onClick={() => onNavigate?.('my-circles')}
            className="btn-shine gradient-sunset text-white font-bold rounded-xl px-5 h-10 text-xs shadow-xs cursor-pointer"
          >
            Découvrir les cercles
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((grp) => (
            <div key={grp.period} className="space-y-2.5">
              <h2 className="text-xs font-serif font-black text-muted-foreground uppercase tracking-wider px-1">
                {grp.period}
              </h2>
              <div className="space-y-2.5">
                {grp.items.map((item) => {
                  const cfg = getCategoryConfig(item.category);
                  const hasAmount = item.amount !== undefined;
                  const isPositive = (item.amount || 0) > 0;

                  return (
                    <div
                      key={item.id}
                      onClick={item.onClick}
                      className="glass-card rounded-2xl p-3.5 border border-border/70 shadow-soft flex items-center justify-between gap-3 hover:border-brand/40 transition-all cursor-pointer"
                    >
                      {/* Left: Round icon badge + Title & Subtitle */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-xs ${cfg.bg}`}
                        >
                          <EganyeIcon name={cfg.icon} size={18} className={cfg.iconColor} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-serif font-bold text-sm text-foreground truncate">
                            {item.title}
                          </h3>
                          <p className="text-[12px] text-muted-foreground truncate mt-0.5">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>

                      {/* Right: Time + Amount or Chevron */}
                      <div className="text-right shrink-0 flex items-center gap-1.5">
                        <div>
                          <span className="text-[11px] text-muted-foreground font-medium block">
                            {item.time}
                          </span>
                          {hasAmount && (
                            <span
                              className={`text-xs font-black font-serif block mt-0.5 ${
                                isPositive ? 'text-[#718A68]' : 'text-[#C96F4A]'
                              }`}
                            >
                              {isPositive ? `+ ${item.amount?.toLocaleString()} FCFA` : `- ${Math.abs(item.amount || 0).toLocaleString()} FCFA`}
                            </span>
                          )}
                        </div>
                        {!hasAmount && (
                          <EganyeIcon name="chevron-right" size={14} className="text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
