import { useState, useEffect, useCallback } from 'react';
import { supabase, createChannel } from '@/lib/supabase';
import { hydrateGroups } from '@/lib/groups';
import { Group } from '@/types';
import { loadSnapshot, saveSnapshot } from '@/lib/offlineCache';

export function useGroups(userId?: string) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async (uid: string) => {
    // Sans réseau, on montre la dernière liste connue plutôt qu'un écran vide.
    const fallBackToSnapshot = () => {
      const cached = loadSnapshot<Group[]>(uid, 'groups');
      if (cached) setGroups(cached.data);
      setLoading(false);
    };

    const { data: memberships, error: membershipError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', uid)
      .eq('status', 'active');

    if (membershipError) {
      console.error('Error fetching memberships:', membershipError);
      fallBackToSnapshot();
      return;
    }

    const groupIds = (memberships ?? []).map((m) => m.group_id);
    if (groupIds.length === 0) {
      setGroups([]);
      saveSnapshot(uid, 'groups', []);
      setLoading(false);
      return;
    }

    const { data: groupRows, error: groupsError } = await supabase.from('groups').select('*').in('id', groupIds);
    if (groupsError) {
      console.error('Error fetching groups:', groupsError);
      fallBackToSnapshot();
      return;
    }

    const hydrated = await hydrateGroups(groupRows ?? []);
    setGroups(hydrated);
    saveSnapshot(uid, 'groups', hydrated);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!userId) {
      setGroups([]);
      setLoading(false);
      return;
    }

    fetchGroups(userId);

    // Membership changes (join/leave/accept/exclude) always refetch — this
    // channel only fires for rows involving this exact user.
    const membershipChannel = createChannel(`group-members-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members', filter: `user_id=eq.${userId}` },
        () => fetchGroups(userId)
      )
      .subscribe();

    // Any group_members change for groups I'm in (other members joining/
    // leaving) also needs a refetch to keep the members/payoutOrder arrays
    // accurate — Realtime can't filter by "group_id in my list", so this
    // channel is broad and we just accept the occasional extra refetch.
    const otherMembersChannel = createChannel(`group-members-any-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => fetchGroups(userId))
      .subscribe();

    const groupsChannel = createChannel(`groups-for-${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'groups' }, () => fetchGroups(userId))
      .subscribe();

    return () => {
      supabase.removeChannel(membershipChannel);
      supabase.removeChannel(otherMembersChannel);
      supabase.removeChannel(groupsChannel);
    };
  }, [userId, fetchGroups]);

  return { groups, loading };
}
