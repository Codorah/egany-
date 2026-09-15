import React from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { AmountDisplay } from './AmountDisplay';
import { EganyeIllustration, type EganyeIllustrationName } from './EganyeIllustration';

interface SuccessStateProps {
  illustration?: EganyeIllustrationName;
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
 * EganyeSuccessState — Animated success confirmation with Eganyé branding.
 * Features an animated SVG checkmark and optional illustration.
 */
export function SuccessState({
  illustration = 'payment-success',
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
      {/* Animated check circle */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
      >
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-success-soft flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path
                d="M10 20L17 27L30 13"
                stroke="var(--success)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-check-draw"
              />
            </svg>
          </div>
          {/* Sparkle particles */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.8] }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full"
            style={{ backgroundColor: 'var(--gold)' }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.8] }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="absolute -bottom-1 -left-1 w-3 h-3 rounded-full"
            style={{ backgroundColor: 'var(--primary)' }}
          />
        </div>
      </motion.div>

      <div className="space-y-1.5">
        <h3 className="text-lg font-serif font-black text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{description}</p>
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
              className="btn-shine w-full rounded-2xl h-11 font-bold bg-secondary hover:bg-secondary/90 text-white cursor-pointer"
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
