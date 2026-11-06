import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Button } from './button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';

interface ConfirmationBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  amount?: number;
  currency?: string;
  type?: 'debit' | 'transfer' | 'recharge' | 'generic' | 'destructive';
  isLoading?: boolean;
  confirmLabel?: string;
}

/**
 * Feuille de confirmation : ce qui va se passer, le montant, deux boutons.
 * Elle ne nomme aucune provenance ni destination : seul l'écran appelant les
 * connaît, et il les écrit dans `description`.
 */
export function ConfirmationBottomSheet({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  amount,
  currency = 'FCFA',
  type = 'generic',
  isLoading = false,
  confirmLabel,
}: ConfirmationBottomSheetProps) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  // Le retour Android ferme la feuille, pas l'écran en dessous.
  const handleBack = React.useCallback(() => {
    if (!isLoading) onClose();
    return true;
  }, [isLoading, onClose]);
  useBackHandler(handleBack, isOpen);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={isLoading ? undefined : onClose}
            className="absolute inset-0 bg-black/50"
          />

          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-label={title}
            initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: '100%' }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden max-h-[90dvh]"
          >
            <div className="px-5 pt-5 pb-4 space-y-2 overflow-y-auto min-h-0">
              <h3 className="text-lg font-bold text-foreground">{title}</h3>
              <p className="text-[15px] text-muted-foreground leading-relaxed">{description}</p>
              {amount !== undefined && (
                <p className="pt-2 text-[28px] leading-tight font-bold text-foreground tabular-nums">
                  {amount.toLocaleString()} {currency}
                </p>
              )}
            </div>

            <div className="px-5 pt-1 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] flex flex-col-reverse sm:flex-row gap-2 shrink-0">
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={isLoading}
                className="w-full sm:flex-1 rounded-xl h-12 text-foreground font-bold"
              >
                {t('cbs_cancel')}
              </Button>
              <Button
                onClick={onConfirm}
                disabled={isLoading}
                className={`w-full sm:flex-1 rounded-xl h-12 font-bold text-white ${
                  type === 'destructive' ? 'bg-danger hover:bg-danger/90' : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="w-4 h-4 border-2 border-white/35 border-t-white rounded-full animate-spin motion-reduce:animate-none" />
                    {t('cbs_processing')}
                  </span>
                ) : (
                  confirmLabel || t('cbs_confirm_default')
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
