import React, { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
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
}

// Framer motion variants for container and items to get high-quality stagger entry
const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
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
  onSelectGroup 
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
        bg: !notif.read ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-500/5 border-amber-500/10',
        iconBg: 'bg-amber-500/15 text-[#E67E22]',
        icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
        badgeText: 'Alerte Retard',
        badgeClass: 'bg-amber-500/10 text-[#E67E22] border border-amber-500/20'
      };
    }
    if (notif.type === 'payout') {
      return {
        bg: !notif.read ? 'bg-[#2BB673]/10 border-[#2BB673]/30' : 'bg-[#2BB673]/5 border-[#2BB673]/10',
        iconBg: 'bg-[#2BB673]/15 text-[#2BB673]',
        icon: <DollarSign className="w-4 h-4 shrink-0" />,
        badgeText: 'Paiement Reçu',
        badgeClass: 'bg-[#2BB673]/10 text-[#2BB673] border border-[#2BB673]/20'
      };
    }
    return {
      bg: !notif.read ? 'bg-slate-100/50 border-slate-200' : 'bg-white border-slate-100',
      iconBg: 'bg-slate-100 text-slate-500',
      icon: <Bell className="w-4 h-4 shrink-0" />,
      badgeText: 'Info',
      badgeClass: 'bg-slate-100 text-slate-600'
    };
  };

  // Tries to extract group id or code from links or message if possible
  const handleActionClick = (notif: any) => {
    // Standard links or fallback to contributions management
    if (notif.link) {
      // E.g., link looks like "group-details:group_123"
      const parts = notif.link.split(':');
      if (parts[0] === 'group-details' && parts[1]) {
        onSelectGroup(parts[1]);
        return;
      }
      if (parts[0] === 'contributions' && parts[1]) {
        onManageContributions(parts[1]);
        return;
      }
    }
    // Fallback: search for words in title or message to redirect
    // By default, open profile or contributions
    onManageContributions('');
  };

  if (loading) {
    return (
      <Card className="bg-white border border-[#D4A574]/20 shadow-sm rounded-3xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-slate-100 rounded w-1/3"></div>
          <div className="h-4 bg-slate-100 rounded w-1/2"></div>
          <div className="space-y-2.5">
            <div className="h-12 bg-slate-50 rounded-2xl"></div>
            <div className="h-12 bg-slate-50 rounded-2xl"></div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-[#D4A574]/20 shadow-sm rounded-3xl overflow-hidden">
      <CardHeader className="pb-4 bg-[#FBF8F3]/40 border-b border-[#D4A574]/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-serif font-bold text-[#4B2E05] flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#E67E22]" />
              Centre d'Alertes & Activités
            </CardTitle>
            {unreadLateAlerts > 0 && (
              <Badge className="bg-red-500 text-white border-none font-bold text-[10px] rounded-full px-2 py-0.5 animate-pulse">
                {unreadLateAlerts} retard{unreadLateAlerts > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs text-slate-500 mt-0.5 font-medium">
            Suivi en temps réel de votre statut de paiement et rappels du cercle de tontine.
          </CardDescription>
        </div>

        {/* Filter Badges with mobile-native tapping style */}
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-2xl self-start sm:self-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilter('all')}
            className={`h-7 px-3 text-[11px] font-bold rounded-xl cursor-pointer transition-all ${
              filter === 'all' 
                ? 'bg-white text-[#4B2E05] shadow-xs' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
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
                ? 'bg-[#E67E22] text-white shadow-xs' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
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
                ? 'bg-[#2BB673] text-white shadow-xs' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
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
              className="py-12 px-6 text-center flex flex-col items-center justify-center gap-3 bg-[#FBF8F3]/10"
            >
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-400">
                <Inbox className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-xs text-slate-700">Aucune alerte trouvée</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
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
              className="divide-y divide-slate-100"
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
                      className={`p-4 sm:p-5 flex gap-4 transition-colors relative border-l-4 ${style.bg} hover:bg-slate-50/50`}
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
                          <span className="text-[10px] font-medium text-slate-400">
                            {notif.createdAt?.seconds 
                              ? formatDistanceToNow(new Date(notif.createdAt.seconds * 1000), { addSuffix: true, locale: fr })
                              : "À l'instant"}
                          </span>
                        </div>

                        <h4 className={`text-xs leading-snug mb-1 ${!notif.read ? 'font-black text-[#4B2E05]' : 'font-bold text-slate-700'}`}>
                          {notif.title}
                        </h4>
                        
                        <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
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
                              className="h-7 px-3 text-[10px] font-black uppercase tracking-wide border-[#E67E22]/30 text-[#E67E22] bg-[#E67E22]/5 hover:bg-[#E67E22] hover:text-white rounded-lg cursor-pointer flex items-center gap-1 active:scale-95 transition-transform"
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
                              className="h-7 px-2 text-[10px] font-bold text-[#2BB673] hover:bg-[#2BB673]/10 rounded-lg cursor-pointer flex items-center gap-1"
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
                              className="h-7 px-2.5 text-[10px] font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer flex items-center gap-1 ml-auto"
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
                            className="h-7 w-7 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer ml-auto sm:ml-0"
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
      className="overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200"
    >
      {children}
    </div>
  );
}
