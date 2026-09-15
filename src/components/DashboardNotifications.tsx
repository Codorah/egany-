import React, { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import { EganyeIcon, type EganyeIconName } from '@/components/ui/EganyeIcon';
import { EganyeIllustration } from '@/components/ui/EganyeIllustration';
import { EganyeTimeline } from '@/components/ui/EganyeTimeline';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';

interface DashboardNotificationsProps {
  userId: string;
  onManageContributions: (groupId: string) => void;
  onSelectGroup: (groupId: string) => void;
  onNavigateToProfileTab?: (tab: string) => void;
}

export function DashboardNotifications({
  userId,
  onManageContributions,
  onSelectGroup,
  onNavigateToProfileTab
}: DashboardNotificationsProps) {
  const { t } = useLanguage();
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

  const getNotificationConfig = (notif: any): { tone: 'danger' | 'success' | 'warning' | 'info' | 'neutral', icon: EganyeIconName } => {
    if (isLateAlert(notif)) return { tone: 'danger', icon: 'late' };
    if (notif.type === 'payout') return { tone: 'success', icon: 'distribution' };
    return { tone: 'neutral', icon: 'notification' };
  };

  const handleActionClick = (notif: any) => {
    if (!notif.read) markAsRead(notif.id);
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
  };

  if (loading) {
    return (
      <Card className="bg-card border border-border shadow-soft rounded-3xl p-6">
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

  // Convert notifications to EganyeTimeline items format
  const timelineItems = filteredNotifs.map(notif => {
    const config = getNotificationConfig(notif);
    return {
      id: notif.id,
      icon: config.icon,
      tone: config.tone,
      title: notif.title,
      description: notif.message,
      time: notif.createdAt
        ? formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: fr })
        : "À l'instant",
      onClick: () => handleActionClick(notif)
    };
  });

  return (
    <Card className="bg-card border border-border shadow-soft rounded-3xl overflow-hidden">
      <CardHeader className="pb-4 bg-muted/40 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-serif font-black text-foreground flex items-center gap-2">
              <EganyeIcon name="bell" size={20} className="text-primary" />
              {t('alerts_activities')}
            </CardTitle>
            {unreadLateAlerts > 0 && (
              <Badge className="bg-danger text-white border-none font-bold text-[13px] rounded-full px-2 py-0.5 animate-pulse">
                {unreadLateAlerts} {t('unread_alerts_suffix')}
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-0.5 font-medium">
            {t('alerts_activities_subtitle')}
          </CardDescription>
        </div>

        {/* Filter Badges */}
        <div className="flex gap-1.5 bg-muted p-1 rounded-2xl self-start sm:self-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilter('all')}
            className={`h-8 px-3 text-[13px] font-bold rounded-xl cursor-pointer transition-all ${
              filter === 'all'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            }`}
          >
            {t('all')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilter('late')}
            className={`h-8 px-3 text-[13px] font-bold rounded-xl cursor-pointer transition-all flex items-center gap-1.5 ${
              filter === 'late'
                ? 'bg-danger text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            }`}
          >
            <EganyeIcon name="late" size={14} />
            {t('late_alerts')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilter('payout')}
            className={`h-8 px-3 text-[13px] font-bold rounded-xl cursor-pointer transition-all flex items-center gap-1.5 ${
              filter === 'payout'
                ? 'bg-secondary text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            }`}
          >
            <EganyeIcon name="distribution" size={14} />
            {t('contributions')}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollAreaMaxHeight maxH={500}>
          {filteredNotifs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 px-6 text-center flex flex-col items-center justify-center gap-4 bg-muted/30"
            >
              <EganyeIllustration name={filter === 'late' ? 'no-notifications' : filter === 'payout' ? 'no-savings' : 'no-activity'} width={120} />
              <div>
                <p className="font-bold text-sm text-foreground">{t('no_alert_found')}</p>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  {filter === 'late'
                    ? t('no_alert_desc_late')
                    : filter === 'payout'
                    ? t('no_alert_desc_payout')
                    : t('no_alert_desc_all')}
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="p-5">
              <EganyeTimeline items={timelineItems} />
            </div>
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
