import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { UserProfile } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        // Listen in real-time
        unsubscribeProfile = onSnapshot(userRef, async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setProfile({
              ...data,
              walletBalance: data.walletBalance !== undefined ? data.walletBalance : 0
            } as UserProfile);
            setLoading(false);
          } else {
            // Create initial profile if it doesn't exist
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'Utilisateur',
              photoURL: firebaseUser.photoURL || undefined,
              reputationScore: 75, // Starting reputation can be 75 for fresh users
              totalSaved: 0,
              groupsJoined: 0,
              createdAt: new Date().toISOString(),
              role: firebaseUser.email === 'diditanael@gmail.com' ? 'admin' : 'user',
              walletBalance: 0,
            };
            await setDoc(userRef, newProfile);
            setProfile(newProfile);
            setLoading(false);
          }
        }, (error) => {
          console.error("Profile onSnapshot error:", error);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        (unsubscribeProfile as any)();
      }
    };
  }, []);

  return { user, profile, loading };
}
