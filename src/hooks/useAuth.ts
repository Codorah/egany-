import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, createChannel } from '@/lib/supabase';
import { mapProfileRow, PROFILE_COLUMNS } from '@/lib/mappers';
import { UserProfile } from '@/types';
import { clearSnapshots, loadSnapshot, saveSnapshot } from '@/lib/offlineCache';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileChannel: ReturnType<typeof supabase.channel> | null = null;

    const fetchProfile = async (uid: string) => {
      const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', uid).single();
      if (error) {
        console.error('Profile fetch error:', error);
        return null;
      }
      const mapped = mapProfileRow(data);
      saveSnapshot(uid, 'profile', mapped);
      return mapped;
    };

    const loadProfile = async (uid: string) => {
      const fresh = await fetchProfile(uid);
      if (fresh) {
        setProfile(fresh);
      } else {
        // Sans réseau : dernière copie connue, signalée par le bandeau
        // « Données du … » (voir App.tsx).
        const cached = loadSnapshot<UserProfile>(uid, 'profile');
        if (cached) setProfile(cached.data);
      }
      setLoading(false);

      // Real-time updates (equivalent of the previous Firestore onSnapshot),
      // so wallet balance / reputation / role changes reflect live.
      //
      // On ne construit PAS le profil depuis payload.new : depuis la migration
      // 0011, `profiles` n'est plus lisible en bloc (privilèges accordés
      // colonne par colonne), et la charge utile temps réel peut arriver
      // incomplète. Une colonne absente devient `Number(undefined)` = NaN —
      // et comme tous les affichages écrivent `(walletBalance || 0)`, NaN
      // étant falsy, l'écran annonçait un solde de 0 alors que la base
      // contenait le bon montant. On relit donc la ligne par le même chemin
      // autoritaire que le chargement initial.
      profileChannel = createChannel(`profile-${uid}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
          async () => {
            const fresh = await fetchProfile(uid);
            if (fresh) setProfile(fresh);
          }
        )
        .subscribe();
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'SIGNED_OUT') clearSnapshots();

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
