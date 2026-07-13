import React from 'react';
import { motion } from 'motion/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Users, TrendingUp, ShieldCheck, ArrowRight, Wallet, PlusCircle, Search } from 'lucide-react';
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

// Framer Motion Animation Configurations for Mobile-Native Feel
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 110,
      damping: 15,
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
      className="space-y-8"
    >
      {/* Header and Welcome */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">{t('dashboard_greeting')}, {user.displayName} 👋</h1>
          <p className="text-xs text-muted-foreground font-medium">{t('dashboard_subtitle')}</p>
        </div>
        <div className="shrink-0 sm:block hidden">
          <CreateGroupDialog />
        </div>
      </motion.div>

      {/* Quick Actions (Actions rapides) */}
      <motion.div
        variants={itemVariants}
        className="space-y-3"
      >
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('quick_actions')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Action 1: Recharge Wallet */}
          <motion.div
            variants={hoverScaleVariants}
            whileHover="hover"
            whileTap="tap"
            onClick={() => onNavigateToProfileTab?.('wallet')}
            className="cursor-pointer bg-card p-4 rounded-3xl border border-border shadow-sm flex items-center justify-between group hover:border-secondary/30 transition-all"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-secondary/10 text-secondary group-hover:bg-secondary group-hover:text-white transition-all duration-300">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-foreground">{t('recharge_wallet_title')}</h3>
                <p className="text-[11px] text-muted-foreground font-medium">{t('recharge_wallet_desc')}</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-secondary group-hover:translate-x-1 transition-all" />
          </motion.div>

          {/* Action 2: Create Group */}
          <CreateGroupDialog
            trigger={
              <motion.div
                variants={hoverScaleVariants}
                whileHover="hover"
                whileTap="tap"
                className="cursor-pointer bg-card p-4 rounded-3xl border border-border shadow-sm flex items-center justify-between group hover:border-brand/30 transition-all"
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-3 rounded-2xl bg-brand/10 text-brand group-hover:bg-brand group-hover:text-white transition-all duration-300">
                    <PlusCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base text-foreground">{t('create_new_circle')}</h3>
                    <p className="text-[11px] text-muted-foreground font-medium">{t('create_circle_desc')}</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-brand group-hover:translate-x-1 transition-all" />
              </motion.div>
            }
          />

          {/* Action 3: Search Public Groups */}
          <motion.div
            variants={hoverScaleVariants}
            whileHover="hover"
            whileTap="tap"
            onClick={() => onNavigate?.('search-groups')}
            className="cursor-pointer bg-card p-4 rounded-3xl border border-border shadow-sm flex items-center justify-between group hover:border-eganye-gold/40 transition-all"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-eganye-gold/10 text-eganye-gold group-hover:bg-eganye-gold group-hover:text-white transition-all duration-300">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-foreground">{t('search_circles')}</h3>
                <p className="text-[11px] text-muted-foreground font-medium">{t('search_circle_desc')}</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-eganye-gold group-hover:translate-x-1 transition-all" />
          </motion.div>

        </div>
      </motion.div>

      {/* Overview Stat Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 sm:grid-cols-3 gap-5"
      >
        {/* Score Card */}
        <motion.div
          whileHover={{ y: -2, transition: { duration: 0.2 } }}
          className="h-full"
        >
          <Card className="bg-secondary text-white border-none overflow-hidden relative shadow-md rounded-3xl h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-white/80">{t('reputation_score')}</CardTitle>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-4xl font-serif font-extrabold">{user.reputationScore}</span>
                <span className="text-xs font-bold text-white/80">/ 100</span>
              </div>
            </CardHeader>
            <CardContent>
              <Progress value={user.reputationScore} className="h-1.5 bg-white/25" />
              <p className="mt-4 text-[11px] font-medium text-white/95 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 shrink-0 text-eganye-gold" />
                {t('excellent_reliability')}
              </p>
            </CardContent>
            <div className="absolute -right-4 -bottom-4 text-white/10">
              <ShieldCheck className="w-28 h-28" />
            </div>
          </Card>
        </motion.div>

        {/* Total Saved Card */}
        <motion.div
          whileHover={{ y: -2, transition: { duration: 0.2 } }}
          className="h-full"
        >
          <Card className="bg-card border border-border shadow-sm rounded-3xl h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('total_saved')}</CardTitle>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-4xl font-serif font-extrabold text-foreground">{user.totalSaved.toLocaleString()}</span>
                <span className="text-xs font-bold text-muted-foreground">FCFA</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1.5 text-xs text-secondary font-bold">
                <TrendingUp className="w-4 h-4" />
                +12% {t('savings_accumulated')}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Active Groups Card */}
        <motion.div
          whileHover={{ y: -2, transition: { duration: 0.2 } }}
          className="h-full"
        >
          <Card className="bg-card border border-border shadow-sm rounded-3xl h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('active_groups')}</CardTitle>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-4xl font-serif font-extrabold text-foreground">{groups.length}</span>
                <span className="text-xs font-bold text-muted-foreground">{t('circles_unit')}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-bold">
                <Users className="w-4 h-4 text-brand" />
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

      {/* Active Circles Section */}
      <motion.div variants={itemVariants} className="space-y-4">
        <h2 className="text-xl font-serif font-bold text-foreground">{t('active_circles')}</h2>
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
            {groups.map((group) => (
              <motion.div
                key={group.id}
                variants={hoverScaleVariants}
                whileHover="hover"
                whileTap="tap"
                className="h-full"
              >
                <Card
                  className="h-full transition-all cursor-pointer group bg-card border border-border rounded-3xl overflow-hidden shadow-sm hover:shadow-md"
                  onClick={() => onSelectGroup(group.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <Badge className={`font-sans font-bold text-[10px] rounded-full px-2.5 py-0.5 ${group.status === 'active' ? 'bg-secondary/10 text-secondary border border-secondary/20' : 'bg-muted text-muted-foreground'}`}>
                        {group.status === 'active' ? t('status_active') : t('status_completed')}
                      </Badge>
                      <span className="text-[10px] font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-md uppercase font-sans tracking-wide">{t(`freq_${group.frequency}`)}</span>
                    </div>
                    <CardTitle className="mt-3 font-serif text-lg font-bold text-foreground group-hover:text-brand transition-colors">{group.name}</CardTitle>
                    <CardDescription className="line-clamp-2 text-xs text-muted-foreground mt-1">{group.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="flex justify-between text-xs font-semibold border-b border-border pb-2">
                      <span className="text-muted-foreground">{t('contribution_label')}</span>
                      <span className="text-foreground">{group.contributionAmount.toLocaleString()} {group.currency}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold border-b border-border pb-2">
                      <span className="text-muted-foreground">{t('members')}</span>
                      <span className="text-foreground">{group.members.length} {t('participants')}</span>
                    </div>
                    <div className="pt-1">
                      <div className="flex justify-between text-[11px] font-bold mb-1">
                        <span className="text-muted-foreground">{t('cycle_progress')}</span>
                        <span className="text-secondary">{Math.round((group.currentPayoutIndex / group.members.length) * 100)}%</span>
                      </div>
                      <Progress value={(group.currentPayoutIndex / group.members.length) * 100} className="h-1.5" />
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
                        variant="ghost"
                        className="w-full justify-between hover:bg-brand hover:text-white transition-colors text-xs font-bold rounded-xl h-9 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectGroup(group.id);
                        }}
                      >
                        {t('details')}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
