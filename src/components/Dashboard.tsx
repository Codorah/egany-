import React from 'react';
import { motion } from 'motion/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Users, TrendingUp, ShieldCheck, ArrowRight, Wallet, PlusCircle, Search, Sparkles, CreditCard, PiggyBank } from 'lucide-react';
import { Group, UserProfile } from '@/types';
import { CreateGroupDialog } from './CreateGroupDialog';
import { DashboardCharts } from './DashboardCharts';
import { DashboardNotifications } from './DashboardNotifications';
import { EmptyState } from './ui/EmptyState';
import { useLanguage } from '@/contexts/LanguageContext';

interface DashboardProps {
  user: UserProfile;
  groups: Group[];
  onSelectGroup: (id: string) => void;
  onManageContributions: (id: string) => void;
  onNavigateToProfileTab?: (tab: string) => void;
  onNavigate?: (view: string) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

const itemVariants = {
  hidden: { y: 16, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 120,
      damping: 16,
    },
  },
};

const hoverScaleVariants = {
  hover: {
    y: -4,
    scale: 1.015,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 20,
    },
  },
  tap: {
    scale: 0.98,
  },
};

export function Dashboard({ user, groups, onSelectGroup, onManageContributions, onNavigateToProfileTab, onNavigate }: DashboardProps) {
  const { t } = useLanguage();

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 pb-12"
    >
      {/* Header and Welcome */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/30 p-6 rounded-3xl border border-border/60"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-foreground tracking-tight">
              {t('dashboard_greeting')}, {user.displayName} 👋
            </h1>
            {user.role === 'admin' && (
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                Admin
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            {t('dashboard_subtitle')}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2 w-full sm:w-auto">
          <CreateGroupDialog />
        </div>
      </motion.div>

      {/* Virtual Wallet & Financial Card Banner */}
      <motion.div variants={itemVariants}>
        <div className="relative overflow-hidden rounded-3xl gradient-card p-6 sm:p-8 text-white shadow-elevated border border-amber-900/40">
          {/* Subtle decorative shapes */}
          <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
          <div className="absolute right-1/4 -top-12 w-48 h-48 rounded-full bg-orange-500/10 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-center gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-200/80 text-xs font-bold uppercase tracking-wider">
                <Wallet className="w-4 h-4 text-primary" />
                <span>Portefeuille Numérique eganyé</span>
              </div>
              <div>
                <span className="text-xs text-amber-100/70 font-medium">Solde Disponible</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl sm:text-4xl font-serif font-black tracking-tight text-white">
                    {(user.walletBalance || 0).toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-amber-300">FCFA</span>
                </div>
              </div>
            </div>

            {/* Quick Actions inside Card Banner */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => onNavigateToProfileTab?.('wallet')}
                className="gradient-sunset text-white font-bold rounded-2xl h-11 px-5 shadow-xs hover:opacity-95 text-xs flex items-center gap-2 cursor-pointer border border-white/20"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Recharger Solde</span>
              </Button>
              <Button
                onClick={() => onNavigate?.('search-groups')}
                variant="outline"
                className="bg-white/10 text-white hover:bg-white/20 font-bold rounded-2xl h-11 px-4 text-xs border border-white/20 flex items-center gap-2 cursor-pointer backdrop-blur-xs"
              >
                <Search className="w-4 h-4 text-amber-300" />
                <span>Rechercher Tontine</span>
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Overview Stat Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 sm:grid-cols-3 gap-5"
      >
        {/* Score Card */}
        <motion.div whileHover={{ y: -2 }} className="h-full">
          <Card className="glass-card border-emerald-500/20 shadow-soft rounded-3xl h-full overflow-hidden relative group">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>{t('reputation_score')}</span>
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
              </CardTitle>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-3xl sm:text-4xl font-serif font-black text-foreground">
                  {user.reputationScore}
                </span>
                <span className="text-xs font-bold text-muted-foreground">/ 100</span>
              </div>
            </CardHeader>
            <CardContent>
              <Progress value={user.reputationScore} className="h-2 bg-emerald-500/15" />
              <p className="mt-3 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                {t('excellent_reliability')}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Total Saved Card */}
        <motion.div whileHover={{ y: -2 }} className="h-full">
          <Card className="glass-card shadow-soft rounded-3xl h-full overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>{t('total_saved')}</span>
                <PiggyBank className="w-4 h-4 text-primary" />
              </CardTitle>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-3xl sm:text-4xl font-serif font-black text-foreground">
                  {user.totalSaved.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-muted-foreground">FCFA</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                <TrendingUp className="w-4 h-4" />
                +12% {t('savings_accumulated')}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Active Groups Card */}
        <motion.div whileHover={{ y: -2 }} className="h-full">
          <Card className="glass-card shadow-soft rounded-3xl h-full overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>{t('active_groups')}</span>
                <Users className="w-4 h-4 text-primary" />
              </CardTitle>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-3xl sm:text-4xl font-serif font-black text-foreground">
                  {groups.length}
                </span>
                <span className="text-xs font-bold text-muted-foreground">{t('circles_unit')}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                <Users className="w-3.5 h-3.5 text-primary" />
                {user.groupsJoined || groups.length} {t('circles_joined')}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Notifications and Alerts Section */}
      <motion.div variants={itemVariants}>
        <DashboardNotifications
          userId={user.uid}
          onManageContributions={onManageContributions}
          onSelectGroup={onSelectGroup}
        />
      </motion.div>

      {/* Chart Section */}
      <motion.div variants={itemVariants}>
        <DashboardCharts user={user} groups={groups} />
      </motion.div>

      {/* Community Cultural Showcase Banner */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative h-44 rounded-3xl overflow-hidden shadow-soft group border border-border/60">
          <img
            src="/onboarding-mamas.png"
            alt="Mamans commerçantes et tontine"
            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-5 flex flex-col justify-end">
            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest">Épargne Solidaire</span>
            <h3 className="text-sm sm:text-base font-serif font-bold text-white leading-snug">
              La Tontine des Mamans & Commerçantes
            </h3>
            <p className="text-[11px] text-white/80 line-clamp-1">
              Faites fructifier vos revenus de marché en toute confiance.
            </p>
          </div>
        </div>

        <div className="relative h-44 rounded-3xl overflow-hidden shadow-soft group border border-border/60">
          <img
            src="/young-savers.png"
            alt="Jeunes épargnants africains"
            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-5 flex flex-col justify-end">
            <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest">Avenir & Projets</span>
            <h3 className="text-sm sm:text-base font-serif font-bold text-white leading-snug">
              Une Jeunesse Prospère qui Construit
            </h3>
            <p className="text-[11px] text-white/80 line-clamp-1">
              Épargnez entre amis pour financer vos idées et entreprises.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Active Circles Section */}
      <motion.div variants={itemVariants} className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-serif font-black text-foreground tracking-tight">
              {t('active_circles')}
            </h2>
            <p className="text-xs text-muted-foreground font-medium">Vos groupes de tontine en cours</p>
          </div>
          <CreateGroupDialog />
        </div>

        {groups.length === 0 ? (
          <CreateGroupDialog
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => {
              const progressPct = Math.round((group.currentPayoutIndex / Math.max(group.members.length, 1)) * 100);
              return (
                <motion.div
                  key={group.id}
                  variants={hoverScaleVariants}
                  whileHover="hover"
                  whileTap="tap"
                  className="h-full"
                >
                  <Card
                    className="h-full transition-all cursor-pointer group glass-card rounded-3xl overflow-hidden shadow-soft hover:shadow-elevated hover:border-primary/40 relative flex flex-col justify-between"
                    onClick={() => onSelectGroup(group.id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-center">
                        <Badge className={`font-sans font-bold text-[10px] rounded-full px-2.5 py-0.5 ${
                          group.status === 'active' 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {group.status === 'active' ? t('status_active') : t('status_completed')}
                        </Badge>
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg uppercase tracking-wide">
                          {t(`freq_${group.frequency}`)}
                        </span>
                      </div>
                      <CardTitle className="mt-3 font-serif text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                        {group.name}
                      </CardTitle>
                      <CardDescription className="line-clamp-2 text-xs text-muted-foreground mt-1">
                        {group.description || 'Cercle de tontine collaborative.'}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4 pt-0">
                      <div className="flex justify-between text-xs font-semibold border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">{t('contribution_label')}</span>
                        <span className="text-foreground font-bold">{group.contributionAmount.toLocaleString()} {group.currency}</span>
                      </div>

                      <div className="flex justify-between text-xs font-semibold border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">{t('members')}</span>
                        <span className="text-foreground font-bold">{group.members.length} {t('participants')}</span>
                      </div>

                      <div className="pt-1">
                        <div className="flex justify-between text-[11px] font-bold mb-1.5">
                          <span className="text-muted-foreground">{t('cycle_progress')}</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{progressPct}%</span>
                        </div>
                        <Progress value={progressPct} className="h-2 bg-muted" />
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <Button
                          variant="outline"
                          className="w-full text-xs font-bold rounded-xl h-9 border-border text-foreground hover:bg-muted cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onManageContributions(group.id);
                          }}
                        >
                          {user.uid === group.creatorId || user.role === 'admin' ? t('manage') : t('my_contributions')}
                        </Button>
                        <Button
                          className="w-full justify-between gradient-sunset text-white transition-opacity hover:opacity-90 text-xs font-bold rounded-xl h-9 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectGroup(group.id);
                          }}
                        >
                          <span>{t('details')}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
