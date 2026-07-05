import React, { useEffect, useState } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { Group, UserProfile } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface JoinGroupProps {
  joinCode: string;
  user: UserProfile;
  onJoined: (groupId: string) => void;
  onCancel: () => void;
}

export function JoinGroup({ joinCode, user, onJoined, onCancel }: JoinGroupProps) {
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const q = query(collection(db, 'groups'), where('joinCode', '==', joinCode));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          toast.error("Code d'invitation invalide.");
          onCancel();
          return;
        }

        const groupDoc = snapshot.docs[0];
        setGroup({ id: groupDoc.id, ...groupDoc.data() } as Group);
      } catch (error) {
        console.error("Error fetching group for join:", error);
        toast.error("Erreur lors de la récupération du groupe.");
      } finally {
        setLoading(false);
      }
    };

    fetchGroup();
  }, [joinCode, onCancel]);

  const handleJoin = async () => {
    if (!group || !user) return;
    
    if (group.members.includes(user.uid)) {
      toast.info("Vous êtes déjà membre de ce groupe.");
      onJoined(group.id);
      return;
    }

    setJoining(true);
    try {
      const groupRef = doc(db, 'groups', group.id);
      await updateDoc(groupRef, {
        members: arrayUnion(user.uid),
        payoutOrder: arrayUnion(user.uid) // Add to payout order by default
      });

      // Update user stats
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        groupsJoined: (user.groupsJoined || 0) + 1
      });

      toast.success(`Bienvenue dans le cercle "${group.name}" !`);
      onJoined(group.id);
    } catch (error) {
      console.error("Error joining group:", error);
      toast.error("Erreur lors de l'adhésion au groupe.");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Recherche du cercle...</p>
      </div>
    );
  }

  if (!group) return null;

  return (
    <div className="max-w-md mx-auto py-8 animate-in fade-in duration-300">
      <Card className="border border-[#D4A574]/30 shadow-xl rounded-3xl bg-white overflow-hidden">
        <CardHeader className="text-center pb-4 bg-[#F5E6D3]/15">
          <div className="mx-auto bg-[#2BB673]/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-[#2BB673]" />
          </div>
          <CardTitle className="text-2xl font-serif font-bold text-[#4B2E05]">Rejoindre un cercle</CardTitle>
          <CardDescription className="text-xs text-slate-500 mt-1">
            Vous avez été invité à rejoindre une tontine digitale.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="bg-[#FBF8F3] p-5 rounded-2xl border border-[#D4A574]/20 text-center">
            <h3 className="font-serif font-extrabold text-lg text-[#4B2E05]">{group.name}</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{group.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 bg-[#FBF8F3]/50 p-3 rounded-xl border border-[#D4A574]/10">
              <p className="text-[10px] uppercase text-slate-400 font-bold">Cotisation</p>
              <p className="font-serif font-bold text-base text-[#4B2E05]">{group.contributionAmount.toLocaleString()} {group.currency}</p>
            </div>
            <div className="space-y-1 bg-[#FBF8F3]/50 p-3 rounded-xl border border-[#D4A574]/10">
              <p className="text-[10px] uppercase text-slate-400 font-bold">Fréquence</p>
              <p className="font-serif font-bold text-base text-[#E67E22] capitalize">{group.frequency}</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
              <CheckCircle2 className="w-4.5 h-4.5 text-[#2BB673]" />
              <span>Paiements sécurisés automatisés via Paydunya</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
              <ShieldCheck className="w-4.5 h-4.5 text-[#E67E22]" />
              <span>Votre assiduité renforce votre Score de Réputation</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 pt-0 pb-6 px-6">
          <Button className="w-full h-12 text-sm font-bold bg-[#2BB673] hover:bg-[#2BB673]/90 text-white rounded-2xl shadow-sm transition-all cursor-pointer" onClick={handleJoin} disabled={joining}>
            {joining ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Confirmer l'adhésion"}
          </Button>
          <Button variant="ghost" className="w-full text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer" onClick={onCancel} disabled={joining}>
            Annuler
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
