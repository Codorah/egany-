import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Group, UserProfile } from '@/types';
import { requestToJoinGroup, hydrateGroups } from '@/lib/groups';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, Users, Loader2, Send } from 'lucide-react';
import { EmptyState } from './ui/EmptyState';
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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('sg_page_title')}</h1>
          <p className="text-muted-foreground text-sm">{t('sg_page_subtitle')}</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('sg_search_placeholder')}
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
          title={t('sg_empty_title')}
          description={t('sg_empty_desc')}
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
                    <Badge variant="outline" className="text-[10px]">{t(`freq_${group.frequency}`)}</Badge>
                  </div>
                  <CardDescription className="line-clamp-2 text-xs">{group.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">{t('contribution_label')}</span>
                    <span>{group.contributionAmount.toLocaleString()} {group.currency}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">{t('participants')}</span>
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
                    {isPending ? t('sg_request_sent_label') : t('jg_request_to_join_cta')}
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
