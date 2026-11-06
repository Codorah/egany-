import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EganyeIcon } from './EganyeIcon';
import { BrandVisual } from './BrandVisual';
import { Celebration } from './Celebration';
import { apiUrl } from '@/lib/apiBase';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Attente de confirmation Mobile Money, sans quitter eganyé.
 *
 * Quand l'opérateur choisi le permet (SoftPay), Paydunya envoie directement la
 * demande de code sur le téléphone au lieu de rediriger vers une page web.
 * Cet écran occupe cette attente et la termine explicitement.
 *
 * Le sondage ne sert QU'À afficher. Le crédit reste décidé par le webhook
 * Paydunya (api/paydunya-webhook), seul habilité à toucher un portefeuille.
 *
 * Délai dépassé et échec sont deux états distincts : un délai dépassé ne veut
 * pas dire que le paiement a échoué. Proposer de repayer en premier à ce
 * moment-là pourrait faire payer deux fois.
 */

type PollStatus = 'pending' | 'completed' | 'failed' | 'timeout';

interface PaymentPendingCardProps {
  invoiceToken: string;
  /** Montant qui arrivera sur le portefeuille (net de frais). */
  netAmount: number;
  /** Montant réellement débité sur le Mobile Money (net + frais). */
  grossAmount: number;
  operatorLabel: string;
  phone: string;
  onDone: () => void;
  onRetry: () => void;
}

/** Intervalle de sondage : assez court pour paraître vivant, assez long pour
 *  ne pas marteler l'API pendant les deux minutes que peut durer une saisie
 *  de code USSD. */
const POLL_INTERVAL_MS = 4000;
/** Au-delà, on cesse de sonder : la demande n'est pas perdue pour autant, le
 *  webhook créditera quand la confirmation arrivera. */
const TIMEOUT_MS = 3 * 60 * 1000;

export function PaymentPendingCard({
  invoiceToken,
  netAmount,
  grossAmount,
  operatorLabel,
  phone,
  onDone,
  onRetry,
}: PaymentPendingCardProps) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<PollStatus>('pending');
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (status !== 'pending') return;
    let cancelled = false;

    const poll = async () => {
      if (Date.now() - startedAt.current > TIMEOUT_MS) {
        if (!cancelled) setStatus('timeout');
        return;
      }
      try {
        const response = await fetch(apiUrl(`/api/paydunya-invoice-status?token=${encodeURIComponent(invoiceToken)}`));
        if (!response.ok) return; // Incident réseau passager : on retentera.
        const data = await response.json().catch(() => null);
        const value = String(data?.status || 'pending').toLowerCase();
        if (cancelled) return;
        if (value === 'completed') setStatus('completed');
        else if (value === 'cancelled' || value === 'failed') setStatus('failed');
      } catch {
        // Silencieux volontairement : une coupure passagère ne doit pas
        // annoncer un échec de paiement, qui lui est définitif.
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [invoiceToken, status]);

  if (status === 'completed') {
    return (
      <div className="text-center space-y-4">
        <div className="relative flex justify-center">
          <BrandVisual name="success" height={150} alt="" />
          <Celebration />
        </div>
        <div className="space-y-1.5" aria-live="polite">
          <h3 className="text-xl font-bold text-foreground">{t('pay_confirmed_title')}</h3>
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            {netAmount.toLocaleString()} FCFA {t('pay_confirmed_desc')}
          </p>
        </div>
        <Button onClick={onDone} className="w-full h-12 rounded-xl font-bold text-[15px] cursor-pointer">
          {t('pay_view_wallet')}
        </Button>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <BrandVisual name="failed" height={150} alt="" />
        </div>
        <div className="space-y-1.5" aria-live="polite">
          <h3 className="text-xl font-bold text-foreground">{t('pay_failed_title')}</h3>
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            {t('pay_failed_desc')}
          </p>
        </div>
        <div className="space-y-2">
          <Button onClick={onRetry} className="w-full h-12 rounded-xl font-bold text-[15px] cursor-pointer">
            {t('pay_retry')}
          </Button>
          <Button onClick={onDone} variant="ghost" className="w-full h-12 rounded-xl font-bold text-sm text-foreground cursor-pointer">
            {t('pay_back_to_wallet')}
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'timeout') {
    return (
      <div className="text-center space-y-4">
        <div className="space-y-1.5 pt-6" aria-live="polite">
          <h3 className="text-xl font-bold text-foreground">{t('pay_timeout_title')}</h3>
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            {t('pay_timeout_desc_prefix')} {operatorLabel}. {t('pay_not_received_desc_2')}
          </p>
        </div>
        <div className="space-y-2">
          <Button onClick={onDone} className="w-full h-12 rounded-xl font-bold text-[15px] cursor-pointer">
            {t('pay_back_to_wallet')}
          </Button>
          <Button onClick={onRetry} variant="ghost" className="w-full h-12 rounded-xl font-bold text-sm text-foreground cursor-pointer">
            {t('pay_timeout_retry')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-center pt-2">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-foreground">
          <EganyeIcon name="call" size={26} />
        </div>
      </div>

      <div className="text-center space-y-1.5" aria-live="polite">
        <h3 className="text-xl font-bold text-foreground">
          {t('pay_confirm_on_phone')}
        </h3>
        <p className="text-[15px] text-muted-foreground leading-relaxed">
          {operatorLabel} {t('pay_request_sent_to')} <strong className="text-foreground">{phone}</strong>.
          {' '}{t('pay_enter_pin')}
        </p>
      </div>

      <div className="rounded-2xl border border-border divide-y divide-border bg-card">
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="text-muted-foreground">{t('pay_amount_debited')}</span>
          <span className="font-bold text-foreground tabular-nums">{grossAmount.toLocaleString()} FCFA</span>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="text-muted-foreground">{t('pay_credited_to_wallet')}</span>
          <span className="font-bold text-foreground tabular-nums">{netAmount.toLocaleString()} FCFA</span>
        </div>
      </div>

      <p className="text-[13px] text-center text-muted-foreground leading-relaxed">
        {t('pay_waiting_confirmation')}. {t('pay_can_leave')}
      </p>

      <Button onClick={onDone} variant="ghost" className="w-full h-12 rounded-xl font-bold text-sm text-foreground cursor-pointer">
        {t('pay_close')}
      </Button>
    </div>
  );
}
