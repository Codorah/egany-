import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AmountDisplay } from './AmountDisplay';

interface SuccessStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  amount?: number;
  currency?: string;
  actionText?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
}

/**
 * Écran/carte de confirmation après une action financière réussie (paiement,
 * dépôt, retrait…) — jusqu'ici seuls des toasts sonner existaient pour ça.
 */
export function SuccessState({
  icon: Icon = CheckCircle2,
  title,
  description,
  amount,
  currency = 'FCFA',
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
}: SuccessStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="glass-card rounded-3xl border border-secondary/20 p-8 sm:p-10 text-center flex flex-col items-center justify-center max-w-md mx-auto my-6 space-y-4"
    >
      <div className="p-4 rounded-full bg-success-soft text-secondary">
        <Icon className="w-9 h-9" />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-lg font-serif font-black text-foreground">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">{description}</p>
        )}
      </div>

      {typeof amount === 'number' && (
        <AmountDisplay amount={amount} currency={currency} size="xl" className="text-secondary" currencyClassName="text-secondary/70" />
      )}

      {(actionText && onAction) || (secondaryActionText && onSecondaryAction) ? (
        <div className="w-full space-y-2 pt-2">
          {actionText && onAction && (
            <Button
              onClick={onAction}
              className="w-full rounded-2xl h-11 font-bold bg-secondary hover:bg-secondary/90 text-white cursor-pointer active:scale-95 transition-transform"
            >
              {actionText}
            </Button>
          )}
          {secondaryActionText && onSecondaryAction && (
            <Button
              onClick={onSecondaryAction}
              variant="ghost"
              className="w-full rounded-2xl h-10 font-bold text-muted-foreground cursor-pointer"
            >
              {secondaryActionText}
            </Button>
          )}
        </div>
      ) : null}
    </motion.div>
  );
}
