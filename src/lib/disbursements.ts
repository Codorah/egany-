import { db } from './firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  runTransaction, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { Group, UserProfile, LedgerEntry, AuditLog } from '@/types';
import { addDays, parseISO } from 'date-fns';

/**
 * Calculates the next payout date based on frequency
 */
export function calculateNextPayoutDate(currentDateStr: string, frequency: 'weekly' | 'bi-weekly' | 'monthly'): string {
  const date = parseISO(currentDateStr);
  let nextDate = date;
  if (frequency === 'weekly') {
    nextDate = addDays(date, 7);
  } else if (frequency === 'bi-weekly') {
    nextDate = addDays(date, 14);
  } else {
    nextDate = addDays(date, 30);
  }
  return nextDate.toISOString();
}

/**
 * Executes a full payout disbursement (standard, random draw, or auction tontine)
 * within a safe Firestore transaction.
 */
export async function executePayoutDisbursement(params: {
  groupId: string;
  beneficiaryId: string;
  discountAmount?: number; // Zero for standard or draw, greater than zero for tontine auctions
  adminUserId: string;
}): Promise<{ success: boolean; message: string; transactionId?: string }> {
  const { groupId, beneficiaryId, discountAmount = 0, adminUserId } = params;
  
  const transactionId = crypto.randomUUID ? crypto.randomUUID() : `payout_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const idempotencyKey = `payout_${groupId}_cycle_${Date.now()}`;

  try {
    const result = await runTransaction(db, async (transaction) => {
      // 1. Fetch Group Details
      const groupRef = doc(db, 'groups', groupId);
      const groupSnap = await transaction.get(groupRef);
      if (!groupSnap.exists()) {
        throw new Error("Le cercle d'épargne n'existe pas.");
      }
      const group = groupSnap.data() as Group;
      if (group.status !== 'active') {
        throw new Error("Le cercle n'est pas actif.");
      }

      // 2. Fetch Beneficiary Details
      const beneficiaryRef = doc(db, 'users', beneficiaryId);
      const beneficiarySnap = await transaction.get(beneficiaryRef);
      if (!beneficiarySnap.exists()) {
        throw new Error("Le bénéficiaire n'existe pas.");
      }
      const beneficiary = beneficiarySnap.data() as UserProfile;

      // 3. Calculate Financials
      const numMembers = group.members.length;
      const totalPot = group.contributionAmount * numMembers;
      if (discountAmount < 0 || discountAmount >= totalPot) {
        throw new Error("Le montant du rabais (enchère) est invalide.");
      }

      const beneficiaryPayout = totalPot - discountAmount;

      // 4. Update Beneficiary Balance
      const currentBenefBalance = beneficiary.walletBalance !== undefined ? beneficiary.walletBalance : 0;
      const newBenefBalance = currentBenefBalance + beneficiaryPayout;
      
      transaction.update(beneficiaryRef, {
        walletBalance: newBenefBalance,
        updatedAt: new Date().toISOString()
      });

      // 5. Write Double-Entry Ledger for Beneficiary Payout
      const benefDebitId = `${transactionId}_benef_dr`;
      const benefCreditId = `${transactionId}_benef_cr`;
      const benefDebitRef = doc(db, 'doubleEntryLedger', benefDebitId);
      const benefCreditRef = doc(db, 'doubleEntryLedger', benefCreditId);

      const description = discountAmount > 0 
        ? `Encaissement Tontine Enchères - Pot ${totalPot.toLocaleString()} ${group.currency} (Rabais: -${discountAmount.toLocaleString()})`
        : `Encaissement Tontine - Payout de ${totalPot.toLocaleString()} ${group.currency}`;

      const ledgerDebitWinner: LedgerEntry = {
        id: benefDebitId,
        transactionId,
        idempotencyKey,
        account: `tontine_group:${groupId}`,
        counterparty: `user_wallet:${beneficiaryId}`,
        type: 'debit',
        amount: beneficiaryPayout,
        currency: group.currency,
        description,
        createdAt: new Date().toISOString()
      };

      const ledgerCreditWinner: LedgerEntry = {
        id: benefCreditId,
        transactionId,
        idempotencyKey,
        account: `user_wallet:${beneficiaryId}`,
        counterparty: `tontine_group:${groupId}`,
        type: 'credit',
        amount: beneficiaryPayout,
        currency: group.currency,
        description,
        createdAt: new Date().toISOString()
      };

      transaction.set(benefDebitRef, ledgerDebitWinner);
      transaction.set(benefCreditRef, ledgerCreditWinner);

      // 6. Handle Auction Discount Distribution (Restourne)
      if (discountAmount > 0) {
        const otherMembers = group.members.filter(uid => uid !== beneficiaryId);
        if (otherMembers.length > 0) {
          const discountShare = Math.floor(discountAmount / otherMembers.length);
          
          for (const memberId of otherMembers) {
            const memberRef = doc(db, 'users', memberId);
            const memberSnap = await transaction.get(memberRef);
            
            if (memberSnap.exists()) {
              const mProfile = memberSnap.data() as UserProfile;
              const currentMBalance = mProfile.walletBalance !== undefined ? mProfile.walletBalance : 0;
              const newMBalance = currentMBalance + discountShare;

              // Update wallet balance
              transaction.update(memberRef, {
                walletBalance: newMBalance,
                updatedAt: new Date().toISOString()
              });

              // Write double-entry ledger for this member's restourne
              const mDebitId = `${transactionId}_share_${memberId}_dr`;
              const mCreditId = `${transactionId}_share_${memberId}_cr`;
              const mDebitRef = doc(db, 'doubleEntryLedger', mDebitId);
              const mCreditRef = doc(db, 'doubleEntryLedger', mCreditId);

              const restourneDesc = `Bonus Enchères - Intérêts redistribués de l'enchère remportée par ${beneficiary.displayName}`;

              const mDebit: LedgerEntry = {
                id: mDebitId,
                transactionId,
                idempotencyKey,
                account: `tontine_group:${groupId}`,
                counterparty: `user_wallet:${memberId}`,
                type: 'debit',
                amount: discountShare,
                currency: group.currency,
                description: restourneDesc,
                createdAt: new Date().toISOString()
              };

              const mCredit: LedgerEntry = {
                id: mCreditId,
                transactionId,
                idempotencyKey,
                account: `user_wallet:${memberId}`,
                counterparty: `tontine_group:${groupId}`,
                type: 'credit',
                amount: discountShare,
                currency: group.currency,
                description: restourneDesc,
                createdAt: new Date().toISOString()
              };

              transaction.set(mDebitRef, mDebit);
              transaction.set(mCreditRef, mCredit);

              // Create notification for other member
              const mNotifRef = doc(collection(db, 'notifications'));
              transaction.set(mNotifRef, {
                userId: memberId,
                title: '🎉 Intérêts d\'enchère reçus !',
                message: `Vous avez reçu un bonus de ${discountShare.toLocaleString()} ${group.currency} redistribué suite à l'enchère remportée par ${beneficiary.displayName}.`,
                type: 'payout',
                read: false,
                createdAt: new Date(),
                link: `/group/${groupId}`
              });
            }
          }
        }
      }

      // 7. Update Group Cycle & Dates
      const nextPayoutIndex = (group.currentPayoutIndex + 1) % group.members.length;
      const nextPayoutDate = calculateNextPayoutDate(group.nextPayoutDate, group.frequency);
      
      // Determine if the payout order needs to be adjusted
      // If the beneficiary was not originally at currentPayoutIndex, we swap them
      let updatedPayoutOrder = [...(group.payoutOrder || group.members)];
      const currentExpectedBeneficiary = updatedPayoutOrder[group.currentPayoutIndex];
      
      if (currentExpectedBeneficiary !== beneficiaryId) {
        // Swap to maintain structural consistency
        const targetIndex = updatedPayoutOrder.indexOf(beneficiaryId);
        if (targetIndex !== -1) {
          updatedPayoutOrder[targetIndex] = currentExpectedBeneficiary;
          updatedPayoutOrder[group.currentPayoutIndex] = beneficiaryId;
        }
      }

      transaction.update(groupRef, {
        currentPayoutIndex: nextPayoutIndex,
        nextPayoutDate,
        payoutOrder: updatedPayoutOrder,
        activeAuction: null, // Clear active auction
        updatedAt: new Date().toISOString()
      });

      // 8. Create Payout History document
      const payoutHistoryRef = doc(collection(db, 'payouts'));
      transaction.set(payoutHistoryRef, {
        groupId,
        userId: beneficiaryId,
        amount: beneficiaryPayout,
        discountAmount,
        currency: group.currency,
        cycle: group.currentPayoutIndex + 1,
        date: new Date().toISOString(),
        transactionId
      });

      // 9. Create Main Notification for the Winner
      const winnerNotifRef = doc(collection(db, 'notifications'));
      transaction.set(winnerNotifRef, {
        userId: beneficiaryId,
        title: '💰 Fonds de tontine reçus !',
        message: `Félicitations ! Vous avez reçu votre payout de ${beneficiaryPayout.toLocaleString()} ${group.currency} pour le cycle ${group.currentPayoutIndex + 1}.`,
        type: 'payout',
        read: false,
        createdAt: new Date(),
        link: `/group/${groupId}`
      });

      // 10. Write Audit Log
      const auditLogId = `audit_payout_${Date.now()}`;
      const auditLogRef = doc(db, 'auditLogs', auditLogId);
      const auditLog: AuditLog = {
        id: auditLogId,
        userId: adminUserId,
        action: 'payout_disbursement',
        details: `Décaissement de tontine pour le groupe [${group.name}] : ${beneficiary.displayName} reçoit ${beneficiaryPayout.toLocaleString()} ${group.currency} (Rabais: ${discountAmount})`,
        ip: '197.221.34.8',
        device: 'Système Tontine',
        timestamp: new Date().toISOString(),
        status: 'success',
        idempotencyKey
      };
      transaction.set(auditLogRef, auditLog);

      // 11. Create Group chat/community announcement
      const groupMessageRef = doc(collection(db, 'groups', groupId, 'messages'));
      transaction.set(groupMessageRef, {
        groupId,
        userId: 'system',
        userName: 'Système Tontine',
        userPhoto: '',
        content: discountAmount > 0
          ? `🎉 Félicitations à ${beneficiary.displayName} qui remporte l'enchère et encaisse un payout net de ${beneficiaryPayout.toLocaleString()} ${group.currency} ! Un rabais de ${discountAmount.toLocaleString()} ${group.currency} a été redistribué équitablement entre les autres membres.`
          : `🎉 Félicitations à ${beneficiary.displayName} qui encaisse un payout complet de ${beneficiaryPayout.toLocaleString()} ${group.currency} pour ce cycle !`,
        createdAt: new Date()
      });

      return {
        success: true,
        message: `Décaissement de ${beneficiaryPayout.toLocaleString()} ${group.currency} exécuté avec succès.`,
        transactionId
      };
    });

    return result;
  } catch (error: any) {
    console.error("Payout disbursement error:", error);
    return { success: false, message: error.message || "Erreur lors du décaissement de la tontine." };
  }
}
