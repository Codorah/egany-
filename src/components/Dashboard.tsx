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
  Banknote
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
      className="space-y-8 pb-16"
    >
      {/* Header and Welcome */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/30 p-6 rounded-3xl border border-border/60"
      >
        <div className="space-y-1">
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
            Votre espace d'épargne communautaire Eganyé
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2 w-full sm:w-auto">
          <CreateGroupDialog />
        </div>
      </motion.div>

      {/* "MON ARGENT" Financial Overview Banner */}
      <motion.div variants={itemVariants} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            💰 Mon Argent
          </h2>
          <span className="text-[11px] font-semibold text-primary">Vue consolidée</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Solde disponible */}
          <Card className="glass-card rounded-3xl p-5 border border-border/80 shadow-soft flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Solde Disponible</span>
              <p className="text-2xl sm:text-3xl font-serif font-black text-primary">
                {availableBalance.toLocaleString()} <span className="text-xs text-muted-foreground">FCFA</span>
              </p>
            </div>
            <div className="pt-3">
              <Button
                onClick={() => onNavigate?.('wallet-savings')}
                size="sm"
                className="w-full gradient-sunset text-white font-bold rounded-xl h-8 text-[11px] cursor-pointer shadow-xs"
              >
                <Wallet className="w-3.5 h-3.5 mr-1" /> Recharger
              </Button>
            </div>
          </Card>

          {/* 2. Argent engagé en tontines */}
          <Card className="glass-card rounded-3xl p-5 border border-border/80 shadow-soft flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">En Tontines</span>
              <p className="text-2xl sm:text-3xl font-serif font-black text-amber-600 dark:text-amber-400">
                {committedInTontines.toLocaleString()} <span className="text-xs text-muted-foreground">FCFA</span>
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium pt-3 flex items-center gap-1">
              <Users className="w-3 h-3 text-amber-500" /> {groups.length} cercle(s) actif(s)
            </p>
          </Card>

          {/* 3. Total Épargné */}
          <Card className="glass-card rounded-3xl p-5 border border-border/80 shadow-soft flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Total Épargné</span>
              <p className="text-2xl sm:text-3xl font-serif font-black text-emerald-600 dark:text-emerald-400">
                {totalSaved.toLocaleString()} <span className="text-xs text-muted-foreground">FCFA</span>
              </p>
            </div>
            <p className="text-[10px] text-emerald-600 font-bold pt-3 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Épargne accumulée
            </p>
          </Card>

          {/* 4. Prochain pot à recevoir */}
          <Card className="glass-card rounded-3xl p-5 border border-border/80 shadow-soft flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Prochain Pot</span>
              <p className="text-2xl sm:text-3xl font-serif font-black text-blue-600 dark:text-blue-400">
                {nextPayoutAmount.toLocaleString()} <span className="text-xs text-muted-foreground">FCFA</span>
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium pt-3 flex items-center gap-1">
              <Gift className="w-3 h-3 text-blue-500" /> Tour prévu ce mois
            </p>
          </Card>
        </div>
      </motion.div>

      {/* 4 ACTIONABLE CARDS */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          ⚡ Prochaines Actions & Fiabilité
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Prochaine Cotisation */}
          <Card className="glass-card rounded-3xl p-5 border border-primary/30 shadow-soft space-y-3 relative overflow-hidden">
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
          <Card className="glass-card rounded-3xl p-5 border border-emerald-500/30 shadow-soft space-y-3 relative overflow-hidden">
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
          <Card className="glass-card rounded-3xl p-5 border border-border/80 shadow-soft space-y-3 relative overflow-hidden">
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
        />
      </motion.div>

      {/* Cultural Community Banner */}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => {
              const progressPct = Math.round((group.currentPayoutIndex / Math.max(group.members.length, 1)) * 100);
              return (
                <motion.div
                  key={group.id}
                  whileHover={{ y: -4 }}
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

      {/* Reliability Score Info Modal */}
      <Dialog open={showReliabilityInfo} onOpenChange={setShowReliabilityInfo}>
        <DialogContent className="max-w-md rounded-3xl p-6">
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
