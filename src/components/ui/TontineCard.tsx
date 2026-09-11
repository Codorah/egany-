import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Group } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { AmountDisplay } from './AmountDisplay';

interface TontineCardProps {
  group: Group;
  onClick: () => void;
}

/**
 * Ligne « cercle » compacte — nom + une ligne de contexte + montant. Le
 * détail (progression, statut, membres) vit dans la fiche du cercle, pas ici.
 * Extrait du Dashboard pour être réutilisé aussi dans l'onglet Cercle.
 */
export function TontineCard({ group, onClick }: TontineCardProps) {
  const { t } = useLanguage();

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
      <div className="w-11 h-11 rounded-2xl bg-brand/10 text-brand flex items-center justify-center shrink-0 font-serif font-black text-base border border-brand/20">
        {group.name.substring(0, 2).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-serif font-bold text-sm text-foreground truncate">{group.name}</h3>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {group.members.length} {t('participants')} · {t(`freq_${group.frequency}`)}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <AmountDisplay amount={group.contributionAmount} currency={group.currency} size="sm" className="whitespace-nowrap" />
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </div>
  );
}
