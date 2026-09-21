import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Group, UserProfile } from '@/types';
import { notifyUser } from '@/lib/notify';
import { differenceInDays, parseISO } from 'date-fns';

export function useReminders(profile: UserProfile | null, groups: Group[]) {
  useEffect(() => {
    if (!profile || groups.length === 0) return;

    const checkAndTriggerReminders = async () => {
      const today = new Date();

      for (const group of groups) {
        if (group.status !== 'active') continue;

        const nextPayoutDate = parseISO(group.nextPayoutDate);
        const daysUntilPayout = differenceInDays(nextPayoutDate, today);

        const currentPeriodKey = group.nextPayoutDate.split('T')[0];

        if (daysUntilPayout <= 3 && daysUntilPayout >= 0 && group.lastReminderSentAt !== currentPeriodKey) {
          try {
            // Réservation de la période côté serveur : un membre n'a plus le
            // droit d'écrire dans la fiche du cercle (0012), et cet appel est
            // atomique — si deux téléphones se réveillent en même temps, un
            // seul obtient la période et un seul rappel part.
            const { data: claimed, error } = await supabase.rpc('claim_reminder_period', {
              p_group_id: group.id,
              p_period: currentPeriodKey,
            });
            if (error) throw error;
            if (!claimed) continue;

            const notificationsBatch = group.members.map(memberId =>
              notifyUser({
                userId: memberId,
                title: `Rappel: Cotisation pour ${group.name}`,
                message: `La date de payout est dans ${daysUntilPayout} jours. N'oubliez pas votre cotisation de ${group.contributionAmount} ${group.currency}.`,
                type: 'reminder',
                link: `/group/${group.id}`
              })
            );

            await Promise.all(notificationsBatch);
          } catch (error) {
            console.error(`Error triggering reminders for group ${group.id}:`, error);
          }
        }
      }
    };

    checkAndTriggerReminders();
  }, [profile, groups]);
}
