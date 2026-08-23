import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Group, UserProfile } from '@/types';
import { requestToJoinGroup, hydrateGroups } from '@/lib/groups';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, ShieldCheck, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
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
        const { data: groupRows, error } = await supabase.from('groups').select('*').eq('join_code', joinCode);
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
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">{t('jg_searching_circle')}</p>
      </div>
    );
  }

  if (!group) return null;

  if (requestSent) {
    return (
      <div className="max-w-md mx-auto py-8 animate-in fade-in duration-300">
        <Card className="border border-brand/20 shadow-xl rounded-3xl bg-card overflow-hidden">
          <CardContent className="flex flex-col items-center text-center gap-4 py-10 px-6">
            <div className="bg-brand/10 w-16 h-16 rounded-full flex items-center justify-center">
              <Clock className="w-8 h-8 text-brand" />
            </div>
            <div>
              <h3 className="font-serif font-extrabold text-lg text-foreground">{t('jg_request_sent_title')}</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                {t('jg_request_sent_desc_prefix')}{group.name}{t('jg_request_sent_desc_suffix')}
              </p>
            </div>
            <Button variant="outline" className="w-full mt-2" onClick={onCancel}>
              {t('jg_back_to_dashboard')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-8 animate-in fade-in duration-300">
      <Card className="border border-border shadow-xl rounded-3xl bg-card overflow-hidden">
        <CardHeader className="text-center pb-4 bg-chip/15">
          <div className="mx-auto bg-secondary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-secondary" />
          </div>
          <CardTitle className="text-2xl font-serif font-bold text-foreground">{t('join_group')}</CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            {t('jg_invited_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="bg-muted p-5 rounded-2xl border border-border text-center">
            <h3 className="font-serif font-extrabold text-lg text-foreground">{group.name}</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{group.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 bg-muted/50 p-3 rounded-xl border border-border">
              <p className="text-[10px] uppercase text-muted-foreground font-bold">{t('contribution_label')}</p>
              <p className="font-serif font-bold text-base text-foreground">{group.contributionAmount.toLocaleString()} {group.currency}</p>
            </div>
            <div className="space-y-1 bg-muted/50 p-3 rounded-xl border border-border">
              <p className="text-[10px] uppercase text-muted-foreground font-bold">{t('frequency')}</p>
              <p className="font-serif font-bold text-base text-brand capitalize">{t(`freq_${group.frequency}`)}</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2.5 text-xs font-semibold text-foreground">
              <CheckCircle2 className="w-4.5 h-4.5 text-secondary" />
              <span>{t('jg_secure_payments_desc')}</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs font-semibold text-foreground">
              <ShieldCheck className="w-4.5 h-4.5 text-brand" />
              <span>{t('jg_reputation_boost_desc')}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 pt-0 pb-6 px-6">
          <Button className="w-full h-12 text-sm font-bold bg-secondary hover:bg-secondary/90 text-white rounded-2xl shadow-sm transition-all cursor-pointer" onClick={handleJoin} disabled={joining}>
            {joining ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : t('jg_request_to_join_cta')}
          </Button>
          <Button variant="ghost" className="w-full text-xs font-bold text-muted-foreground hover:text-muted-foreground cursor-pointer" onClick={onCancel} disabled={joining}>
            {t('cancel')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
