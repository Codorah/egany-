import React from 'react';
import { LucideIcon } from 'lucide-react';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps {
  label: string;
  tone?: Tone;
  pulse?: boolean;
  icon?: LucideIcon;
  className?: string;
}

const TONE_CLASSES: Record<Tone, string> = {
  success: 'bg-success-soft text-secondary border-secondary/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  danger: 'bg-danger-soft text-danger border-danger/20',
  info: 'bg-primary/10 text-primary border-primary/20',
  neutral: 'bg-muted text-muted-foreground border-border',
};

/**
 * Pastille de statut — un seul composant pour tous les badges « Payé / En
 * attente / Vérifié / Rejeté… » de l'app, pour que la même signification
 * porte toujours la même couleur (règle de cohérence : un composant utilisé
 * à plusieurs endroits doit avoir le même design).
 */
export function StatusBadge({ label, tone = 'neutral', pulse = false, icon: Icon, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border text-[11px] font-bold px-2.5 py-0.5 whitespace-nowrap ${TONE_CLASSES[tone]} ${pulse ? 'animate-pulse' : ''} ${className}`}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </span>
  );
}
