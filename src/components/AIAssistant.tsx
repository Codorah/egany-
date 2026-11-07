import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Sparkles } from 'lucide-react';
import { Group, UserProfile } from '@/types';
import { answer, momentInsight, type AssistantContext } from '@/lib/assistantEngine';
import { loadAssistantContext } from '@/lib/assistantContext';
import { reliabilityLevel, setAssistantLanguage, tr, type Reliability } from '@/lib/reliability';
import { useLanguage } from '@/contexts/LanguageContext';

interface AIAssistantProps {
  user: UserProfile;
  groups: Group[];
}

interface Message {
  id: number;
  sender: 'user' | 'assistant';
  text: string;
}

const suggestions = () => [
  tr('Pourquoi mon score a bougé ?', 'Why did my score move?'),
  tr('Comment faire monter mon score ?', 'How can I raise my score?'),
  tr('Ma prochaine cotisation ?', 'My next contribution?'),
  tr('La santé de mon cercle', 'How is my circle doing?'),
  tr('Que fait l’IA ?', 'What does the AI do?'),
  tr('Qui voit mon score ?', 'Who can see my score?'),
];

function Avatar() {
  return (
    <span className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-ink text-white" aria-hidden="true">
      <Sparkles className="h-4 w-4" />
    </span>
  );
}

export function AIAssistant({ user, groups }: AIAssistantProps) {
  const { language } = useLanguage();
  setAssistantLanguage(language);
  const [context, setContext] = useState<AssistantContext | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const greeted = useRef(false);
  const reliability: Reliability | null = context?.reliability ?? null;

  useEffect(() => {
    let cancelled = false;
    loadAssistantContext(user, groups, { withCircleHealth: true }).then((value) => {
      if (cancelled) return;
      setContext(value);
      setLoaded(true);
      // L'assistant parle en premier, une seule fois, avec l'analyse du moment.
      if (value && !greeted.current) {
        greeted.current = true;
        const opening = momentInsight(value);
        setMessages((prev) => [
          { id: nextId.current++, sender: 'assistant', text: opening ?? tr('Rien à signaler pour le moment. Posez-moi une question sur votre score, vos cotisations ou vos cercles.', 'Nothing to report right now. Ask me about your score, contributions or circles.') },
          ...prev,
        ]);
      }
    });
    return () => { cancelled = true; };
  }, [user.uid, user.walletBalance, groups]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, typing]);

  const send = (raw: string) => {
    const question = raw.trim();
    if (!question || typing) return;
    const replyText = context
      ? answer(question, context).text
      : tr('Je n’arrive pas à lire vos données pour le moment. Réessayez dans un instant.', 'I can’t read your data right now. Try again in a moment.');
    setMessages((prev) => [...prev, { id: nextId.current++, sender: 'user', text: question }]);
    setInput('');
    setTyping(true);
    window.setTimeout(() => {
      setMessages((prev) => [...prev, { id: nextId.current++, sender: 'assistant', text: replyText }]);
      setTyping(false);
    }, 450);
  };

  const ready = reliability?.status === 'ready' ? reliability : null;
  const started = messages.some((m) => m.sender === 'user');

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-120px)] w-full max-w-2xl flex-col">
      {/* En-tête de conversation */}
      <header className="flex items-center gap-3 border-b border-border pb-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-ink text-white" aria-hidden="true">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-base font-bold leading-tight text-foreground">{tr('Assistant eganyé', 'eganyé Assistant')}</p>
          <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
            {tr('Répond à partir de vos données', 'Answers from your own data')}
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-4 py-4" aria-live="polite">
        {/* Le score est une carte dans la conversation, pas une page à part. */}
        {loaded && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[13px] text-muted-foreground">{tr('Votre score de fiabilité', 'Your reliability score')}</p>
            {ready ? (
              <>
                <p className="mt-0.5 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums text-foreground">{ready.score}</span>
                  <span className="text-sm text-muted-foreground">/ 100 · {reliabilityLevel(ready.score)}</span>
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={ready.score} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-secondary" style={{ width: `${ready.score}%` }} />
                </div>
              </>
            ) : reliability?.status === 'building' ? (
              <p className="mt-1 text-sm leading-relaxed text-foreground">
                {tr(`Pas encore de score : il faut ${reliability.needed} cotisations échues, vous en avez ${reliability.dueCount}.`, `No score yet: it takes ${reliability.needed} contributions past their due date, and you have ${reliability.dueCount}.`)}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">{tr('Indisponible pour le moment.', 'Unavailable right now.')}</p>
            )}
            <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
              {tr('Estimation de l’IA d’eganyé : elle peut se tromper et ne décide rien.', 'Estimate by eganyé’s AI: it can be wrong and decides nothing.')}
            </p>
          </div>
        )}
        {!loaded && <div className="h-24 animate-pulse rounded-2xl bg-muted" />}

        {messages.map((m) =>
          m.sender === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[82%] whitespace-pre-line rounded-2xl rounded-br-md bg-primary-ink px-4 py-2.5 text-[15px] leading-relaxed text-white">
                {m.text}
              </p>
            </div>
          ) : (
            <div key={m.id} className="flex items-end gap-2">
              <Avatar />
              <p className="max-w-[82%] whitespace-pre-line rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-[15px] leading-relaxed text-foreground">
                {m.text}
              </p>
            </div>
          ),
        )}

        {typing && (
          <div className="flex items-end gap-2" aria-label={tr('L’assistant écrit', 'The assistant is typing')}>
            <Avatar />
            <span className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-4 py-3.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Zone de saisie : toujours visible au-dessus de la barre du bas. */}
      <div className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] bg-background pb-2 pt-2 md:bottom-0">
        {!started && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-none">
            {suggestions().map((suggestion) => (
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
        )}
        <form
          className="flex items-center gap-2 rounded-full border border-input bg-card py-1.5 pl-5 pr-1.5 focus-within:border-primary-ink"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={tr('Posez votre question', 'Ask your question')}
            aria-label={tr('Votre question', 'Your question')}
            enterKeyHint="send"
            autoComplete="off"
            maxLength={300}
            className="h-10 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!input.trim() || typing}
            aria-label={tr('Envoyer', 'Send')}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary-ink text-white disabled:cursor-default disabled:opacity-40"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
