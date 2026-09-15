import React from 'react';
import { EganyeIcon } from './EganyeIcon';
import { Group } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { AmountDisplay } from './AmountDisplay';
import { StatusBadge } from './StatusBadge';
import { CustomAvatar } from '../CustomAvatar';

interface TontineCardProps {
  group: Group;
  onClick: () => void;
}

/**
 * Ligne « cercle » compacte — nom + une ligne de contexte + montant + statut.
 * Utilise les icônes Eganyé et un badge de statut accessible.
 */
export function TontineCard({ group, onClick }: TontineCardProps) {
  const { t } = useLanguage();

  const statusTone = group.status === 'active' ? 'success' : group.status === 'pending' ? 'warning' : 'neutral';
  const statusLabel = t(`status_${group.status}`) || group.status;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="press-row glass-card rounded-2xl p-3.5 shadow-soft border border-border/70 hover:border-brand/40 transition-all cursor-pointer flex items-center gap-3"
    >
      {/* Circle avatar */}
      <CustomAvatar name={group.name} size={44} className="border-2 border-primary/25 shadow-xs shrink-0" />

      <div className="flex-1 min-w-0">
        <h3 className="font-serif font-bold text-sm text-foreground truncate">{group.name}</h3>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          {group.members.length} {t('member')}s · {t(`freq_${group.frequency}`)}
        </p>
        <AmountDisplay
          amount={group.contributionAmount}
          currency={group.currency}
          size="sm"
          className="text-primary mt-0.5"
          currencyClassName="text-primary/70"
        />
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <StatusBadge label={statusTone === 'success' ? 'À jour' : statusLabel} tone={statusTone} />
        <EganyeIcon name="chevron-right" size={16} className="text-muted-foreground" />
      </div>
    </div>
  );
}
