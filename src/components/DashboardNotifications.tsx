import React, { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence, Variants } from 'motion/react';
import {
  Bell,
  Clock,
  Trash2,
  Check,
  AlertTriangle,
  DollarSign,
  ArrowRight,
  Sparkles,
  Inbox
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DashboardNotificationsProps {
  userId: string;
  onManageContributions: (groupId: string) => void;
  onSelectGroup: (groupId: string) => void;
  onNavigateToProfileTab?: (tab: string) => void;
}

// Framer motion variants for container and items to get high-quality stagger entry
const listVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants: Variants = {
  hidden: { y: 15, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 120,
      damping: 14,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    height: 0,
    paddingTop: 0,
    paddingBottom: 0,
    marginTop: 0,
    marginBottom: 0,
    transition: {
      duration: 0.25,
      ease: 'easeInOut',
    },
  },
};

export function DashboardNotifications({
  userId,
  onManageContributions,
  onSelectGroup,
  onNavigateToProfileTab
}: DashboardNotificationsProps) {
  const { notifications, loading, markAsRead, deleteNotification } = useNotifications(userId);
  const [filter, setFilter] = useState<'all' | 'late' | 'payout'>('all');

  // Helper to determine if a notification is a late payment or reminder alert
  const isLateAlert = (notif: any) => {
    const titleLower = (notif.title || '').toLowerCase();
    const msgLower = (notif.message || '').toLowerCase();
    return (
      notif.type === 'reminder' ||
      titleLower.includes('retard') ||
      titleLower.includes('late') ||
      titleLower.includes('pénalité') ||
      titleLower.includes('échéance') ||
      msgLower.includes('retard') ||
      msgLower.includes('en retard') ||
      msgLower.includes('rappel de paiement')
    );
  };

  // Filtered notifications
  const filteredNotifs = notifications.filter(notif => {
    if (filter === 'all') return true;
    if (filter === 'late') return isLateAlert(notif);
    if (filter === 'payout') return notif.type === 'payout';
    return true;
  });

  // Calculate unread alerts specifically
  const unreadLateAlerts = notifications.filter(n => !n.read && isLateAlert(n)).length;

  const getNotificationStyles = (notif: any) => {
    if (isLateAlert(notif)) {
      return {
        bg: !notif.read ? 'bg-danger/10 border-danger/30' : 'bg-danger/5 border-danger/10',
        iconBg: 'bg-danger/15 text-danger',
        icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
        badgeText: 'Alerte Retard',
        badgeClass: 'bg-danger/10 text-danger border border-danger/20'
      };
    }
    if (notif.type === 'payout') {
      return {
        bg: !notif.read ? 'bg-secondary/10 border-secondary/30' : 'bg-secondary/5 border-secondary/10',
        iconBg: 'bg-secondary/15 text-secondary',
        icon: <DollarSign className="w-4 h-4 shrink-0" />,
        badgeText: 'Paiement Reçu',
        badgeClass: 'bg-secondary/10 text-secondary border border-secondary/20'
      };
    }
    return {
      bg: !notif.read ? 'bg-muted border-border' : 'bg-card border-border',
      iconBg: 'bg-muted text-muted-foreground',
      icon: <Bell className="w-4 h-4 shrink-0" />,
      badgeText: 'Info',
      badgeClass: 'bg-muted text-muted-foreground'
    };
  };

  // Notification producers (useReminders, useWalletDebitor, groups.ts, MemberManagement)
  // all set link as "/group/{id}" or "/profile" — route on that real format.
  const handleActionClick = (notif: any) => {
    const link: string = notif.link || '';
    const groupMatch = link.match(/^\/group\/(.+)$/);
    if (groupMatch) {
      const groupId = groupMatch[1];
      if (isLateAlert(notif)) {
        onManageContributions(groupId);
      } else {
        onSelectGroup(groupId);
      }
      return;
    }
    if (link === '/profile' && onNavigateToProfileTab) {
      onNavigateToProfileTab('wallet');
      return;
    }
    onManageContributions('');
  };

  if (loading) {
    return (
      <Card className="bg-card border border-border shadow-sm rounded-3xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
          <div className="space-y-2.5">
            <div className="h-12 bg-muted rounded-2xl"></div>
            <div className="h-12 bg-muted rounded-2xl"></div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-card border border-border shadow-sm rounded-3xl overflow-hidden">
      <CardHeader className="pb-4 bg-muted/40 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-serif font-bold text-foreground flex items-center gap-2">
              <Bell className="w-5 h-5 text-brand" />
              Centre d'Alertes & Activités
            </CardTitle>
            {unreadLateAlerts > 0 && (
              <Badge className="bg-danger text-white border-none font-bold text-[10px] rounded-full px-2 py-0.5 animate-pulse">
                {unreadLateAlerts} retard{unreadLateAlerts > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-0.5 font-medium">
            Suivi en temps réel de votre statut de paiement et rappels du cercle de tontine.
          </CardDescription>
        </div>

        {/* Filter Badges with mobile-native tapping style */}
        <div className="flex gap-1.5 bg-muted p-1 rounded-2xl self-start sm:self-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilter('all')}
            className={`h-7 px-3 text-[11px] font-bold rounded-xl cursor-pointer transition-all ${
              filter === 'all'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            }`}
          >
            Tous
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilter('late')}
            className={`h-7 px-3 text-[11px] font-bold rounded-xl cursor-pointer transition-all flex items-center gap-1 ${
              filter === 'late'
                ? 'bg-danger text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            }`}
          >
            <AlertTriangle className="w-3 h-3 shrink-0" />
            Alertes Retard
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilter('payout')}
            className={`h-7 px-3 text-[11px] font-bold rounded-xl cursor-pointer transition-all flex items-center gap-1 ${
              filter === 'payout'
                ? 'bg-secondary text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            }`}
          >
            <DollarSign className="w-3 h-3 shrink-0" />
            Versements
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollAreaMaxHeight maxH={340}>
          {filteredNotifs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 px-6 text-center flex flex-col items-center justify-center gap-3 bg-muted/30"
            >
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border border-border text-muted-foreground">
                <Inbox className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-xs text-foreground">Aucune alerte trouvée</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {filter === 'late'
                    ? "Aucun retard de paiement n'est signalé sur vos cercles d'épargne actifs."
                    : filter === 'payout'
                    ? "Aucun encaissement ou payout n'a encore été enregistré."
                    : "Votre historique d'alertes est vierge pour le moment."}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              variants={listVariants}
              initial="hidden"
              animate="visible"
              className="divide-y divide-border"
            >
              <AnimatePresence initial={false}>
                {filteredNotifs.map((notif) => {
                  const style = getNotificationStyles(notif);
                  return (
                    <motion.div
                      key={notif.id}
                      variants={itemVariants}
                      exit="exit"
                      layout
                      className={`p-4 sm:p-5 flex gap-4 transition-colors relative border-l-4 ${style.bg} hover:bg-muted/50`}
                    >
                      {/* Notification category indicator */}
                      <div className="shrink-0 mt-0.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-xs ${style.iconBg}`}>
                          {style.icon}
                        </div>
                      </div>

                      {/* Content details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                          <span className={`text-[11px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${style.badgeClass}`}>
                            {style.badgeText}
                          </span>
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {notif.createdAt
                              ? formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: fr })
                              : "À l'instant"}
                          </span>
                        </div>

                        <h4 className={`text-xs leading-snug mb-1 text-foreground ${!notif.read ? 'font-black' : 'font-bold'}`}>
                          {notif.title}
                        </h4>

                        <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
                          {notif.message}
                        </p>

                        {/* Interactive dynamic actions */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Payer/Régler action button */}
                          {isLateAlert(notif) && !notif.read && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleActionClick(notif)}
                              className="h-7 px-3 text-[10px] font-black uppercase tracking-wide border-danger/30 text-danger bg-danger/5 hover:bg-danger hover:text-white rounded-lg cursor-pointer flex items-center gap-1 active:scale-95 transition-transform"
                            >
                              <span>Régler ma cotisation</span>
                              <ArrowRight className="w-3 h-3" />
                            </Button>
                          )}

                          {/* System / normal click actions */}
                          {notif.type === 'payout' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleActionClick(notif)}
                              className="h-7 px-2 text-[10px] font-bold text-secondary hover:bg-secondary/10 rounded-lg cursor-pointer flex items-center gap-1"
                            >
                              <span>Voir le détail</span>
                            </Button>
                          )}

                          {/* Close/Archive */}
                          {!notif.read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markAsRead(notif.id)}
                              className="h-7 px-2.5 text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg cursor-pointer flex items-center gap-1 ml-auto"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Lu</span>
                            </Button>
                          )}

                          {/* Delete/Dismiss permanently */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteNotification(notif.id)}
                            className="h-7 w-7 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger cursor-pointer ml-auto sm:ml-0"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </ScrollAreaMaxHeight>
      </CardContent>
    </Card>
  );
}

// Simple custom inline scroll container wrapper to bypass external components restrictions
function ScrollAreaMaxHeight({ maxH, children }: { maxH: number; children: React.ReactNode }) {
  return (
    <div
      style={{ maxHeight: `${maxH}px` }}
      className="overflow-y-auto scrollbar-thin scrollbar-thumb-border"
    >
      {children}
    </div>
  );
}
