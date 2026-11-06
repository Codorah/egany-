import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Group, UserProfile } from '@/types';
import { answer, explainChange, type AssistantContext, type AssistantContribution } from '@/lib/assistantEngine';
import { fetchMyReliability, reliabilityLevel, type Reliability } from '@/lib/reliability';

interface AIAssistantProps {
  user: UserProfile;
  groups: Group[];
}

interface Message {
  id: number;
  sender: 'user' | 'assistant';
  text: string;
}

const SUGGESTIONS = [
  'Pourquoi mon score a bougé ?',
  'Comment faire monter mon score ?',
  'Ma prochaine cotisation ?',
  'Qui voit mon score ?',
];

export function AIAssistant({ user, groups }: AIAssistantProps) {
  const [reliability, setReliability] = useState<Reliability | null>(null);
  const [contributions, setContributions] = useState<AssistantContribution[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    let cancelled = false;
    fetchMyReliability().then((value) => {
      if (!cancelled) setReliability(value);
    });
    return () => { cancelled = true; };
  }, [user.uid]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('contributions')
      .select('group_id, amount, date, status, penalty_applied, penalty_status')
      .eq('user_id', user.uid)
      .in('status', ['pending', 'late'])
      .then(({ data }) => {
        if (cancelled || !data) return;
        setContributions(data.map((row: any) => {
          const group = groups.find((g) => g.id === row.group_id);
          return {
            groupName: group?.name || 'Cercle',
            amount: Number(row.amount),
            penalty: row.penalty_status === 'pending' ? Number(row.penalty_applied ?? 0) : 0,
            currency: group?.currency || 'FCFA',
            dueDate: row.date,
            status: row.status,
          };
        }));
      });
    return () => { cancelled = true; };
  }, [user.uid, groups]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const buildContext = (): AssistantContext => ({
    firstName: user.firstName || user.displayName.split(' ')[0] || '',
    walletBalance: user.walletBalance || 0,
    contributions,
    reliability,
    circles: groups.filter((g) => g.status === 'active').map((g) => ({
      name: g.name,
      nextPayoutDate: g.nextPayoutDate,
      potAmount: g.contributionAmount * g.members.length,
      currency: g.currency,
      isNextBeneficiary: g.payoutOrder[g.currentPayoutIndex] === user.uid,
    })),
  });

  const send = (raw: string) => {
    const question = raw.trim();
    if (!question) return;
    const reply = answer(question, buildContext());
    setMessages((prev) => [
      ...prev,
      { id: nextId.current++, sender: 'user', text: question },
      { id: nextId.current++, sender: 'assistant', text: reply.text },
    ]);
    setInput('');
  };

  const ready = reliability?.status === 'ready' ? reliability : null;
  const moved = ready && ready.previousScore !== null && ready.previousScore !== ready.score;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-140px)] w-full max-w-2xl flex-col">
      <h1 className="text-xl font-bold text-foreground">Assistant</h1>

      {/* Le score d'abord : c'est ce que la personne vient voir. */}
      <section className="mt-4 border-b border-border pb-5" aria-label="Score de fiabilité">
        {ready ? (
          <>
            <p className="text-[13px] text-muted-foreground">Score de fiabilité</p>
            <p className="mt-0.5 flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular-nums text-foreground">{ready.score}</span>
              <span className="text-sm text-muted-foreground">/ 100 · {reliabilityLevel(ready.score)}</span>
            </p>
            {moved && <p className="mt-2 text-sm leading-relaxed text-foreground">{explainChange(ready)}</p>}
          </>
        ) : reliability?.status === 'building' ? (
          <>
            <p className="text-[13px] text-muted-foreground">Score de fiabilité</p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">
              Pas encore de score : il faut {reliability.needed} cotisations échues, vous en avez {reliability.dueCount}.
            </p>
          </>
        ) : reliability?.status === 'error' ? (
          <p className="text-sm text-muted-foreground">Score indisponible pour le moment.</p>
        ) : (
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
        )}
      </section>

      <div className="flex-1 space-y-3 py-4" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Posez une question sur votre score, vos cotisations ou votre solde. Je réponds uniquement à partir de vos données, et ce que vous écrivez reste sur votre téléphone.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <p
              className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.sender === 'user' ? 'bg-primary-ink text-white' : 'bg-muted text-foreground'
              }`}
            >
              {m.text}
            </p>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Reste visible au-dessus de la barre de navigation. */}
      <div className="sticky bottom-20 bg-background pb-2 pt-2 md:bottom-0">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-none">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => send(suggestion)}
              className="h-11 shrink-0 cursor-pointer rounded-full border border-border bg-card px-4 text-[13px] font-semibold text-foreground"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Votre question"
            aria-label="Votre question"
            enterKeyHint="send"
            autoComplete="off"
            maxLength={300}
            className="h-12 min-w-0 flex-1 rounded-xl border border-input bg-card px-4 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-primary-ink"
          />
          <button
            type="submit"
            aria-label="Envoyer"
            className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary-ink text-white"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
