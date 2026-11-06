import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Group, UserProfile } from '@/types';
import { answer, momentInsight, type AssistantContext } from '@/lib/assistantEngine';
import { loadAssistantContext } from '@/lib/assistantContext';
import { reliabilityLevel, type Reliability } from '@/lib/reliability';

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
  'La santé de mon cercle',
  'Que fait l’IA ?',
  'Qui voit mon score ?',
];

export function AIAssistant({ user, groups }: AIAssistantProps) {
  const [context, setContext] = useState<AssistantContext | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
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
          { id: nextId.current++, sender: 'assistant', text: opening ?? 'Rien à signaler pour le moment. Posez-moi une question sur votre score, vos cotisations ou vos cercles.' },
          ...prev,
        ]);
      }
    });
    return () => { cancelled = true; };
  }, [user.uid, user.walletBalance, groups]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const send = (raw: string) => {
    const question = raw.trim();
    if (!question) return;
    const replyText = context
      ? answer(question, context).text
      : 'Je n’arrive pas à lire vos données pour le moment. Réessayez dans un instant.';
    setMessages((prev) => [
      ...prev,
      { id: nextId.current++, sender: 'user', text: question },
      { id: nextId.current++, sender: 'assistant', text: replyText },
    ]);
    setInput('');
  };

  const ready = reliability?.status === 'ready' ? reliability : null;

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
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground">Estimé par l’IA d’eganyé à partir de vos cotisations. Le modèle peut se tromper et ne décide rien.</p>
          </>
        ) : reliability?.status === 'building' ? (
          <>
            <p className="text-[13px] text-muted-foreground">Score de fiabilité</p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">
              Pas encore de score : il faut {reliability.needed} cotisations échues, vous en avez {reliability.dueCount}.
            </p>
          </>
        ) : loaded ? (
          <p className="text-sm text-muted-foreground">Score indisponible pour le moment.</p>
        ) : (
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
        )}
      </section>

      <div className="flex-1 space-y-3 py-4" aria-live="polite">
        {loaded && (
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Je réponds uniquement à partir de vos données, et ce que vous écrivez reste sur votre téléphone.
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
