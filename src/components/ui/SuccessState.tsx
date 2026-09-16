import React from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { AmountDisplay } from './AmountDisplay';
import { EganyeIllustration, type EganyeIllustrationName } from './EganyeIllustration';
import { BrandVisual } from './BrandVisual';

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
      {/* Le rendu de marque porte déjà la coche : un second pictogramme
          animé au-dessus ferait redite, et son vert vif jure avec l olive
          de la charte. */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 16, delay: 0.1 }}
      >
        <BrandVisual name="success" height={190} alt="" />
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
