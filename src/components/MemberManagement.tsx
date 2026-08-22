import React from 'react';
import { supabase } from '@/lib/supabase';
import { mapProfileRow } from '@/lib/mappers';
import { Group, UserProfile, GroupMemberRole } from '@/types';
import { notifyUser } from '@/lib/notify';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Check, X, UserMinus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CustomAvatar } from './CustomAvatar';

interface MemberManagementProps {
  group: Group;
  currentUserId: string;
}

const roleLabels: Record<GroupMemberRole, string> = {
  member: 'Membre',
  treasurer: 'Trésorier',
  secretary: 'Secrétaire'
};

export function MemberManagement({ group, currentUserId }: MemberManagementProps) {
  const [profiles, setProfiles] = React.useState<Record<string, UserProfile>>({});
  const [busyUid, setBusyUid] = React.useState<string | null>(null);

  const pendingMembers = group.pendingMembers || [];
  const allUids = React.useMemo(
    () => Array.from(new Set([...group.members, ...pendingMembers])),
    [group.members, pendingMembers]
  );

  React.useEffect(() => {
    const fetchProfiles = async () => {
      if (allUids.length === 0) return;
      const { data, error } = await supabase.from('profiles').select('*').in('id', allUids);
      if (error) {
        console.error('Error fetching member profiles:', error);
        return;
      }
      const entries: Record<string, UserProfile> = {};
      for (const row of data ?? []) entries[row.id] = mapProfileRow(row);
      setProfiles(entries);
    };
    fetchProfiles();
  }, [allUids]);

  const notify = (userId: string, title: string, message: string) =>
    notifyUser({ userId, title, message, type: 'system', link: `/group/${group.id}` });

  const handleAccept = async (uid: string) => {
    setBusyUid(uid);
    try {
      const { error } = await supabase.rpc('assign_next_payout_position', {
        p_group_id: group.id,
        p_user_id: uid,
      });
      if (error) throw error;

      const profile = profiles[uid];
      await supabase.from('profiles').update({ groups_joined: (profile?.groupsJoined || 0) + 1 }).eq('id', uid);

      await notify(uid, `Adhésion approuvée - ${group.name}`, `Votre demande pour rejoindre "${group.name}" a été acceptée. Bienvenue !`);
      toast.success(`${profile?.displayName || 'Le membre'} a été accepté dans le cercle.`);
    } catch (error) {
      console.error('Error accepting member:', error);
      toast.error("Erreur lors de l'acceptation.");
    } finally {
      setBusyUid(null);
    }
  };

  const handleReject = async (uid: string) => {
    setBusyUid(uid);
    try {
      const { error } = await supabase.from('group_members').delete().eq('group_id', group.id).eq('user_id', uid);
      if (error) throw error;
      await notify(uid, `Adhésion refusée - ${group.name}`, `Votre demande pour rejoindre "${group.name}" a été refusée par l'administrateur.`);
      toast.success('Demande refusée.');
    } catch (error) {
      console.error('Error rejecting member:', error);
      toast.error('Erreur lors du refus.');
    } finally {
      setBusyUid(null);
    }
  };

  const handleExclude = async (uid: string) => {
    if (uid === group.creatorId) {
      toast.error("Le créateur du cercle ne peut pas être exclu.");
      return;
    }
    if (!confirm(`Exclure ${profiles[uid]?.displayName || 'ce membre'} du cercle ? Cette action est irréversible.`)) return;

    setBusyUid(uid);
    try {
      const { error } = await supabase.from('group_members').delete().eq('group_id', group.id).eq('user_id', uid);
      if (error) throw error;
      await notify(uid, `Exclusion - ${group.name}`, `Vous avez été exclu du cercle "${group.name}" par l'administrateur.`);
      toast.success('Membre exclu du cercle.');
    } catch (error) {
      console.error('Error excluding member:', error);
      toast.error("Erreur lors de l'exclusion.");
    } finally {
      setBusyUid(null);
    }
  };

  const handleRoleChange = async (uid: string, role: GroupMemberRole) => {
    setBusyUid(uid);
    try {
      const { error } = await supabase.from('group_members').update({ role }).eq('group_id', group.id).eq('user_id', uid);
      if (error) throw error;
      toast.success(`Rôle mis à jour : ${roleLabels[role]}.`);
    } catch (error) {
      console.error('Error updating member role:', error);
      toast.error('Erreur lors du changement de rôle.');
    } finally {
      setBusyUid(null);
    }
  };

  if (group.members.length === 0 && pendingMembers.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="w-4 h-4" />
          Gestion des membres
        </CardTitle>
        <CardDescription>Validez les demandes d'adhésion et gérez les rôles des membres du cercle.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {pendingMembers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase text-muted-foreground">Demandes en attente ({pendingMembers.length})</p>
            {pendingMembers.map((uid) => (
              <div key={uid} className="flex items-center justify-between p-2.5 border rounded-lg bg-brand/10 border-brand/20">
                <div className="flex items-center gap-2">
                  <CustomAvatar photoURL={profiles[uid]?.photoURL} name={profiles[uid]?.displayName || 'Membre'} size={28} />
                  <span className="text-sm font-medium">{profiles[uid]?.displayName || `Membre ${uid.slice(0, 6)}`}</span>
                </div>
                <div className="flex gap-1.5">
                  <Button size="icon" variant="outline" className="h-8 w-8 text-secondary border-secondary/20 hover:bg-success-soft" disabled={busyUid === uid} onClick={() => handleAccept(uid)} title="Accepter">
                    {busyUid === uid ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="outline" className="h-8 w-8 text-danger border-danger/20 hover:bg-danger-soft" disabled={busyUid === uid} onClick={() => handleReject(uid)} title="Refuser">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase text-muted-foreground">Membres actuels ({group.members.length})</p>
          {group.members.map((uid) => {
            const isCreatorRow = uid === group.creatorId;
            const role: GroupMemberRole = group.memberRoles?.[uid] || 'member';
            return (
              <div key={uid} className="flex items-center justify-between p-2.5 border rounded-lg">
                <div className="flex items-center gap-2">
                  <CustomAvatar photoURL={profiles[uid]?.photoURL} name={profiles[uid]?.displayName || 'Membre'} size={28} />
                  <span className="text-sm font-medium">{profiles[uid]?.displayName || `Membre ${uid.slice(0, 6)}`}</span>
                  {isCreatorRow && <Badge variant="outline" className="text-[10px]">Créateur</Badge>}
                </div>
                <div className="flex items-center gap-1.5">
                  <Select value={role} onValueChange={(val) => handleRoleChange(uid, val as GroupMemberRole)} disabled={busyUid === uid}>
                    <SelectTrigger className="h-8 w-[130px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Membre</SelectItem>
                      <SelectItem value="treasurer">Trésorier</SelectItem>
                      <SelectItem value="secretary">Secrétaire</SelectItem>
                    </SelectContent>
                  </Select>
                  {!isCreatorRow && (
                    <Button size="icon" variant="outline" className="h-8 w-8 text-danger border-danger/20 hover:bg-danger-soft" disabled={busyUid === uid} onClick={() => handleExclude(uid)} title="Exclure">
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
