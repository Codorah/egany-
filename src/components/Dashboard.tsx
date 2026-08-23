import React, { useState } from 'react';
import { motion } from 'motion/react';
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
  Bot
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

export function Dashboard({ user, groups, onSelectGroup, onManageContributions, onNavigateToProfileTab, onNavigate }: DashboardProps) {
  const { t } = useLanguage();
  const [showReliabilityInfo, setShowReliabilityInfo] = useState(false);

  // Financial calculations for "Mon Argent"
  const availableBalance = user.walletBalance || 0;
  const totalSaved = user.totalSaved || 0;
  
  // Calculate total committed money in active circles
  const committedInTontines = groups.reduce((acc, g) => acc + (g.contributionAmount * Math.max(g.currentPayoutIndex, 1)), 0);

  // Find next upcoming contribution & next expected payout
  const activeGroups = groups.filter(g => g.status === 'active');
  const nextGroupToPay = activeGroups[0] || null;
  
  // Next payout circle
  const nextPayoutGroup = activeGroups.find(g => {
    const userIndexInOrder = g.payoutOrder.indexOf(user.uid);
    return userIndexInOrder >= g.currentPayoutIndex;
  }) || activeGroups[0] || null;

  const nextPayoutAmount = nextPayoutGroup ? (nextPayoutGroup.contributionAmount * nextPayoutGroup.members.length) : 0;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 pb-16"
    >
      {/* Header — Clean, no background box */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
      >
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-foreground tracking-tight">
              Bonjour {user.displayName} 👋
            </h1>
            {user.role === 'admin' && (
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                Admin
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            Voici ce qui se passe dans vos cercles aujourd'hui.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2 w-full sm:w-auto">
          <CreateGroupDialog />
        </div>
      </motion.div>

      {/* Mon Portefeuille — one hero figure instead of 4 equal stat boxes,
          so the eye lands on what actually matters (available balance) first */}
      <motion.div variants={itemVariants}>
        <Card className="gradient-sunset rounded-3xl overflow-hidden shadow-elevated relative">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <CardContent className="p-5 space-y-5 relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white/80">Mon portefeuille</span>
              <button
                onClick={() => onNavigate?.('wallet-savings')}
                className="text-[11px] font-bold text-white/90 hover:text-white underline underline-offset-2 cursor-pointer"
              >
                Voir tout
              </button>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-white/70 uppercase tracking-wide">Solde disponible</span>
              <p className="text-4xl font-serif font-black text-white mt-0.5">
                {availableBalance.toLocaleString()} <span className="text-sm font-sans text-white/70">FCFA</span>
              </p>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="shrink-0 bg-white/15 backdrop-blur-xs rounded-2xl px-3 py-2 space-y-0.5 min-w-[110px]">
                <span className="text-[9px] font-semibold text-white/70 uppercase tracking-wide">Épargne totale</span>
                <p className="text-sm font-black text-white">{totalSaved.toLocaleString()} <span className="text-[9px] font-sans text-white/60">FCFA</span></p>
              </div>
              <div className="shrink-0 bg-white/15 backdrop-blur-xs rounded-2xl px-3 py-2 space-y-0.5 min-w-[110px]">
                <span className="text-[9px] font-semibold text-white/70 uppercase tracking-wide">À recevoir</span>
                <p className="text-sm font-black text-white">{nextPayoutAmount.toLocaleString()} <span className="text-[9px] font-sans text-white/60">FCFA</span></p>
              </div>
              <div className="shrink-0 bg-white/15 backdrop-blur-xs rounded-2xl px-3 py-2 space-y-0.5 min-w-[90px]">
                <span className="text-[9px] font-semibold text-white/70 uppercase tracking-wide">Cercles actifs</span>
                <p className="text-sm font-black text-white">{groups.length}</p>
              </div>
            </div>

            <Button
              onClick={() => onNavigate?.('wallet-savings')}
              size="sm"
              className="bg-white text-primary hover:bg-white/90 font-bold rounded-xl h-9 text-xs cursor-pointer w-full"
            >
              <Wallet className="w-3.5 h-3.5 mr-1.5" /> Recharger
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Marketplace & Assistant IA — seul point d'entrée mobile vers ces deux
          écrans (le menu desktop n'est pas visible sur mobile) */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onNavigate?.('marketplace')}
          className="glass-card rounded-2xl p-4 shadow-soft flex items-center gap-3 text-left cursor-pointer hover:bg-muted/40 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground">Marketplace</p>
            <p className="text-[10px] text-muted-foreground truncate">Services entre membres</p>
          </div>
        </button>
        <button
          onClick={() => onNavigate?.('ai-assistant')}
          className="glass-card rounded-2xl p-4 shadow-soft flex items-center gap-3 text-left cursor-pointer hover:bg-muted/40 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground">Assistant IA</p>
            <p className="text-[10px] text-muted-foreground truncate">Bilan de caisse, rappels</p>
          </div>
        </button>
      </motion.div>

      {/* 4 ACTIONABLE CARDS */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Prochaines actions
        </h2>

        {/* Horizontal swipe on mobile (native app feel) instead of a plain
            vertical stack; becomes a static 3-col grid from md: up. */}
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 -mx-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:overflow-visible md:mx-0 md:px-0 md:pb-0">
          {/* Card 1: Prochaine Cotisation */}
          <Card className="glass-card rounded-2xl p-5 shadow-soft space-y-3 relative overflow-hidden shrink-0 snap-start w-[82vw] sm:w-[320px] md:w-auto md:shrink">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Prochaine Cotisation
              </span>
              {nextGroupToPay && (
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                  {nextGroupToPay.frequency}
                </Badge>
              )}
            </div>

            {nextGroupToPay ? (
              <>
                <div>
                  <h3 className="font-serif font-bold text-base text-foreground">{nextGroupToPay.name}</h3>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-foreground">
                      {nextGroupToPay.contributionAmount.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground font-bold">{nextGroupToPay.currency}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Échéance : {format(new Date(nextGroupToPay.nextPayoutDate), 'dd MMMM yyyy', { locale: fr })}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    onClick={() => onManageContributions(nextGroupToPay.id)}
                    className="gradient-sunset text-white font-bold rounded-xl h-9 text-xs cursor-pointer shadow-xs"
                  >
                    Cotiser
                  </Button>
                  <Button
                    onClick={() => onManageContributions(nextGroupToPay.id)}
                    variant="outline"
                    className="border-border text-foreground hover:bg-muted font-bold rounded-xl h-9 text-xs cursor-pointer"
                  >
                    Espèces
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">Aucune cotisation en attente.</p>
            )}
          </Card>

          {/* Card 2: Mon Prochain Tour */}
          <Card className="glass-card rounded-2xl p-5 shadow-soft space-y-3 relative overflow-hidden shrink-0 snap-start w-[82vw] sm:w-[320px] md:w-auto md:shrink">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Gift className="w-4 h-4" /> Mon Prochain Tour (Gain)
              </span>
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                Distribution
              </Badge>
            </div>

            {nextPayoutGroup ? (
              <div>
                <h3 className="font-serif font-bold text-base text-foreground">{nextPayoutGroup.name}</h3>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {(nextPayoutGroup.contributionAmount * nextPayoutGroup.members.length).toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground font-bold">{nextPayoutGroup.currency}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Date estimée : {format(new Date(nextPayoutGroup.nextPayoutDate), 'dd MMMM yyyy', { locale: fr })}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">Rejoignez un cercle pour planifier votre tour.</p>
            )}
          </Card>

          {/* Card 3: Score de Fiabilité (Explicable) */}
          <Card className="glass-card rounded-2xl p-5 shadow-soft space-y-3 relative overflow-hidden shrink-0 snap-start w-[82vw] sm:w-[320px] md:w-auto md:shrink">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Score de Fiabilité
              </span>
              <button
                onClick={() => setShowReliabilityInfo(true)}
                className="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5"
              >
                <Info className="w-3.5 h-3.5" /> Détails
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-serif font-black text-foreground">{user.reputationScore}</span>
                <span className="text-xs text-muted-foreground font-bold">/ 100</span>
              </div>
              <Progress value={user.reputationScore} className="h-2 bg-emerald-500/15" />
              <div className="space-y-1 pt-1 text-[11px] text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Paiements à l'heure</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">100%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Cercles complétés</span>
                  <span className="font-bold text-foreground">{user.groupsJoined || groups.length}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </motion.div>

      {/* Notifications & Alerts Section */}
      <motion.div variants={itemVariants}>
        <DashboardNotifications
          userId={user.uid}
          onManageContributions={onManageContributions}
          onSelectGroup={onSelectGroup}
          onNavigateToProfileTab={onNavigateToProfileTab}
        />
      </motion.div>

      {/* Cultural Community Banner — an asymmetric hero + companion split
          instead of two identical boxes stacked (was: same height, same
          width, same treatment — the most generic possible pairing) */}
      <motion.div variants={itemVariants} className="grid grid-cols-5 gap-3">
        <div className="relative h-48 md:h-56 rounded-3xl overflow-hidden shadow-soft group col-span-5 md:col-span-3">
          <img
            src="/onboarding-mamas.png"
            alt="Mamans commerçantes et tontine"
            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-5 flex flex-col justify-end">
            <span className="text-[9px] font-bold text-amber-300 uppercase tracking-widest">Épargne Solidaire</span>
            <h3 className="text-base font-serif font-bold text-white leading-snug max-w-[80%]">
              La Tontine des Mamans & Commerçantes
            </h3>
          </div>
        </div>

        <div className="relative h-28 md:h-56 rounded-3xl overflow-hidden shadow-soft group col-span-5 md:col-span-2">
          <img
            src="/young-savers.png"
            alt="Jeunes épargnants africains"
            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-4 flex flex-col justify-end">
            <span className="text-[9px] font-bold text-emerald-300 uppercase tracking-widest">Avenir & Projets</span>
            <h3 className="text-sm font-serif font-bold text-white leading-snug">
              Une Jeunesse Prospère qui Construit
            </h3>
          </div>
        </div>
      </motion.div>

      {/* Chart Section */}
      <motion.div variants={itemVariants}>
        <DashboardCharts user={user} groups={groups} />
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group) => {
              const progressPct = Math.round((group.currentPayoutIndex / Math.max(group.members.length, 1)) * 100);
              return (
                <motion.div
                  key={group.id}
                  whileHover={{ y: -4 }}
                  className="h-full"
                >
                  <Card
                    className="h-full transition-all cursor-pointer group glass-card rounded-2xl overflow-hidden shadow-soft hover:shadow-elevated hover:border-primary/30 relative flex flex-col justify-between"
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

      {/* Reliability Score Info Modal */}
      <Dialog open={showReliabilityInfo} onOpenChange={setShowReliabilityInfo}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-serif font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              Comment est calculé votre Score de Fiabilité ?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Votre score mesure votre régularité et renforce la confiance des cercles.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-1">
              <div className="flex items-center justify-between font-bold text-emerald-700 dark:text-emerald-300">
                <span>Paiements à l'heure</span>
                <span>+50 Pts</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Chaque versement effectué avant l'échéance augmente directement votre score.</p>
            </div>

            <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl space-y-1">
              <div className="flex items-center justify-between font-bold text-primary">
                <span>Ancienneté & Cercles Complétés</span>
                <span>+30 Pts</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Terminer un cycle complet de tontine sans aucun incident valorise votre profil.</p>
            </div>

            <div className="p-3 bg-muted/40 rounded-2xl space-y-1">
              <div className="flex items-center justify-between font-bold text-foreground">
                <span>Pénalité de Retard</span>
                <span className="text-rose-500">-15 Pts / retard</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Les retards répétés diminuent temporairement votre niveau de fiabilité.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
