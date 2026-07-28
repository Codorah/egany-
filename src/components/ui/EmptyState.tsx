import React from 'react';
import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: LucideIcon;
  illustration?: string;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  variant?: 'amber' | 'emerald' | 'blue' | 'purple';
}

export function EmptyState({
  icon: Icon,
  illustration = '/fintech-piggybank.png',
  title,
  description,
  actionText,
  onAction,
  variant = 'amber',
}: EmptyStateProps) {
  const colors = {
    amber: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-600',
      border: 'border-amber-500/20',
      button: 'bg-primary hover:bg-primary/90 text-primary-foreground',
    },
    emerald: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-600',
      border: 'border-emerald-500/20',
      button: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    },
    blue: {
      bg: 'bg-blue-500/10',
      text: 'text-blue-500',
      border: 'border-blue-500/20',
      button: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
    purple: {
      bg: 'bg-purple-500/10',
      text: 'text-purple-500',
      border: 'border-purple-500/20',
      button: 'bg-purple-600 hover:bg-purple-700 text-white',
    },
  };

  const currentTheme = colors[variant];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`glass-card p-8 sm:p-10 rounded-3xl border ${currentTheme.border} text-center flex flex-col items-center justify-center max-w-md mx-auto my-6 space-y-4`}
    >
      {illustration ? (
        <div className="w-36 h-36 relative overflow-hidden rounded-2xl p-2 bg-muted/20 border border-border/40">
          <img src={illustration} alt={title} className="w-full h-full object-contain" />
        </div>
      ) : Icon ? (
        <div className={`p-4 rounded-2xl ${currentTheme.bg} ${currentTheme.text}`}>
          <Icon className="w-8 h-8" />
        </div>
      ) : null}

      <div className="space-y-1">
        <h3 className="text-lg font-serif font-black text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">{description}</p>
      </div>

      {actionText && onAction && (
        <Button
          onClick={onAction}
          className={`rounded-2xl px-6 py-2 h-10 text-xs font-bold ${currentTheme.button}`}
        >
          {actionText}
        </Button>
      )}
    </motion.div>
  );
}
