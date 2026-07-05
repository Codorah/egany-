import { useEffect } from 'react';
import { db } from '@/lib/firebase';
import { updateDoc, doc } from 'firebase/firestore';
import { Group, UserProfile } from '@/types';
import { notifyUser } from '@/lib/notify';
import { differenceInDays, parseISO } from 'date-fns';

export function useReminders(profile: UserProfile | null, groups: Group[]) {
  useEffect(() => {
    if (!profile || groups.length === 0) return;

    const checkAndTriggerReminders = async () => {
      const today = new Date();

      for (const group of groups) {
        // Only check groups where the user is a member (already handled by the groups fetch)
        // and which are active
        if (group.status !== 'active') continue;

        const nextPayoutDate = parseISO(group.nextPayoutDate);
        const daysUntilPayout = differenceInDays(nextPayoutDate, today);

        // Standard reminder: 3 days before the payout date
        // and check if a reminder hasn't been sent for the current period
        const currentPeriodKey = group.nextPayoutDate.split('T')[0];
        
        if (daysUntilPayout <= 3 && daysUntilPayout >= 0 && group.lastReminderSentAt !== currentPeriodKey) {
          try {
            // Update group first to prevent double triggers
            const groupRef = doc(db, 'groups', group.id);
            await updateDoc(groupRef, {
              lastReminderSentAt: currentPeriodKey
            });

            // Create notifications for all members
            const notificationsBatch = group.members.map(memberId => {
              return notifyUser({
                userId: memberId,
                title: `Rappel: Cotisation pour ${group.name}`,
                message: `La date de payout est dans ${daysUntilPayout} jours. N'oubliez pas votre cotisation de ${group.contributionAmount} ${group.currency}.`,
                type: 'reminder',
                link: `/group/${group.id}` // This is a virtual link, we handle routing in App.tsx
              });
            });

            await Promise.all(notificationsBatch);
            console.log(`Sent reminders for group ${group.name}`);
          } catch (error) {
            console.error(`Error triggering reminders for group ${group.id}:`, error);
          }
        }
      }
    };

    checkAndTriggerReminders();
  }, [profile, groups]);
}
