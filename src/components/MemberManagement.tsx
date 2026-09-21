import React from 'react';
import { supabase } from '@/lib/supabase';
import { mapProfileRow, PROFILE_COLUMNS } from '@/lib/mappers';
import { Group, UserProfile, GroupMemberRole } from '@/types';
import { notifyUser } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Check, X, UserMinus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmationBottomSheet } from './ui/ConfirmationBottomSheet';
import { MemberCard } from './ui/MemberCard';
import { StatusBadge } from './ui/StatusBadge';
import { useLanguage } from '@/contexts/LanguageContext';

interface MemberManagementProps {
  group: Group;
  currentUserId: string;
}

export function MemberManagement({ group, currentUserId }: MemberManagementProps) {
  const { t } = useLanguage();
  const roleLabels: Record<GroupMemberRole, string> = {
    member: t('member'),
    treasurer: t('mm_role_treasurer'),
    secretary: t('mm_role_secretary')
  };
  const [profiles, setProfiles] = React.useState<Record<string, UserProfile>>({});
  const [busyUid, setBusyUid] = React.useState<string | null>(null);
  const [excludeTarget, setExcludeTarget] = React.useState<string | null>(null);

  const pendingMembers = group.pendingMembers || [];
  const allUids = React.useMemo(
    () => Array.from(new Set([...group.members, ...pendingMembers])),
    [group.members, pendingMembers]
  );

  React.useEffect(() => {
    const fetchProfiles = async () => {
      if (allUids.length === 0) return;
      const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).in('id', allUids);
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

      await notify(uid, `${t('mm_membership_approved_title')} ${group.name}`, `${t('mm_join_request_body_open')}${group.name}${t('mm_join_accepted_body_close')}`);
      toast.success(`${profile?.displayName || t('mm_member_accepted_fallback')} ${t('mm_member_accepted_suffix')}`);
    } catch (error) {
      console.error('Error accepting member:', error);
      toast.error(t('mm_accept_error'));
    } finally {
      setBusyUid(null);
    }
  };

  const handleReject = async (uid: string) => {
    setBusyUid(uid);
    try {
      const { error } = await supabase.from('group_members').delete().eq('group_id', group.id).eq('user_id', uid);
      if (error) throw error;
      await notify(uid, `${t('mm_membership_rejected_title')} ${group.name}`, `${t('mm_join_request_body_open')}${group.name}${t('mm_join_rejected_body_close')}`);
      toast.success(t('mm_request_rejected_toast'));
    } catch (error) {
      console.error('Error rejecting member:', error);
      toast.error(t('mm_reject_error'));
    } finally {
      setBusyUid(null);
    }
  };

  const handleExcludeRequest = (uid: string) => {
    if (uid === group.creatorId) {
      toast.error(t('mm_creator_cannot_be_excluded'));
      return;
    }
    setExcludeTarget(uid);
  };

  const handleExcludeConfirm = async () => {
    const uid = excludeTarget;
    if (!uid) return;
    setBusyUid(uid);
    try {
      const { error } = await supabase.from('group_members').delete().eq('group_id', group.id).eq('user_id', uid);
      if (error) throw error;
      await notify(uid, `${t('mm_exclusion_title')} ${group.name}`, `${t('mm_exclusion_body_open')}${group.name}${t('mm_exclusion_body_close')}`);
      toast.success(t('mm_member_excluded_toast'));
    } catch (error) {
      console.error('Error excluding member:', error);
      toast.error(t('mm_exclude_error'));
    } finally {
      setBusyUid(null);
      setExcludeTarget(null);
    }
  };

  const handleRoleChange = async (uid: string, role: GroupMemberRole) => {
    setBusyUid(uid);
    try {
      const { error } = await supabase.from('group_members').update({ role }).eq('group_id', group.id).eq('user_id', uid);
      if (error) throw error;
      toast.success(`${t('mm_role_updated_prefix')} ${roleLabels[role]}.`);
    } catch (error) {
      console.error('Error updating member role:', error);
      toast.error(t('mm_role_change_error'));
    } finally {
      setBusyUid(null);
    }
  };

  if (group.members.length === 0 && pendingMembers.length === 0) return null;

  return (
    <div className="glass-card rounded-3xl shadow-soft border border-border/70 p-4 sm:p-5 space-y-5">
      <div>
        <h2 className="text-base font-serif font-black text-foreground flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          {t('mm_management_title')}
        </h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">{t('mm_management_desc')}</p>
      </div>

      {pendingMembers.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase text-muted-foreground">{t('mm_pending_requests_label')} ({pendingMembers.length})</p>
          {pendingMembers.map((uid) => (
            <MemberCard
              key={uid}
              tone="pending"
              avatarUrl={profiles[uid]?.photoURL}
              name={profiles[uid]?.displayName || `${t('member')} ${uid.slice(0, 6)}`}
              trailing={
                <>
                  <Button size="icon" variant="outline" className="h-10 w-10 rounded-xl text-secondary border-secondary/20 hover:bg-success-soft cursor-pointer" disabled={busyUid === uid} onClick={() => handleAccept(uid)} title={t('mm_accept_title')}>
                    {busyUid === uid ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="outline" className="h-10 w-10 rounded-xl text-danger border-danger/20 hover:bg-danger-soft cursor-pointer" disabled={busyUid === uid} onClick={() => handleReject(uid)} title={t('mm_reject_title')}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              }
            />
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase text-muted-foreground">{t('mm_current_members_label')} ({group.members.length})</p>
        {group.members.map((uid) => {
          const isCreatorRow = uid === group.creatorId;
          const role: GroupMemberRole = group.memberRoles?.[uid] || 'member';
          return (
            <MemberCard
              key={uid}
              avatarUrl={profiles[uid]?.photoURL}
              name={profiles[uid]?.displayName || `${t('member')} ${uid.slice(0, 6)}`}
              subtitle={isCreatorRow ? <StatusBadge tone="info" label={t('mm_creator_badge')} /> : undefined}
              trailing={
                <>
                  <Select value={role} onValueChange={(val) => handleRoleChange(uid, val as GroupMemberRole)} disabled={busyUid === uid}>
                    <SelectTrigger className="h-8 w-[130px] text-xs rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">{t('member')}</SelectItem>
                      <SelectItem value="treasurer">{t('mm_role_treasurer')}</SelectItem>
                      <SelectItem value="secretary">{t('mm_role_secretary')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {!isCreatorRow && (
                    <Button size="icon" variant="outline" className="h-10 w-10 rounded-xl text-danger border-danger/20 hover:bg-danger-soft cursor-pointer" disabled={busyUid === uid} onClick={() => handleExcludeRequest(uid)} title={t('mm_exclude_title')}>
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  )}
                </>
              }
            />
          );
        })}
      </div>

      <ConfirmationBottomSheet
        isOpen={!!excludeTarget}
        onClose={() => setExcludeTarget(null)}
        onConfirm={handleExcludeConfirm}
        title={`${t('mm_exclude_title')} ${excludeTarget ? (profiles[excludeTarget]?.displayName || t('mm_default_member_fallback')) : ''} ?`}
        description={`${t('mm_exclude_confirm_desc_main')} ${t('gd_action_irreversible')}`}
        type="destructive"
        confirmLabel={t('mm_confirm_exclude_label')}
        isLoading={!!excludeTarget && busyUid === excludeTarget}
      />
    </div>
  );
}
