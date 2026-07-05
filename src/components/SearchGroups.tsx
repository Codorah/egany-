import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Group, UserProfile } from '@/types';
import { requestToJoinGroup } from '@/lib/groups';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, Users, Loader2, Send } from 'lucide-react';
import { EmptyState } from './ui/EmptyState';
import { toast } from 'sonner';

interface SearchGroupsProps {
  user: UserProfile;
  onBack: () => void;
}

export function SearchGroups({ user, onBack }: SearchGroupsProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState('');
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchPublicGroups = async () => {
      try {
        const q = query(collection(db, 'groups'), where('isPrivate', '==', false));
        const snapshot = await getDocs(q);
        const publicGroups = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as Group))
          .filter((g) => g.status === 'active' && !g.members.includes(user.uid));
        setGroups(publicGroups);
      } catch (error) {
        console.error('Error searching public groups:', error);
        toast.error('Erreur lors de la recherche de cercles.');
      } finally {
        setLoading(false);
      }
    };
    fetchPublicGroups();
  }, [user.uid]);

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(term.toLowerCase()) ||
    g.description.toLowerCase().includes(term.toLowerCase())
  );

  const handleRequest = async (group: Group) => {
    setRequestingId(group.id);
    try {
      const result = await requestToJoinGroup(group, user);
      if (result.success || result.alreadyPending) {
        setRequestedIds((prev) => [...prev, group.id]);
      }
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.info(result.message);
      }
    } catch (error) {
      console.error('Error requesting to join:', error);
      toast.error("Erreur lors de la demande d'adhésion.");
    } finally {
      setRequestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rechercher un cercle public</h1>
          <p className="text-muted-foreground text-sm">Trouvez une tontine ouverte à rejoindre parmi les cercles publics.</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom ou description..."
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aucun cercle public trouvé"
          description="Il n'y a aucun cercle public correspondant à votre recherche pour le moment."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((group) => {
            const isPending = group.pendingMembers?.includes(user.uid) || requestedIds.includes(group.id);
            return (
              <Card key={group.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base">{group.name}</CardTitle>
                    <Badge variant="outline" className="text-[10px]">{group.frequency}</Badge>
                  </div>
                  <CardDescription className="line-clamp-2 text-xs">{group.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Cotisation</span>
                    <span>{group.contributionAmount.toLocaleString()} {group.currency}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Participants</span>
                    <span>{group.members.length}{group.maxMembers ? ` / ${group.maxMembers}` : ''}</span>
                  </div>
                  <Button
                    className="w-full"
                    disabled={isPending || requestingId === group.id}
                    onClick={() => handleRequest(group)}
                  >
                    {requestingId === group.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    {isPending ? 'Demande envoyée' : 'Demander à rejoindre'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
