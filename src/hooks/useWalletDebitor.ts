import { useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, getDoc } from 'firebase/firestore';
import { Group, UserProfile, Contribution } from '@/types';
import { toast } from 'sonner';
import { executeFinancialTransaction } from '@/lib/ledger';
import { calculateLatePenalty } from '@/lib/penalties';

export function useWalletDebitor(profile: UserProfile | null, groups: Group[]) {
  const processingRef = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (!profile || groups.length === 0) return;

    const runAutoDebitCheck = async () => {
      for (const group of groups) {
        if (group.status !== 'active') continue;

        try {
          const contributionsRef = collection(db, 'groups', group.id, 'contributions');
          const q = query(
            contributionsRef,
            where('userId', '==', profile.uid)
          );
          
          const snapshot = await getDocs(q);
          const userConts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Contribution[];

          // Filter for pending or late contributions that need auto-debit
          const pendingConts = userConts.filter(c => c.status === 'pending' || c.status === 'late');

          for (const cont of pendingConts) {
            // Avoid duplicate processing in same run
            if (processingRef.current[cont.id]) continue;
            processingRef.current[cont.id] = true;

            try {
              // Fetch fresh user profile to avoid race condition with wallet balance
              const userRef = doc(db, 'users', profile.uid);
              const freshUserSnap = await getDoc(userRef);
              if (!freshUserSnap.exists()) {
                processingRef.current[cont.id] = false;
                continue;
              }
              const freshUser = freshUserSnap.data() as UserProfile;
              const currentBalance = freshUser.walletBalance !== undefined ? freshUser.walletBalance : 0;
              const pendingPenalty = cont.penaltyStatus === 'pending' ? (cont.penaltyApplied || 0) : 0;
              const totalDue = cont.amount + pendingPenalty;

              if (currentBalance >= totalDue) {
                const idempotencyKey = `debit_${cont.id}`;
                const penaltyNote = pendingPenalty > 0 ? ` (dont ${pendingPenalty.toLocaleString()} ${group.currency} de pénalité de retard)` : '';

                // Execute safe double-entry ledger financial transaction
                const ledgerResult = await executeFinancialTransaction({
                  idempotencyKey,
                  userId: profile.uid,
                  amount: totalDue,
                  currency: group.currency || 'FCFA',
                  description: `Cotisation automatique - ${group.name} (${cont.period || 'Période'})${penaltyNote}`,
                  actionType: 'contribution_payment',
                  debitAccount: `user_wallet:${profile.uid}`,
                  creditAccount: `tontine_group:${group.id}`,
                  metadata: {
                    groupId: group.id,
                    contributionId: cont.id
                  }
                });

                if (!ledgerResult.success) {
                  throw new Error(ledgerResult.message);
                }

                if (pendingPenalty > 0) {
                  await updateDoc(doc(db, 'groups', group.id, 'contributions', cont.id), {
                    penaltyStatus: 'paid'
                  });
                }

                // Create wallet transaction record for display
                await addDoc(collection(db, 'users', profile.uid, 'walletTransactions'), {
                  userId: profile.uid,
                  amount: -totalDue,
                  type: 'contribution_debit',
                  description: `Cotisation automatique - ${group.name} (${cont.period || 'Période'})${penaltyNote}`,
                  date: new Date().toISOString(),
                  status: 'completed',
                  paymentMethod: 'wallet',
                  reference: ledgerResult.transactionId || cont.id
                });

                // 4. Create User Notification
                await addDoc(collection(db, 'notifications'), {
                  userId: profile.uid,
                  title: `Cotisation prélevée - ${group.name}`,
                  message: `Votre cotisation de ${totalDue.toLocaleString()} ${group.currency} a été prélevée de votre portefeuille pour la période ${cont.period || ''}${penaltyNote}.`,
                  type: 'payout',
                  read: false,
                  createdAt: serverTimestamp(),
                  link: `/group/${group.id}`
                });

                // 5. Create Group chat/community announcement
                await addDoc(collection(db, 'groups', group.id, 'messages'), {
                  groupId: group.id,
                  userId: 'system',
                  userName: 'Système Tontine',
                  userPhoto: '',
                  content: `📢 ${profile.displayName} a réglé sa cotisation de ${totalDue.toLocaleString()} ${group.currency} pour la période ${cont.period || ''} par prélèvement automatique !`,
                  createdAt: serverTimestamp()
                });

                toast.success(`Cotisation prélevée automatiquement pour ${group.name} !`);
              } else {
                // Insufficient balance handling
                // Check if we already alerted for this specific contribution
                const contData = cont as any;
                if (!contData.notifiedInsufficient) {
                  const { penaltyAmount } = calculateLatePenalty(cont, group);

                  // Transition to 'late' if it was 'pending', flag it, and apply the late penalty (if configured)
                  const contRef = doc(db, 'groups', group.id, 'contributions', cont.id);
                  await updateDoc(contRef, {
                    status: 'late',
                    notifiedInsufficient: true,
                    ...(penaltyAmount > 0 ? { penaltyApplied: penaltyAmount, penaltyStatus: 'pending' } : {})
                  });

                  const penaltyMsg = penaltyAmount > 0 ? ` Une pénalité de retard de ${penaltyAmount.toLocaleString()} ${group.currency} a été appliquée.` : '';

                  // Create Critical User Notification
                  await addDoc(collection(db, 'notifications'), {
                    userId: profile.uid,
                    title: `⚠️ Solde Insuffisant - ${group.name}`,
                    message: `Le prélèvement de ${cont.amount.toLocaleString()} ${group.currency} a échoué car le solde de votre portefeuille est insuffisant (${currentBalance.toLocaleString()} ${group.currency}). Veuillez recharger.${penaltyMsg}`,
                    type: 'reminder',
                    read: false,
                    createdAt: serverTimestamp(),
                    link: `/profile`
                  });

                  // Post warning to Group Community/Chat
                  await addDoc(collection(db, 'groups', group.id, 'messages'), {
                    groupId: group.id,
                    userId: 'system',
                    userName: 'Système Tontine',
                    userPhoto: '',
                    content: `⚠️ Alerte : Le prélèvement automatique de ${cont.amount.toLocaleString()} ${group.currency} de ${profile.displayName} a échoué (solde de portefeuille insuffisant).${penaltyMsg}`,
                    createdAt: serverTimestamp()
                  });

                  toast.error(`Solde insuffisant pour régler la cotisation de ${group.name}.${penaltyMsg}`);
                }
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

    // Run once on load/update
    runAutoDebitCheck();

    // Set interval to check periodically (e.g. every 30 seconds)
    const interval = setInterval(runAutoDebitCheck, 30000);
    return () => clearInterval(interval);
  }, [profile, groups]);
}
