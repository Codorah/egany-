import React from 'react';
import { DashboardNotifications } from './DashboardNotifications';
import { useLanguage } from '@/contexts/LanguageContext';

interface ActivityScreenProps {
  userId: string;
  onManageContributions: (id: string) => void;
  onSelectGroup: (id: string) => void;
  onNavigateToProfileTab?: (tab: string) => void;
}

/**
 * Onglet « Activité » de la navigation principale : paiements, échéances et
 * nouvelles des cercles, réunis sur un écran à part au lieu d'être noyés en
 * bas du tableau de bord.
 */
export function ActivityScreen({
  userId,
  onManageContributions,
  onSelectGroup,
  onNavigateToProfileTab,
}: ActivityScreenProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-5 pb-4">
      <div className="space-y-1.5 pt-1">
        <h1 className="text-[28px] leading-tight font-serif font-bold text-foreground tracking-tight">
          {t('activity_title')}
        </h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground font-medium">
          {t('activity_subtitle')}
        </p>
      </div>

      <DashboardNotifications
        userId={userId}
        onManageContributions={onManageContributions}
        onSelectGroup={onSelectGroup}
        onNavigateToProfileTab={onNavigateToProfileTab}
      />
    </div>
  );
}
