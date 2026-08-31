import React, { useState } from 'react';
import { motion, Variants } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  Users, 
  TrendingUp, 
  ShieldCheck, 
  ArrowRight, 
  Wallet, 
  PlusCircle, 
  Search, 
  Sparkles, 
  PiggyBank, 
  Calendar, 
  Gift, 
  Clock, 
  Info, 
  CheckCircle2,
  AlertCircle,
  Banknote,
  Store,
  Bot,
  Eye,
  EyeOff,
  ChevronRight,
  Landmark,
  ArrowUpRight,
  ArrowDownLeft,
  CalendarDays,
  CircleDot
} from 'lucide-react';
import { Group, UserProfile } from '@/types';
import { CreateGroupDialog } from './CreateGroupDialog';
import { DashboardCharts } from './DashboardCharts';
import { DashboardNotifications } from './DashboardNotifications';
import { EmptyState } from './ui/EmptyState';
import { useLanguage } from '@/contexts/LanguageContext';
import { format, differenceInDays } from 'date-fns';
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
  const [showReliabilityInfo, setShowReliabilityInfo] = useState(false);
  const [showBalance, setShowBalance] = useState(true);

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

  // Quick Action Items (Circular, style Wave / Revolut / Orange Money)
  const quickActions = [
    {
      id: 'my-circles',
      label: t('nav_circles') || 'Cercles',
      icon: Users,
      color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
      action: () => onNavigate?.('my-circles'),
    },
    {
      id: 'my-bank',
      label: t('my_bank') || 'Ma Banque',
      icon: Landmark,
      color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25',
      action: () => onNavigate?.('my-bank'),
    },
    {
      id: 'marketplace',
      label: t('marketplace') || 'Services',
      icon: Store,
      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
      action: () => onNavigate?.('marketplace'),
    },
    {
      id: 'ai-assistant',
      label: t('ai_assistant') || 'Copilote',
      icon: Bot,
      color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25',
      action: () => onNavigate?.('ai-assistant'),
    },
    {
      id: 'calendar',
      label: t('calendar') || 'Échéances',
      icon: CalendarDays,
      color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25',
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
              <p className="text-3xl sm:text-4xl font-serif font-black text-white tracking-tight mt-0.5">
                {showBalance ? availableBalance.toLocaleString() : '••••••'}{' '}
                <span className="text-sm font-sans font-bold text-white/75">FCFA</span>
              </p>
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
        <div className="grid grid-cols-5 gap-2">
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

      {/* Action Highlights (Swipable or Stacked Cards) */}
      <motion.div variants={itemVariants} className="space-y-2.5">
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 -mx-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:overflow-visible md:mx-0 md:px-0 md:pb-0">
          
          {/* Card 1: Prochaine Cotisation */}
          <div className="glass-card rounded-2xl p-4 shadow-soft space-y-2.5 relative overflow-hidden shrink-0 snap-start w-[80vw] sm:w-[300px] md:w-auto md:shrink border border-border/70">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> {t('next_contribution')}
              </span>
              {nextGroupToPay && (
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[13px] py-0 px-2">
                  {nextGroupToPay.frequency}
                </Badge>
              )}
            </div>

            {nextGroupToPay ? (
              <>
                <div>
                  <h3 className="font-serif font-bold text-sm text-foreground truncate">{nextGroupToPay.name}</h3>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-black text-foreground">
                      {nextGroupToPay.contributionAmount.toLocaleString()}
                    </span>
                    <span className="text-[13px] text-muted-foreground font-bold">{nextGroupToPay.currency}</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    {t('deadline_prefix')} {format(new Date(nextGroupToPay.nextPayoutDate), 'dd MMM yyyy', { locale: fr })}
                  </p>
                </div>
                <Button
                  onClick={() => onManageContributions(nextGroupToPay.id)}
                  size="sm"
                  className="w-full gradient-sunset text-white font-bold rounded-xl h-8 text-xs cursor-pointer shadow-xs"
                >
                  {t('contribute_now')}
                </Button>
              </>
            ) : (
              <div className="py-3 text-center">
                <p className="text-xs text-muted-foreground">{t('no_pending_contribution')}</p>
              </div>
            )}
          </div>

          {/* Card 2: Mon Prochain Tour */}
          <div className="glass-card rounded-2xl p-4 shadow-soft space-y-2.5 relative overflow-hidden shrink-0 snap-start w-[80vw] sm:w-[300px] md:w-auto md:shrink border border-border/70">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5" /> {t('next_payout_turn')}
              </span>
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[13px] py-0 px-2">
                {t('distribution_label')}
              </Badge>
            </div>

            {nextPayoutGroup ? (
              <>
                <div>
                  <h3 className="font-serif font-bold text-sm text-foreground truncate">{nextPayoutGroup.name}</h3>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                      {(nextPayoutGroup.contributionAmount * nextPayoutGroup.members.length).toLocaleString()}
                    </span>
                    <span className="text-[13px] text-muted-foreground font-bold">{nextPayoutGroup.currency}</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    {t('estimated_date_prefix')} {format(new Date(nextPayoutGroup.nextPayoutDate), 'dd MMM yyyy', { locale: fr })}
                  </p>
                </div>
                <Button
                  onClick={() => onSelectGroup(nextPayoutGroup.id)}
                  size="sm"
                  variant="outline"
                  className="w-full text-xs font-bold rounded-xl h-8 border-border text-foreground hover:bg-muted cursor-pointer"
                >
                  {t('details')}
                </Button>
              </>
            ) : (
              <div className="py-3 text-center">
                <p className="text-xs text-muted-foreground">{t('join_circle_to_plan')}</p>
              </div>
            )}
          </div>

          {/* Card 3: Score de Fiabilité */}
          <div className="glass-card rounded-2xl p-4 shadow-soft space-y-2.5 relative overflow-hidden shrink-0 snap-start w-[80vw] sm:w-[300px] md:w-auto md:shrink border border-border/70">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> {t('reliability_score')}
              </span>
              <button
                onClick={() => setShowReliabilityInfo(true)}
                className="text-[13px] font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <Info className="w-3 h-3" /> {t('details')}
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-serif font-black text-foreground">{user.reputationScore}</span>
                <span className="text-xs text-muted-foreground font-bold">/ 100</span>
              </div>
              <Progress value={user.reputationScore} className="h-1.5 bg-emerald-500/15" />
              <div className="flex items-center justify-between text-[13px] text-muted-foreground pt-0.5">
                <span>{t('payments_on_time')}</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">100%</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Notifications Section */}
      <motion.div variants={itemVariants}>
        <DashboardNotifications
          userId={user.uid}
          onManageContributions={onManageContributions}
          onSelectGroup={onSelectGroup}
          onNavigateToProfileTab={onNavigateToProfileTab}
        />
      </motion.div>

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
            {groups.map((group) => {
              const progressPct = Math.round((group.currentPayoutIndex / Math.max(group.members.length, 1)) * 100);
              return (
                <div
                  key={group.id}
                  onClick={() => onSelectGroup(group.id)}
                  className="glass-card rounded-2xl p-3.5 shadow-soft border border-border/70 hover:border-brand/40 transition-all cursor-pointer flex items-center gap-3 active:scale-[0.99]"
                >
                  {/* Circle emblem / avatar */}
                  <div className="w-11 h-11 rounded-2xl bg-brand/10 text-brand flex items-center justify-center shrink-0 font-serif font-black text-base border border-brand/20">
                    {group.name.substring(0, 2).toUpperCase()}
                  </div>

                  {/* Circle info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-serif font-bold text-sm text-foreground truncate">{group.name}</h3>
                      <Badge className={`text-[12px] py-0 px-1.5 font-bold ${
                        group.status === 'active' 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {t(`freq_${group.frequency}`)}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-[13px] text-muted-foreground mt-1">
                      <span>{group.members.length} {t('participants')}</span>
                      <span>•</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">{progressPct}% complété</span>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-1.5 w-full bg-muted rounded-full h-1 overflow-hidden">
                      <div className="bg-brand h-full rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>

                  {/* Amount & Arrow */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-foreground">
                      {group.contributionAmount.toLocaleString()}
                    </p>
                    <p className="text-[12px] font-bold text-muted-foreground uppercase">{group.currency}</p>
                    <div className="flex justify-end mt-1 text-muted-foreground">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Chart Section */}
      <motion.div variants={itemVariants}>
        <DashboardCharts user={user} groups={groups} />
      </motion.div>

      {/* Reliability Score Info Modal */}
      <Dialog open={showReliabilityInfo} onOpenChange={setShowReliabilityInfo}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-serif font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              {t('reliability_modal_title')}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t('reliability_modal_desc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-1">
              <div className="flex items-center justify-between font-bold text-emerald-700 dark:text-emerald-300">
                <span>{t('payments_on_time')}</span>
                <span>+50 Pts</span>
              </div>
              <p className="text-[13px] text-muted-foreground">{t('reliability_pts_ontime_desc')}</p>
            </div>

            <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl space-y-1">
              <div className="flex items-center justify-between font-bold text-primary">
                <span>{t('reliability_seniority')}</span>
                <span>+30 Pts</span>
              </div>
              <p className="text-[13px] text-muted-foreground">{t('reliability_seniority_desc')}</p>
            </div>

            <div className="p-3 bg-muted/40 rounded-2xl space-y-1">
              <div className="flex items-center justify-between font-bold text-foreground">
                <span>{t('reliability_penalty')}</span>
                <span className="text-rose-500">{t('reliability_penalty_pts')}</span>
              </div>
              <p className="text-[13px] text-muted-foreground">{t('reliability_penalty_desc')}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
