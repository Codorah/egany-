import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { EganyeIcon } from './EganyeIcon';
import { BrandVisual } from './BrandVisual';
import { apiUrl } from '@/lib/apiBase';

/**
 * Attente de confirmation Mobile Money, sans quitter eganyé.
 *
 * Quand l'opérateur choisi le permet (SoftPay), Paydunya envoie directement la
 * demande de code sur le téléphone au lieu de rediriger vers une page web.
 * Jusqu'ici l'application se contentait d'un message fugace puis refermait le
 * formulaire : l'utilisatrice se retrouvait devant son solde inchangé, sans
 * rien lui indiquant qu'elle devait composer son code, ni combien de temps
 * attendre. Cet écran occupe cette attente et la termine explicitement.
 *
 * Le sondage ne sert QU'À afficher. Le crédit reste décidé par le webhook
 * Paydunya (api/paydunya-webhook), seul habilité à toucher un portefeuille —
 * cet écran ne fait que regarder, et le nouveau solde arrive de lui-même par
 * le canal temps réel de `profiles`.
 */

type PollStatus = 'pending' | 'completed' | 'failed';

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
  const [status, setStatus] = useState<PollStatus>('pending');
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(Date.now());

  // Compteur d'attente, purement visuel : sans lui l'écran paraît figé et on
  // ne sait pas si quelque chose se passe encore.
  useEffect(() => {
    if (status !== 'pending') return;
    const tick = setInterval(() => setElapsed(Date.now() - startedAt.current), 1000);
    return () => clearInterval(tick);
  }, [status]);

  useEffect(() => {
    if (status !== 'pending') return;
    let cancelled = false;

    const poll = async () => {
      if (Date.now() - startedAt.current > TIMEOUT_MS) {
        if (!cancelled) setStatus('failed');
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

  const seconds = Math.floor(elapsed / 1000);
  const timeLabel = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  if (status === 'completed') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-card rounded-3xl p-6 border border-secondary/25 shadow-soft text-center space-y-4"
      >
        <div className="flex justify-center">
          <BrandVisual name="success" height={150} alt="" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-serif font-black text-foreground">Paiement confirmé</h3>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            {netAmount.toLocaleString()} FCFA arrivent sur votre portefeuille. Le solde se met à jour tout seul.
          </p>
        </div>
        <Button
          onClick={onDone}
          className="btn-shine w-full h-11 rounded-2xl font-bold text-sm bg-secondary hover:bg-secondary/90 text-white cursor-pointer"
        >
          Voir mon portefeuille
        </Button>
      </motion.div>
    );
  }

  if (status === 'failed') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-card rounded-3xl p-6 border border-[#EFE2D0] dark:border-border/80 shadow-soft text-center space-y-4"
      >
        <div className="flex justify-center">
          <BrandVisual name="failed" height={150} alt="" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-serif font-black text-foreground">Confirmation non reçue</h3>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Nous n'avons pas reçu la confirmation de {operatorLabel}. Si vous avez composé votre code,
            le portefeuille sera crédité dès l'arrivée de la confirmation — inutile de payer une seconde fois.
          </p>
        </div>
        <div className="space-y-2">
          <Button
            onClick={onRetry}
            className="btn-shine gradient-sunset w-full h-11 rounded-2xl font-bold text-sm text-white cursor-pointer"
          >
            Réessayer
          </Button>
          <Button
            onClick={onDone}
            variant="ghost"
            className="w-full h-10 rounded-2xl font-bold text-xs text-muted-foreground cursor-pointer"
          >
            Retour au portefeuille
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-card rounded-3xl p-6 border border-[#EFE2D0] dark:border-border/80 shadow-soft space-y-5"
    >
      {/* Téléphone qui « sonne » : l'anneau pulsé dit qu'on attend un geste de
          l'utilisatrice, pas que l'application charge quelque chose. */}
      <div className="flex justify-center pt-1">
        <div className="relative">
          <motion.span
            className="absolute inset-0 rounded-full bg-[#C96F4A]/20"
            animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
          <div className="relative w-16 h-16 rounded-full gradient-sunset flex items-center justify-center text-white">
            <EganyeIcon name="call" size={26} />
          </div>
        </div>
      </div>

      <div className="text-center space-y-1.5">
        <h3 className="text-base font-serif font-black text-foreground">
          Confirmez sur votre téléphone
        </h3>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          {operatorLabel} vient d'envoyer une demande au <strong className="text-foreground">{phone}</strong>.
          Composez votre code secret pour valider le paiement.
        </p>
      </div>

      <div className="rounded-2xl bg-muted/50 border border-[#EFE2D0] dark:border-border/80 p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Montant débité</span>
          <span className="font-bold text-foreground tabular-nums">{grossAmount.toLocaleString()} FCFA</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Crédité au portefeuille</span>
          <span className="font-bold text-foreground tabular-nums">{netAmount.toLocaleString()} FCFA</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-[#C96F4A] animate-pulse" />
        <span>En attente de confirmation · {timeLabel}</span>
      </div>

      <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
        Vous pouvez quitter cet écran : le portefeuille sera crédité dès la confirmation de l'opérateur.
      </p>

      <Button
        onClick={onDone}
        variant="ghost"
        className="w-full h-10 rounded-2xl font-bold text-xs text-muted-foreground cursor-pointer"
      >
        Fermer
      </Button>
    </motion.div>
  );
}
