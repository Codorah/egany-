import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { mapContributionRow } from '@/lib/mappers';
import { Group, UserProfile } from '@/types';
import { toast } from 'sonner';
import { executeFinancialTransaction } from '@/lib/ledger';
import { calculateLatePenalty } from '@/lib/penalties';
import { notifyUser } from '@/lib/notify';

export function useWalletDebitor(profile: UserProfile | null, groups: Group[]) {
  const processingRef = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (!profile || groups.length === 0) return;

    const runAutoDebitCheck = async () => {
      for (const group of groups) {
        if (group.status !== 'active') continue;

        try {
          const { data: contRows, error: contError } = await supabase
            .from('contributions')
            .select('*')
            .eq('group_id', group.id)
            .eq('user_id', profile.uid);
          if (contError) throw contError;

          const userConts = (contRows ?? []).map(mapContributionRow);
          const pendingConts = userConts.filter((c) => c.status === 'pending' || c.status === 'late');

          for (const cont of pendingConts) {
            if (processingRef.current[cont.id]) continue;
            processingRef.current[cont.id] = true;

            try {
              // Fetch fresh balance to avoid a race condition with wallet balance
              const { data: freshProfile, error: profileError } = await supabase
                .from('profiles')
                .select('wallet_balance')
                .eq('id', profile.uid)
                .single();
              if (profileError || !freshProfile) {
                processingRef.current[cont.id] = false;
                continue;
              }

              const currentBalance = Number(freshProfile.wallet_balance) || 0;
              const pendingPenalty = cont.penaltyStatus === 'pending' ? (cont.penaltyApplied || 0) : 0;
              const totalDue = cont.amount + pendingPenalty;

              if (currentBalance >= totalDue) {
                const idempotencyKey = `debit_${cont.id}`;
                const penaltyNote = pendingPenalty > 0 ? ` (dont ${pendingPenalty.toLocaleString()} ${group.currency} de pénalité de retard)` : '';

                const ledgerResult = await executeFinancialTransaction({
                  idempotencyKey,
                  userId: profile.uid,
                  amount: totalDue,
                  currency: group.currency || 'FCFA',
                  description: `Cotisation automatique - ${group.name} (${cont.period || 'Période'})${penaltyNote}`,
                  actionType: 'contribution_payment',
                  debitAccount: `user_wallet:${profile.uid}`,
                  creditAccount: `tontine_group:${group.id}`,
                  metadata: { groupId: group.id, contributionId: cont.id }
                });

                if (!ledgerResult.success) {
                  throw new Error(ledgerResult.message);
                }

                if (pendingPenalty > 0) {
                  await supabase.from('contributions').update({ penalty_status: 'paid' }).eq('id', cont.id);
                }

                await supabase.from('wallet_transactions').insert({
                  user_id: profile.uid,
                  amount: -totalDue,
                  type: 'contribution_debit',
                  description: `Cotisation automatique - ${group.name} (${cont.period || 'Période'})${penaltyNote}`,
                  status: 'completed',
                  payment_method: 'wallet',
                  reference: ledgerResult.transactionId || cont.id
                });

                await notifyUser({
                  userId: profile.uid,
                  title: `Cotisation prélevée - ${group.name}`,
                  message: `Votre cotisation de ${totalDue.toLocaleString()} ${group.currency} a été prélevée de votre portefeuille pour la période ${cont.period || ''}${penaltyNote}.`,
                  type: 'payout',
                  link: `/group/${group.id}`
                });

                await supabase.from('messages').insert({
                  group_id: group.id,
                  user_id: null,
                  user_name: 'Système Tontine',
                  is_system: true,
                  content: `📢 ${profile.displayName} a réglé sa cotisation de ${totalDue.toLocaleString()} ${group.currency} pour la période ${cont.period || ''} par prélèvement automatique !`
                });

                toast.success(`Cotisation prélevée automatiquement pour ${group.name} !`);
              } else if (!cont.notifiedInsufficient) {
                const { penaltyAmount } = calculateLatePenalty(cont, group);

                await supabase.from('contributions').update({
                  status: 'late',
                  notified_insufficient: true,
                  ...(penaltyAmount > 0 ? { penalty_applied: penaltyAmount, penalty_status: 'pending' } : {})
                }).eq('id', cont.id);

                const penaltyMsg = penaltyAmount > 0 ? ` Une pénalité de retard de ${penaltyAmount.toLocaleString()} ${group.currency} a été appliquée.` : '';

                await notifyUser({
                  userId: profile.uid,
                  title: `⚠️ Solde Insuffisant - ${group.name}`,
                  message: `Le prélèvement de ${cont.amount.toLocaleString()} ${group.currency} a échoué car le solde de votre portefeuille est insuffisant (${currentBalance.toLocaleString()} ${group.currency}). Veuillez recharger.${penaltyMsg}`,
                  type: 'reminder',
                  link: `/profile`
                });

                await supabase.from('messages').insert({
                  group_id: group.id,
                  user_id: null,
                  user_name: 'Système Tontine',
                  is_system: true,
                  content: `⚠️ Alerte : Le prélèvement automatique de ${cont.amount.toLocaleString()} ${group.currency} de ${profile.displayName} a échoué (solde de portefeuille insuffisant).${penaltyMsg}`
                });

                toast.error(`Solde insuffisant pour régler la cotisation de ${group.name}.${penaltyMsg}`);
              }
            } catch (innerError) {
              console.error(`Error processing auto-debit for contribution ${cont.id}:`, innerError);
            } finally {
              processingRef.current[cont.id] = false;
            }
          }
        } catch (error) {
          console.error(`Error running auto-debit checks for group ${group.id}:`, error);
        }
      }
    };

    runAutoDebitCheck();
    const interval = setInterval(runAutoDebitCheck, 30000);
    return () => clearInterval(interval);
  }, [profile, groups]);
}
