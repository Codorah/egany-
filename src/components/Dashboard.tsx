import React, { useState } from 'react';
import { motion, Variants } from 'motion/react';
import { Button } from '@/components/ui/button';
import {
  Users,
  PlusCircle,
  Sparkles,
  Clock,
  Store,
  Bot,
  Eye,
  EyeOff,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  CalendarDays,
  Bell
} from 'lucide-react';
import { Group, UserProfile } from '@/types';
import { CreateGroupDialog } from './CreateGroupDialog';
import { EmptyState } from './ui/EmptyState';
import { TontineCard } from './ui/TontineCard';
import { AmountDisplay } from './ui/AmountDisplay';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotifications } from '@/hooks/useNotifications';
import { format } from 'date-fns';
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

export function Dashboard({ user, groups, onSelectGroup, onManageContributions, onNavigateToProfileTab, onNavigate }: DashboardProps) {
  const { t } = useLanguage();
  const [showBalance, setShowBalance] = useState(true);
  // Aperçu compact seulement — la liste complète des alertes vit sur son
  // propre onglet (Activité) pour ne pas surcharger l'accueil de deux fois
  // le même centre de notifications.
  const { unreadCount } = useNotifications(user.uid);

  // Financial calculations for "Mon Argent"
  const availableBalance = user.walletBalance || 0;
  const totalSaved = user.totalSaved || 0;
  
  // Find next upcoming contribution & next expected payout
  const activeGroups = groups.filter(g => g.status === 'active');
  const nextGroupToPay = activeGroups[0] || null;
  
  // Next payout circle
  const nextPayoutGroup = activeGroups.find(g => {
    const userIndexInOrder = g.payoutOrder.indexOf(user.uid);
    return userIndexInOrder >= g.currentPayoutIndex;
  }) || activeGroups[0] || null;

  const nextPayoutAmount = nextPayoutGroup ? (nextPayoutGroup.contributionAmount * nextPayoutGroup.members.length) : 0;

  // Quick Action Items — seulement ce qui n'a pas déjà son onglet principal
  // (Cercles et Ma Banque sont montés en onglets de la nav depuis la refonte).
  const quickActions = [
    {
      id: 'marketplace',
      label: t('marketplace') || 'Services',
      icon: Store,
      color: 'bg-secondary/10 text-secondary border-secondary/25',
      action: () => onNavigate?.('marketplace'),
    },
    {
      id: 'ai-assistant',
      label: t('ai_assistant') || 'Copilote',
      icon: Bot,
      color: 'bg-primary/10 text-primary border-primary/25',
      action: () => onNavigate?.('ai-assistant'),
    },
    {
      id: 'calendar',
      label: t('calendar') || 'Échéances',
      icon: CalendarDays,
      color: 'bg-sage/15 text-sage border-sage/30',
      action: () => onNavigate?.('calendar'),
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4 sm:space-y-5 pb-20"
    >
      {/* Header — Compact mobile greeting */}
      <motion.div
        variants={itemVariants}
        className="flex items-center justify-between pt-1"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-serif font-black text-foreground tracking-tight flex items-center gap-1.5">
            {t('dashboard_greeting')} {user.displayName?.split(' ')[0] || user.displayName} 👋
          </h1>
          <p className="text-[13px] sm:text-xs text-muted-foreground font-medium">
            {t('dashboard_subtitle')}
          </p>
        </div>
        <CreateGroupDialog
          onNavigateToVerification={() => onNavigateToProfileTab?.('kyc')}
          triggerIsNativeButton
          trigger={
            <Button
              size="sm"
              className="gradient-sunset text-white font-bold rounded-xl shadow-xs text-xs h-9 px-3 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">{t('cgd_new_circle_button')}</span>
              <span className="sm:hidden">Créer</span>
            </Button>
          }
        />
      </motion.div>

      {/* Hero Wallet Card — African Fintech Style (Wave / Revolut) */}
      <motion.div variants={itemVariants}>
        <div className="gradient-sunset rounded-3xl p-5 shadow-elevated relative overflow-hidden text-white">
          {/* Subtle decorative glow overlays */}
          <div className="absolute -top-12 -right-12 w-44 h-44 bg-white/15 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-amber-400/20 rounded-full blur-xl pointer-events-none" />

          <div className="relative space-y-4">
            {/* Top row: Label & Visibility Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-white/80 uppercase tracking-wider">{t('my_wallet')}</span>
                <button
                  onClick={() => setShowBalance(!showBalance)}
                  className="text-white/70 hover:text-white transition-colors cursor-pointer p-0.5"
                  title="Afficher/Masquer le solde"
                >
                  {showBalance ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                onClick={() => onNavigate?.('wallet-savings')}
                className="text-[13px] font-bold text-white/90 hover:text-white underline underline-offset-2 cursor-pointer"
              >
                {t('view_all')}
              </button>
            </div>

            {/* Big Main Balance */}
            <div>
              <span className="text-[13px] font-semibold text-white/70 uppercase tracking-wide">{t('available_balance')}</span>
              <div className="mt-0.5">
                <AmountDisplay
                  amount={availableBalance}
                  hidden={!showBalance}
                  size="xl"
                  className="text-white"
                  currencyClassName="text-white/75"
                />
              </div>
            </div>

            {/* 3 Action Buttons on Card (Recharge, Withdrawal, Details) */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                onClick={() => onNavigate?.('wallet-recharge')}
                size="sm"
                className="bg-white text-primary hover:bg-white/90 font-bold rounded-xl h-10 text-xs cursor-pointer shadow-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                <span>{t('recharge')}</span>
              </Button>
              <Button
                onClick={() => onNavigate?.('wallet-withdraw')}
                size="sm"
                variant="outline"
                className="bg-white/15 hover:bg-white/25 border-white/30 text-white font-bold rounded-xl h-10 text-xs cursor-pointer backdrop-blur-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Retirer</span>
              </Button>
            </div>

            {/* Micro Stats Bar */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/20">
              <div className="text-center sm:text-left">
                <span className="text-[12px] font-semibold text-white/70 uppercase tracking-tight block">{t('total_saved')}</span>
                <span className="text-xs font-black text-white">{totalSaved.toLocaleString()} F</span>
              </div>
              <div className="text-center sm:text-left">
                <span className="text-[12px] font-semibold text-white/70 uppercase tracking-tight block">{t('to_receive')}</span>
                <span className="text-xs font-black text-white">{nextPayoutAmount.toLocaleString()} F</span>
              </div>
              <div className="text-center sm:text-left">
                <span className="text-[12px] font-semibold text-white/70 uppercase tracking-tight block">{t('circles_active_short')}</span>
                <span className="text-xs font-black text-white">{groups.length}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Action Grid (Horizontal Wave / Orange Money style) */}
      <motion.div variants={itemVariants} className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-[13px] font-black uppercase tracking-wider text-muted-foreground">
            {t('quick_actions')}
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-2 max-w-xs">
          {quickActions.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={item.action}
                className="flex flex-col items-center gap-1.5 p-1 rounded-2xl group cursor-pointer active:scale-95 transition-all"
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-xs transition-transform duration-200 group-hover:scale-105 ${item.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[13px] font-bold text-foreground tracking-tight text-center leading-tight">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* PRIORITÉ NUMÉRO 1 : à faire — une seule action à la fois, pas
          trois cartes à interpréter. Le reste (prochain gain, score de
          fiabilité) vit dans la fiche du cercle et le Profil. */}
      <motion.div variants={itemVariants}>
        <div className="glass-card rounded-3xl p-4 sm:p-5 shadow-soft border border-border/70">
          {nextGroupToPay ? (
            <div className="space-y-3">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> {t('dash_today_action_title')}
              </span>
              <div>
                <AmountDisplay amount={nextGroupToPay.contributionAmount} currency={nextGroupToPay.currency} size="lg" />
                <h3 className="font-serif font-bold text-sm text-foreground truncate mt-0.5">{nextGroupToPay.name}</h3>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  {t('deadline_prefix')} {format(new Date(nextGroupToPay.nextPayoutDate), 'dd MMM yyyy', { locale: fr })}
                </p>
              </div>
              <Button
                onClick={() => onManageContributions(nextGroupToPay.id)}
                className="w-full gradient-sunset text-white font-bold rounded-xl h-10 cursor-pointer active:scale-95 transition-transform"
              >
                {t('contribute_now')}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-success-soft text-secondary flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="font-serif font-bold text-sm text-foreground">{t('dash_all_caught_up_title')}</p>
                <p className="text-[13px] text-muted-foreground">{t('no_pending_contribution')}</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Aperçu des alertes — juste un rappel discret ; la liste complète
          vit sur l'onglet Activité pour ne pas doubler ce centre d'alertes
          sur l'accueil. */}
      {unreadCount > 0 && (
        <motion.button
          variants={itemVariants}
          onClick={() => onNavigate?.('activity')}
          className="w-full glass-card rounded-2xl p-3.5 shadow-soft border border-danger/20 bg-danger/5 flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-transform"
        >
          <div className="w-9 h-9 rounded-xl bg-danger/15 text-danger flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4" />
          </div>
          <span className="flex-1 text-left text-[13px] font-bold text-foreground">
            {unreadCount} {t('unread_alerts_suffix')}
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </motion.button>
      )}

      {/* Active Circles Section — Mobile List Row View */}
      <motion.div variants={itemVariants} className="space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <div>
            <h2 className="text-base font-serif font-black text-foreground tracking-tight">
              {t('active_circles')}
            </h2>
            <p className="text-[13px] text-muted-foreground">{t('your_active_tontines')}</p>
          </div>
          <button
            onClick={() => onNavigate?.('my-circles')}
            className="text-xs font-bold text-brand hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <span>{t('view_all')}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {groups.length === 0 ? (
          <CreateGroupDialog
            onNavigateToVerification={() => onNavigateToProfileTab?.('kyc')}
            trigger={
              <div>
                <EmptyState
                  icon={Users}
                  title={t('no_circle_title')}
                  description={t('no_circle_desc')}
                  actionText={t('create_first_circle')}
                  onAction={() => {}}
                  variant="amber"
                />
              </div>
            }
          />
        ) : (
          <div className="space-y-2">
            {groups.map((group) => (
              <TontineCard key={group.id} group={group} onClick={() => onSelectGroup(group.id)} />
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
