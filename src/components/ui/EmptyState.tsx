import React from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { EganyeIllustration, type EganyeIllustrationName } from './EganyeIllustration';
import { EganyeMascot, type MascotVariant } from './EganyeMascot';

interface EmptyStateProps {
  /** Eganyé illustration name (preferred) */
  illustration?: EganyeIllustrationName;
  /** Mascot variant */
  mascotVariant?: MascotVariant;
  /** Legacy: image URL fallback */
  illustrationUrl?: string;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
}

/**
 * EganyeEmptyState — Warm, branded empty state with Eganyé illustrations or Ganyé mascot.
 */
export function EmptyState({
  illustration,
  mascotVariant,
  illustrationUrl,
  title,
  description,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="glass-card p-6 sm:p-8 rounded-3xl border border-[#EFE2D0] dark:border-border text-center flex flex-col items-center justify-center max-w-md mx-auto my-4 space-y-4"
    >
      {mascotVariant ? (
        <EganyeMascot variant={mascotVariant} size={110} />
      ) : illustration ? (
        <EganyeIllustration name={illustration} width={130} />
      ) : illustrationUrl ? (
        <div className="w-32 h-32 relative overflow-hidden rounded-2xl p-2 bg-muted/20 border border-border/40">
          <img src={illustrationUrl} alt={title} className="w-full h-full object-contain" />
        </div>
      ) : (
        <EganyeMascot variant="empty" size={100} />
      )}

      <div className="space-y-1">
        <h3 className="text-base sm:text-lg font-serif font-black text-foreground">{title}</h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xs">{description}</p>
      </div>

      {(actionText || secondaryActionText) && (
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 w-full max-w-xs">
          {actionText && onAction && (
            <Button
              onClick={onAction}
              className="w-full rounded-2xl h-11 bg-[#C96F4A] hover:bg-[#B85C36] text-white font-bold text-xs cursor-pointer shadow-xs"
            >
              {actionText}
            </Button>
          )}
          {secondaryActionText && onSecondaryAction && (
            <Button
              variant="outline"
              onClick={onSecondaryAction}
              className="w-full rounded-2xl h-10 border-[#EFE2D0] dark:border-border text-xs font-semibold cursor-pointer"
            >
              {secondaryActionText}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}
