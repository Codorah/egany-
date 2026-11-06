import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Group, UserProfile } from '@/types';
import { requestToJoinGroup, hydrateGroups } from '@/lib/groups';
import { Button } from '@/components/ui/button';
import { ScreenBar } from './ui/ScreenBar';
import { useLanguage } from '@/contexts/LanguageContext';

interface JoinGroupProps {
  joinCode: string;
  user: UserProfile;
  onJoined: (groupId: string) => void;
  onCancel: () => void;
}

export function JoinGroup({ joinCode, user, onJoined, onCancel }: JoinGroupProps) {
  const { t } = useLanguage();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        // Un cercle privé n'est plus lisible par tous (migration 0021) : le
        // code d'invitation est le secret, vérifié côté serveur.
        const { data: groupRows, error } = await supabase.rpc('find_group_by_join_code', { p_code: joinCode });
        if (error) throw error;

        if (!groupRows || groupRows.length === 0) {
          toast.error(t('jg_invalid_invite_code'));
          onCancel();
          return;
        }

        const [groupData] = await hydrateGroups(groupRows);
        setGroup(groupData);
        if (groupData.pendingMembers?.includes(user.uid)) {
          setRequestSent(true);
        }
      } catch (error) {
        console.error("Error fetching group for join:", error);
        toast.error(t('jg_fetch_group_error'));
      } finally {
        setLoading(false);
      }
    };

    fetchGroup();
  }, [joinCode, onCancel, user.uid]);

  const handleJoin = async () => {
    if (!group || !user) return;

    if (group.members.includes(user.uid)) {
      toast.info(t('jg_already_member'));
      onJoined(group.id);
      return;
    }

    setJoining(true);
    try {
      const result = await requestToJoinGroup(group, user);
      if (result.alreadyPending) {
        setRequestSent(true);
        return;
      }
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      setRequestSent(true);
      toast.success(result.message);
    } catch (error) {
      console.error("Error requesting to join group:", error);
      toast.error(t('jg_join_request_error'));
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-3 py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('jg_searching_circle')}</p>
      </div>
    );
  }

  if (!group) return null;

  if (requestSent) {
    return (
      <div className="mx-auto max-w-md space-y-5">
        <ScreenBar title={group.name} onBack={onCancel} />
        <div className="space-y-2 py-6 text-center">
          <h2 className="text-lg font-bold text-foreground">{t('jg_request_sent_title')}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t('jg_request_sent_desc_prefix')}{group.name}{t('jg_request_sent_desc_suffix')}
          </p>
        </div>
        <Button variant="outline" className="h-12 w-full cursor-pointer rounded-xl font-bold" onClick={onCancel}>
          {t('jg_back_to_dashboard')}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <ScreenBar title={t('join_group')} onBack={onCancel} />

      <div className="space-y-1">
        <h2 className="text-xl font-bold text-foreground">{group.name}</h2>
        {group.description && <p className="text-sm leading-relaxed text-muted-foreground">{group.description}</p>}
      </div>

      <dl className="divide-y divide-border rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5 text-sm">
          <dt className="text-muted-foreground">{t('contribution_label')}</dt>
          <dd className="font-bold tabular-nums text-foreground">{group.contributionAmount.toLocaleString()} {group.currency}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3.5 text-sm">
          <dt className="text-muted-foreground">{t('frequency')}</dt>
          <dd className="font-bold text-foreground">{t(`freq_${group.frequency}`)}</dd>
        </div>
      </dl>

      <div className="space-y-2">
        <Button className="h-12 w-full cursor-pointer rounded-xl font-bold" onClick={handleJoin} disabled={joining}>
          {joining ? <Loader2 className="h-5 w-5 animate-spin" /> : t('jg_request_to_join_cta')}
        </Button>
        <Button variant="ghost" className="h-11 w-full cursor-pointer rounded-xl font-bold text-muted-foreground" onClick={onCancel} disabled={joining}>
          {t('cancel')}
        </Button>
      </div>
    </div>
  );
}
