import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Group, UserProfile } from '@/types';
import { requestToJoinGroup, hydrateGroups } from '@/lib/groups';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, Loader2, Send } from 'lucide-react';
import { EganyeSearch } from './ui/EganyeSearch';
import { EmptyState } from './ui/EmptyState';
import { AmountDisplay } from './ui/AmountDisplay';
import { Skeleton } from './ui/Skeleton';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface SearchGroupsProps {
  user: UserProfile;
  onBack: () => void;
}

export function SearchGroups({ user, onBack }: SearchGroupsProps) {
  const { t } = useLanguage();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState('');
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchPublicGroups = async () => {
      try {
        const { data: groupRows, error } = await supabase
          .from('groups')
          .select('*')
          .eq('is_private', false)
          .eq('status', 'active');
        if (error) throw error;
        const hydrated = await hydrateGroups(groupRows ?? []);
        setGroups(hydrated.filter((g) => !g.members.includes(user.uid)));
      } catch (error) {
        console.error('Error searching public groups:', error);
        toast.error(t('sg_search_error'));
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
      toast.error(t('jg_join_request_error'));
    } finally {
      setRequestingId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 pb-20">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl shrink-0 cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-foreground">{t('sg_page_title')}</h1>
          <p className="text-[13px] text-muted-foreground font-medium">{t('sg_page_subtitle')}</p>
        </div>
      </div>

      <EganyeSearch
        placeholder={t('sg_search_placeholder')}
        value={term}
        onChange={setTerm}
        className="max-w-md"
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-card rounded-2xl border border-border/70 p-4 space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          illustration="no-circles"
          title={t('sg_empty_title')}
          description={t('sg_empty_desc')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((group) => {
            const isPending = group.pendingMembers?.includes(user.uid) || requestedIds.includes(group.id);
            return (
              <div key={group.id} className="glass-card rounded-2xl shadow-soft border border-border/70 p-4 space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-serif font-bold text-sm text-foreground truncate">{group.name}</h3>
                  <Badge variant="outline" className="text-[12px] rounded-full shrink-0">{t(`freq_${group.frequency}`)}</Badge>
                </div>
                <p className="text-[13px] text-muted-foreground line-clamp-2">{group.description}</p>

                <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-border/60">
                  <span className="text-muted-foreground font-medium">{t('contribution_label')}</span>
                  <AmountDisplay amount={group.contributionAmount} currency={group.currency} size="sm" />
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-muted-foreground font-medium">{t('participants')}</span>
                  <span className="text-foreground">{group.members.length}{group.maxMembers ? ` / ${group.maxMembers}` : ''}</span>
                </div>
                <Button
                  className="btn-shine w-full rounded-xl gap-1.5 cursor-pointer"
                  disabled={isPending || requestingId === group.id}
                  onClick={() => handleRequest(group)}
                >
                  {requestingId === group.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {isPending ? t('sg_request_sent_label') : t('jg_request_to_join_cta')}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
