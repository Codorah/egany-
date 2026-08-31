import React from 'react';
import { ArrowLeft, ChevronRight, Users } from 'lucide-react';
import { Group } from '@/types';
import { EmptyState } from './ui/EmptyState';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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
    <div className="space-y-5 pb-4">
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('a11y_back')}
          className="w-12 h-12 rounded-2xl bg-card border border-border flex items-center justify-center text-foreground hover:bg-muted cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-[24px] leading-tight font-serif font-bold text-foreground tracking-tight">
          {t('cotiser_pick_circle_title')}
        </h1>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('cotiser_no_circle')}
          description={t('no_circle_desc')}
        />
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <button
              key={group.id}
              onClick={() => onSelect(group.id)}
              className="w-full glass-card rounded-2xl p-4 shadow-soft border border-border text-left flex items-center gap-3.5 cursor-pointer active:scale-[0.985] transition-transform"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 font-serif font-bold text-base">
                {group.name.substring(0, 2).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <span className="block font-serif font-bold text-base text-foreground truncate">
                  {group.name}
                </span>
                <span className="block text-[13px] font-semibold text-muted-foreground">
                  {t('deadline_prefix')}{' '}
                  {format(new Date(group.nextPayoutDate), 'dd MMM yyyy', { locale: fr })}
                </span>
              </div>

              <div className="text-right shrink-0">
                <span className="block text-base font-extrabold text-foreground">
                  {group.contributionAmount.toLocaleString()}
                </span>
                <span className="block text-[13px] font-bold text-muted-foreground uppercase">
                  {group.currency}
                </span>
              </div>

              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
