import React from 'react';
import { EganyeIcon, type EganyeIconName } from './EganyeIcon';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'gold';

interface StatusBadgeProps {
  label: string;
  tone?: Tone;
  pulse?: boolean;
  icon?: EganyeIconName;
  className?: string;
}

const TONE_CLASSES: Record<Tone, string> = {
  success: 'bg-success-soft text-secondary border-secondary/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  danger: 'bg-danger-soft text-danger border-danger/20',
  info: 'bg-primary/10 text-primary border-primary/20',
  neutral: 'bg-muted text-muted-foreground border-border',
  gold: 'bg-[var(--gold)]/10 text-[var(--gold)] border-[var(--gold)]/20',
};

const TONE_ICONS: Record<Tone, EganyeIconName> = {
  success: 'completed',
  warning: 'pending',
  danger: 'late',
  info: 'info',
  neutral: 'info',
  gold: 'star',
};

/**
 * Pastille de statut Eganyé — un seul composant pour tous les badges
 * « Payé / En attente / Vérifié / Rejeté… ». Chaque tone porte une icône
 * par défaut, pour ne jamais transmettre l'information uniquement par la couleur.
 */
export function StatusBadge({ label, tone = 'neutral', pulse = false, icon, className = '' }: StatusBadgeProps) {
  const iconName = icon || TONE_ICONS[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border text-[11px] font-bold px-2.5 py-0.5 whitespace-nowrap ${TONE_CLASSES[tone]} ${pulse ? 'animate-pulse' : ''} ${className}`}
    >
      <EganyeIcon name={iconName} size={12} strokeWidth={2.2} />
      {label}
    </span>
  );
}
