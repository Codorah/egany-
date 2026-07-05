import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, ArrowDown, CreditCard, Send, Wallet, X } from 'lucide-react';
import { Button } from './button';

interface ConfirmationBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  amount?: number;
  currency?: string;
  type?: 'debit' | 'transfer' | 'recharge' | 'generic';
  isLoading?: boolean;
}

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
}: ConfirmationBottomSheetProps) {
  // Prevent background scroll when open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/60 z-50 backdrop-blur-xs"
          />

          {/* Bottom Sheet / Modal Container */}
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4 pointer-events-none">
            <motion.div
              initial={{ 
                y: typeof window !== 'undefined' && window.innerWidth < 640 ? '100%' : 20, 
                opacity: typeof window !== 'undefined' && window.innerWidth < 640 ? 1 : 0,
                scale: typeof window !== 'undefined' && window.innerWidth < 640 ? 1 : 0.95 
              }}
              animate={{ 
                y: 0, 
                opacity: 1,
                scale: 1 
              }}
              exit={{ 
                y: typeof window !== 'undefined' && window.innerWidth < 640 ? '100%' : 15, 
                opacity: typeof window !== 'undefined' && window.innerWidth < 640 ? 1 : 0,
                scale: typeof window !== 'undefined' && window.innerWidth < 640 ? 1 : 0.95 
              }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="pointer-events-auto bg-white dark:bg-slate-950 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden max-h-[90vh]"
            >
              {/* Drag/Swipe Indicator for Mobile Bottom Sheet */}
              <div className="flex justify-center py-3 sm:hidden">
                <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-6 pt-2 pb-4 sm:pt-6 flex justify-between items-start">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${
                    type === 'debit' 
                      ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600' 
                      : type === 'recharge' 
                      ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600'
                      : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600'
                  }`}>
                    {type === 'debit' && <ArrowDown className="w-5 h-5" />}
                    {type === 'recharge' && <Wallet className="w-5 h-5" />}
                    {type === 'transfer' && <Send className="w-5 h-5" />}
                    {type === 'generic' && <ShieldAlert className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">
                      {title}
                    </h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                      {type === 'debit' ? 'Débit imminent' : type === 'recharge' ? 'Rechargement' : type === 'transfer' ? 'Virement/Cotisation' : 'Opération de paiement'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-2 space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                  {description}
                </p>

                {/* Amount Highlight */}
                {amount !== undefined && (
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-widest">
                      Montant de l'opération
                    </span>
                    <span className={`text-2xl font-black mt-1 ${
                      type === 'debit' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {amount.toLocaleString()} {currency}
                    </span>
                  </div>
                )}

                {/* Transfer Diagram Visual */}
                {amount !== undefined && (
                  <div className="flex items-center justify-between px-6 py-2 text-xs text-slate-500 dark:text-slate-400 font-bold bg-slate-500/5 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                    <div className="flex flex-col items-center gap-1">
                      <div className="p-2 bg-white dark:bg-slate-900 rounded-full shadow-xs border border-slate-100 dark:border-slate-800">
                        {type === 'recharge' ? <CreditCard className="w-4 h-4 text-slate-600 dark:text-slate-300" /> : <Wallet className="w-4 h-4 text-slate-600 dark:text-slate-300" />}
                      </div>
                      <span className="text-[10px]">{type === 'recharge' ? 'Mon Mobile Money' : 'Mon Portefeuille'}</span>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center relative px-2">
                      <div className="w-full h-0.5 border-t-2 border-dashed border-slate-200 dark:border-slate-800" />
                      <div className="absolute top-1/2 -translate-y-1/2 p-0.5 bg-amber-500 text-slate-950 rounded-full shadow-xs">
                        <ArrowDown className="w-3 h-3 rotate-270" />
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <div className="p-2 bg-white dark:bg-slate-900 rounded-full shadow-xs border border-slate-100 dark:border-slate-800">
                        {type === 'recharge' ? <Wallet className="w-4 h-4 text-emerald-600" /> : <Send className="w-4 h-4 text-emerald-600" />}
                      </div>
                      <span className="text-[10px]">{type === 'recharge' ? 'Portefeuille eganyé' : 'Cercle de Tontine'}</span>
                    </div>
                  </div>
                )}

                {/* Secure / Protection Badge */}
                <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl font-bold">
                  <ShieldAlert className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Cette opération est chiffrée de bout en bout et sécurisée.</span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-6 bg-slate-50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-900 flex flex-col sm:flex-row gap-3 mt-4">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={isLoading}
                  className="w-full sm:order-1 rounded-2xl h-11 border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Annuler l'opération
                </Button>
                <Button
                  onClick={onConfirm}
                  disabled={isLoading}
                  className={`w-full sm:order-2 rounded-2xl h-11 font-bold text-white ${
                    type === 'debit'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : type === 'recharge'
                      ? 'bg-[#E67E22] hover:bg-[#E67E22]/90'
                      : 'bg-[#2BB673] hover:bg-[#2BB673]/90'
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-1.5 justify-center">
                      <span className="w-4.5 h-4.5 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                      Traitement...
                    </span>
                  ) : (
                    'Oui, je confirme'
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
