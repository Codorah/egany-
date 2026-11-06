import React from 'react';
import { ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Group } from '@/types';
import { EmptyState } from './ui/EmptyState';
import { ScreenBar } from './ui/ScreenBar';
import { useLanguage } from '@/contexts/LanguageContext';

interface ChooseCircleToPayProps {
  groups: Group[];
  onSelect: (groupId: string) => void;
  onBack: () => void;
}

/**
 * Étape intermédiaire de l'onglet « Cotiser » quand plusieurs cercles sont
 * actifs : on demande lequel payer plutôt que d'en choisir un arbitrairement.
 */
export function ChooseCircleToPay({ groups, onSelect, onBack }: ChooseCircleToPayProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-4 pb-4">
      <ScreenBar title={t('cotiser_pick_circle_title')} onBack={onBack} />

      {groups.length === 0 ? (
        <EmptyState
          illustration="no-circles"
          title={t('cotiser_no_circle')}
          description={t('no_circle_desc')}
        />
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelect(group.id)}
              className="flex min-h-16 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors duration-150 first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/50 active:bg-muted"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-foreground">{group.name}</span>
                <span className="block text-[13px] text-muted-foreground">
                  {t('deadline_prefix')} {format(new Date(group.nextPayoutDate), 'dd MMM yyyy', { locale: fr })}
                </span>
              </span>
              <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                {group.contributionAmount.toLocaleString()} {group.currency}
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
