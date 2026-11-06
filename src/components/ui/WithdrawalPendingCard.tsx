import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { BrandVisual } from './BrandVisual';
import { Celebration } from './Celebration';
import { EganyeIcon } from './EganyeIcon';
import { fetchWithdrawalStatus, type WithdrawalState } from '@/lib/ledger';

/**
 * Suivi d'un retrait, sur le modèle de PaymentPendingCard pour les dépôts.
 *
 * Le destinataire n'a rien à confirmer sur son téléphone : le code PIN saisi dans
 * eganyé autorise l'envoi. Cet écran montre où en est l'argent, et ne parle jamais
 * d'échec sur une simple attente : un envoi lent peut encore aboutir.
 */

const POLL_INTERVAL_MS = 4000;
/** Au-delà on cesse de demander. Le callback PayDunya mettra quand même le retrait à jour. */
const TIMEOUT_MS = 3 * 60 * 1000;

interface WithdrawalPendingCardProps {
  withdrawalId: string | null;
  state: WithdrawalState;
  /** Ce qui est envoyé sur le Mobile Money. */
  amount: number;
  /** Ce qui a quitté le portefeuille, frais compris. */
  debited: number;
  fee: number;
  operatorLabel: string;
  phone: string;
  defaultPin: boolean;
  onDone: () => void;
  onChangePin: () => void;
}

export function WithdrawalPendingCard({
  withdrawalId,
  state: initialState,
  amount,
  debited,
  fee,
  operatorLabel,
  phone,
  defaultPin,
  onDone,
  onChangePin,
}: WithdrawalPendingCardProps) {
  const [state, setState] = useState<WithdrawalState>(initialState);
  const [timedOut, setTimedOut] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (state !== 'processing' || !withdrawalId || timedOut) return;
    let cancelled = false;

    const poll = async () => {
      if (Date.now() - startedAt.current > TIMEOUT_MS) {
        if (!cancelled) setTimedOut(true);
        return;
      }
      const result = await fetchWithdrawalStatus(withdrawalId);
      if (cancelled) return;
      // Coupure passagère : on garde l'état affiché et on redemande.
      if (result.success && result.state) setState(result.state);
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [state, withdrawalId, timedOut]);

  const amountLabel = `${amount.toLocaleString()} FCFA`;

  if (state === 'sent') {
    return (
      <div className="text-center space-y-4">
        <div className="relative flex justify-center">
          <BrandVisual name="success" height={150} alt="" />
          <Celebration />
        </div>
        <div className="space-y-1.5" aria-live="polite">
          <h3 className="text-xl font-bold text-foreground">Retrait effectué</h3>
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            {amountLabel} ont été envoyés sur votre compte {operatorLabel} (<strong className="text-foreground">{phone}</strong>).
          </p>
        </div>
        <Button onClick={onDone} className="w-full h-12 rounded-xl font-bold text-[15px] cursor-pointer">
          Voir mon portefeuille
        </Button>
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <BrandVisual name="failed" height={150} alt="" />
        </div>
        <div className="space-y-1.5" aria-live="polite">
          <h3 className="text-xl font-bold text-foreground">Retrait remboursé</h3>
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            Cet envoi n'a pas pu être fait. {debited.toLocaleString()} FCFA ont été rendus à votre portefeuille.
          </p>
        </div>
        <Button onClick={onDone} variant="ghost" className="w-full h-12 rounded-xl font-bold text-sm text-foreground cursor-pointer">
          Retour au portefeuille
        </Button>
      </div>
    );
  }

  const isProcessing = state === 'processing';

  return (
    <div className="space-y-5">
      <div className="flex justify-center pt-2">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-foreground">
          <EganyeIcon name="call" size={26} />
        </div>
      </div>

      <div className="text-center space-y-1.5" aria-live="polite">
        <h3 className="text-xl font-bold text-foreground">
          {isProcessing ? 'Envoi de votre argent' : 'Retrait pris en charge'}
        </h3>
        <p className="text-[15px] text-muted-foreground leading-relaxed">
          {isProcessing
            ? <>{amountLabel} sont en route vers votre compte {operatorLabel} (<strong className="text-foreground">{phone}</strong>).</>
            : <>{amountLabel} seront envoyés vers {operatorLabel} (<strong className="text-foreground">{phone}</strong>). Notre équipe finalise cet envoi.</>}
        </p>
      </div>

      <div className="rounded-2xl border border-border divide-y divide-border bg-card">
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Débité de votre solde</span>
          <span className="font-bold text-foreground tabular-nums">{debited.toLocaleString()} FCFA</span>
        </div>
        {fee > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Dont frais de retrait</span>
            <span className="font-bold text-foreground tabular-nums">{fee.toLocaleString()} FCFA</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Envoyé sur votre compte</span>
          <span className="font-bold text-foreground tabular-nums">{amountLabel}</span>
        </div>
      </div>

      <p className="text-[13px] text-center text-muted-foreground leading-relaxed">
        {isProcessing && timedOut
          ? "L'opérateur met plus de temps que d'habitude. Votre argent reste réservé, et vous recevrez une notification dès qu'il est envoyé."
          : "Vous recevrez une notification dès que l'argent est envoyé. Vous pouvez quitter cet écran."}
      </p>

      {defaultPin && (
        <div className="rounded-2xl bg-muted p-4 space-y-1 text-center">
          <p className="text-sm text-foreground leading-relaxed">
            Votre code PIN est encore 0000. Changez-le pour que vos prochains retraits partent tout de suite.
          </p>
          <button
            type="button"
            onClick={onChangePin}
            className="min-h-11 px-3 text-sm font-bold text-primary-ink underline underline-offset-2 cursor-pointer"
          >
            Changer mon code PIN
          </button>
        </div>
      )}

      <Button onClick={onDone} variant="ghost" className="w-full h-12 rounded-xl font-bold text-sm text-foreground cursor-pointer">
        Fermer
      </Button>
    </div>
  );
}
