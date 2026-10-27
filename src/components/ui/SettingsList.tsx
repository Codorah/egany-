import React from 'react';
import { EganyeIcon, type EganyeIconName } from './EganyeIcon';

/**
 * Listes groupées façon réglages de téléphone : un titre court, puis des
 * lignes « icône · libellé · valeur ». Même présentation partout (profil,
 * cercle, portefeuille) pour qu'on lise chaque écran de la même manière.
 */
export function SettingsGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      {title && <h2 className="text-[13px] font-bold text-muted-foreground px-3">{title}</h2>}
      <div className="bg-white dark:bg-card rounded-2xl border border-[#EFE2D0] dark:border-border/80 shadow-soft overflow-hidden divide-y divide-[#EFE2D0]/60 dark:divide-border/60">
        {children}
      </div>
    </section>
  );
}

const TONES = {
  brand: 'bg-[#FFF2E8] text-[#C96F4A]',
  sage: 'bg-[#EBF5EA] text-[#718A68]',
  sand: 'bg-[#F4EFE6] text-[#3E2F24]',
  gold: 'bg-[#FEF6E9] text-[#C49A55]',
  info: 'bg-info-soft text-info',
  muted: 'bg-muted text-muted-foreground',
} as const;

export function SettingsRow({
  icon,
  tone = 'brand',
  label,
  hint,
  value,
  onClick,
  trailing,
  danger = false,
}: {
  icon: EganyeIconName;
  tone?: keyof typeof TONES;
  label: string;
  hint?: string;
  /** Valeur courte affichée à droite (montant, état…). */
  value?: React.ReactNode;
  /** Ligne cliquable : ajoute le chevron. */
  onClick?: () => void;
  /** Élément libre à droite (interrupteur, badge…), à la place du chevron. */
  trailing?: React.ReactNode;
  danger?: boolean;
}) {
  const content = (
    <>
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${danger ? 'bg-danger-soft text-danger' : TONES[tone]}`}>
        <EganyeIcon name={icon} size={17} />
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-sm font-bold ${danger ? 'text-danger' : 'text-foreground'}`}>{label}</span>
        {hint && <span className="block text-[13px] text-muted-foreground leading-snug">{hint}</span>}
      </span>
      {value !== undefined && (
        <span className="text-sm font-bold text-foreground text-right shrink-0 max-w-[45%] truncate">{value}</span>
      )}
      {trailing}
      {onClick && !trailing && <EganyeIcon name="chevron-right" size={16} className="text-muted-foreground shrink-0" />}
    </>
  );

  const className = 'w-full flex items-center gap-3.5 px-4 py-3.5 text-left';
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} hover:bg-muted/40 active:bg-muted transition-colors cursor-pointer`}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}
