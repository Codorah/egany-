import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, createChannel } from '@/lib/supabase';
import { mapProfileRow } from '@/lib/mappers';
import { UserProfile } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileChannel: ReturnType<typeof supabase.channel> | null = null;

    const loadProfile = async (uid: string) => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
      if (error) {
        console.error('Profile fetch error:', error);
        setLoading(false);
        return;
      }
      setProfile(mapProfileRow(data));
      setLoading(false);

      // Real-time updates (equivalent of the previous Firestore onSnapshot),
      // so wallet balance / reputation / role changes reflect live.
      profileChannel = createChannel(`profile-${uid}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
          (payload) => setProfile(mapProfileRow(payload.new))
        )
        .subscribe();
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (profileChannel) {
        supabase.removeChannel(profileChannel);
        profileChannel = null;
      }

      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
      if (profileChannel) supabase.removeChannel(profileChannel);
    };
  }, []);

  return { user, profile, loading };
}
