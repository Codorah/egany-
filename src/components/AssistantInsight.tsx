import React, { useEffect, useState } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import { Group, UserProfile } from '@/types';
import { loadAssistantContext } from '@/lib/assistantContext';
import { momentInsight } from '@/lib/assistantEngine';

interface AssistantInsightProps {
  user: UserProfile;
  groups: Group[];
  onNavigate?: (view: string) => void;
}

/** La phrase la plus utile du moment. Rien s'il n'y a rien d'utile à dire. */
export function AssistantInsight({ user, groups, onNavigate }: AssistantInsightProps) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAssistantContext(user, groups).then((context) => {
      if (!cancelled) setText(context ? momentInsight(context) : null);
    });
    return () => { cancelled = true; };
    // Le solde compte : une recharge peut faire disparaître « il manque… ».
  }, [user.uid, user.walletBalance, groups]);

  if (!text) return null;

  return (
    <button
      type="button"
      onClick={() => onNavigate?.('ai-assistant')}
      className="flex min-h-11 w-full cursor-pointer items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left"
    >
      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-secondary" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-muted-foreground">Assistant eganyé</span>
        <span className="block text-sm leading-snug text-foreground">{text}</span>
      </span>
      <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}
