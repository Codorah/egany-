import React from 'react';
import { Check, ChevronRight, Loader2, UserMinus, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { fetchMemberProfiles } from '@/lib/members';
import { Group, UserProfile, GroupMemberRole } from '@/types';
import { notifyUser } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmationBottomSheet } from './ui/ConfirmationBottomSheet';
import { MemberCard } from './ui/MemberCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';

interface MemberManagementProps {
  group: Group;
  currentUserId: string;
  /** Organisateur ou admin : demandes, rôles et exclusion. Sinon, la liste seule. */
  canManage: boolean;
}

const ROLES: GroupMemberRole[] = ['member', 'treasurer', 'secretary'];

export function MemberManagement({ group, currentUserId, canManage }: MemberManagementProps) {
  const { t } = useLanguage();
  const roleLabels: Record<GroupMemberRole, string> = {
    member: t('member'),
    treasurer: t('mm_role_treasurer'),
    secretary: t('mm_role_secretary'),
  };
  const [profiles, setProfiles] = React.useState<Record<string, UserProfile>>({});
  const [busyUid, setBusyUid] = React.useState<string | null>(null);
  const [excludeTarget, setExcludeTarget] = React.useState<string | null>(null);
  const [selectedUid, setSelectedUid] = React.useState<string | null>(null);

  useBackHandler(
    React.useCallback(() => {
      setSelectedUid(null);
      return true;
    }, []),
    selectedUid !== null
  );

  const pendingMembers = canManage ? group.pendingMembers || [] : [];
  const allUids = React.useMemo(
    () => Array.from(new Set([...group.members, ...(group.pendingMembers || [])])),
    [group.members, group.pendingMembers]
  );

  React.useEffect(() => {
    const fetchProfiles = async () => {
      if (allUids.length === 0) return;
      const list = await fetchMemberProfiles(allUids);
      const entries: Record<string, UserProfile> = {};
      for (const member of list) entries[member.uid] = member;
      setProfiles(entries);
    };
    fetchProfiles();
  }, [allUids]);

  const nameOf = (uid: string) => profiles[uid]?.displayName || `${t('member')} ${uid.slice(0, 6)}`;

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

  const handleExcludeConfirm = async () => {
    const uid = excludeTarget;
    if (!uid) return;
    setBusyUid(uid);
    try {
      const { error } = await supabase.from('group_members').delete().eq('group_id', group.id).eq('user_id', uid);
      if (error) throw error;
      await notify(uid, `${t('mm_exclusion_title')} ${group.name}`, `${t('mm_exclusion_body_open')}${group.name}${t('mm_exclusion_body_close')}`);
      toast.success(t('mm_member_excluded_toast'));
    } catch (error: any) {
      console.error('Error excluding member:', error);
      // Cercle commencé : la base refuse et explique pourquoi (migration 0038).
      toast.error(error?.message || t('mm_exclude_error'));
    } finally {
      setBusyUid(null);
      setExcludeTarget(null);
    }
  };

  const handleRoleChange = async (uid: string, role: GroupMemberRole) => {
    if (uid === group.creatorId) return;
    setBusyUid(uid);
    try {
      const { error } = await supabase.from('group_members').update({ role }).eq('group_id', group.id).eq('user_id', uid);
      if (error) throw error;
      toast.success(`${t('mm_role_updated_prefix')} ${roleLabels[role]}.`);
      setSelectedUid(null);
    } catch (error) {
      console.error('Error updating member role:', error);
      toast.error(t('mm_role_change_error'));
    } finally {
      setBusyUid(null);
    }
  };

  if (group.members.length === 0 && pendingMembers.length === 0) return null;

  const sortedMembers = [...group.members].sort(
    (a, b) => (profiles[b]?.reputationScore || 0) - (profiles[a]?.reputationScore || 0)
  );
  const selectedRole: GroupMemberRole = (selectedUid && group.memberRoles?.[selectedUid]) || 'member';

  return (
    <div className="space-y-5">
      {pendingMembers.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-bold text-foreground">
            {t('mm_pending_requests_label')} ({pendingMembers.length})
          </h2>
          <div className="divide-y divide-border rounded-2xl border border-border bg-card">
            {pendingMembers.map((uid) => (
              <MemberCard
                key={uid}
                avatarUrl={profiles[uid]?.photoURL}
                name={nameOf(uid)}
                trailing={
                  <>
                    <button
                      type="button"
                      disabled={busyUid === uid}
                      onClick={() => handleReject(uid)}
                      aria-label={t('mm_reject_title')}
                      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted disabled:opacity-50"
                    >
                      <X className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      disabled={busyUid === uid}
                      onClick={() => handleAccept(uid)}
                      aria-label={t('mm_accept_title')}
                      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity duration-150 disabled:opacity-50"
                    >
                      {busyUid === uid ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                    </button>
                  </>
                }
              />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-bold text-foreground">
          {t('mm_current_members_label')} ({group.members.length})
        </h2>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {sortedMembers.map((uid) => {
            const isCreatorRow = uid === group.creatorId;
            const role: GroupMemberRole = group.memberRoles?.[uid] || 'member';
            const details = [
              isCreatorRow ? t('mm_creator_badge') : role !== 'member' ? roleLabels[role] : null,
              uid === currentUserId ? t('gd_you_badge') : null,
              `${t('score_label')} ${profiles[uid]?.reputationScore ?? '-'}/100`,
            ].filter(Boolean).join(' · ');
            const row = (
              <MemberCard
                avatarUrl={profiles[uid]?.photoURL}
                name={nameOf(uid)}
                subtitle={details}
                trailing={canManage && !isCreatorRow ? <ChevronRight className="h-5 w-5 text-muted-foreground" /> : undefined}
              />
            );
            if (!canManage || isCreatorRow) return <div key={uid}>{row}</div>;
            return (
              <button
                key={uid}
                type="button"
                onClick={() => setSelectedUid(uid)}
                className="block w-full cursor-pointer text-left transition-colors duration-150 first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/50 active:bg-muted"
              >
                {row}
              </button>
            );
          })}
        </div>
      </section>

      <Dialog open={selectedUid !== null} onOpenChange={(open) => { if (!open) setSelectedUid(null); }}>
        <DialogContent className="gap-3">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{selectedUid ? nameOf(selectedUid) : ''}</DialogTitle>
            <DialogDescription>{t('cir_role_title')}</DialogDescription>
          </DialogHeader>
          <div className="divide-y divide-border rounded-2xl border border-border">
            {ROLES.map((role) => (
              <button
                key={role}
                type="button"
                disabled={!selectedUid || busyUid === selectedUid}
                onClick={() => selectedUid && handleRoleChange(selectedUid, role)}
                aria-pressed={selectedRole === role}
                className="flex min-h-12 w-full cursor-pointer items-center justify-between px-4 text-left text-sm font-bold text-foreground transition-colors duration-150 first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/50 disabled:opacity-50"
              >
                {roleLabels[role]}
                {selectedRole === role && <Check className="h-5 w-5 text-primary-ink" />}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              const uid = selectedUid;
              setSelectedUid(null);
              if (uid) setExcludeTarget(uid);
            }}
            className="h-12 w-full cursor-pointer gap-2 rounded-xl font-bold text-danger hover:bg-danger-soft hover:text-danger"
          >
            <UserMinus className="h-5 w-5" />
            {t('mm_exclude_title')}
          </Button>
        </DialogContent>
      </Dialog>

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
