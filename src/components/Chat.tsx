import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase, createChannel } from '@/lib/supabase';
import { mapMessageRow } from '@/lib/mappers';
import { UserProfile, Message } from '@/types';
import { CustomAvatar } from './CustomAvatar';
import { Skeleton } from './ui/Skeleton';
import { useLanguage } from '@/contexts/LanguageContext';

interface ChatProps {
  groupId: string;
  user: UserProfile;
  groupName?: string;
  creatorId?: string;
}

// Proposées seulement dans une conversation vide, pour lancer l'échange.
const QUICK_TONTINE_CHIPS = [
  'J’ai envoyé ma cotisation',
  'Merci à tout le cercle',
  'Je cotise dans la journée',
];

/** La discussion occupe l'espace que lui donne son parent : il doit être en flex colonne. */
export function Chat({ groupId, user, groupName, creatorId }: ChatProps) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(150);

    if (error) {
      console.error('Error fetching messages:', error);
      setLoading(false);
      return;
    }
    setMessages((data ?? []).map(mapMessageRow));
    setLoading(false);
    setTimeout(() => scrollRef.current?.scrollIntoView({ block: 'end' }), 80);
  }, [groupId]);

  useEffect(() => {
    fetchMessages();

    const channel = createChannel(`messages-${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` },
        () => fetchMessages()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, fetchMessages]);

  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend || newMessage).trim();
    if (!content || sending) return;

    setSending(true);
    setNewMessage('');

    try {
      const { error } = await supabase.from('messages').insert({
        group_id: groupId,
        user_id: user.uid,
        user_name: user.displayName || 'Membre',
        user_photo: user.photoURL || '',
        content,
      });
      if (error) throw error;
      // La souscription realtime déclenche déjà fetchMessages() sur cet événement.
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  };

  const formatDaySeparator = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isToday(date)) return 'Aujourd’hui';
    if (isYesterday(date)) return 'Hier';
    return format(date, 'EEEE d MMMM', { locale: fr });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <div className="space-y-1 py-4">
          {loading ? (
            <div className="space-y-3" aria-label="Chargement">
              <Skeleton className="h-12 w-2/3 rounded-2xl" />
              <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
              <Skeleton className="h-12 w-3/5 rounded-2xl" />
            </div>
          ) : messages.length === 0 ? (
            <div className="mx-auto max-w-sm space-y-4 px-2 py-12 text-center">
              <h2 className="text-base font-bold text-foreground">Discussion de {groupName || 'ce cercle'}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Donnez des nouvelles et confirmez vos versements.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_TONTINE_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleSendMessage(chip)}
                    className="min-h-11 cursor-pointer rounded-full border border-border bg-card px-4 text-[13px] font-bold text-foreground transition-colors duration-150 hover:bg-muted"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMine = msg.userId === user.uid;
              const prev = messages[idx - 1];

              const currentDate = msg.createdAt ? new Date(msg.createdAt).toDateString() : '';
              const prevDate = prev?.createdAt ? new Date(prev.createdAt).toDateString() : '';
              const showDateSeparator = idx === 0 || currentDate !== prevDate;

              const isSameSenderAsPrev = prev && prev.userId === msg.userId && !showDateSeparator;
              const isCreator = msg.userId === creatorId;

              return (
                <React.Fragment key={msg.id}>
                  {showDateSeparator && (
                    <p className="select-none py-3 text-center text-[13px] font-bold text-muted-foreground">
                      {formatDaySeparator(msg.createdAt)}
                    </p>
                  )}

                  <div
                    className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'} ${
                      isSameSenderAsPrev ? '' : 'pt-2'
                    }`}
                  >
                    {!isMine && (
                      <div className="w-7 shrink-0">
                        {!isSameSenderAsPrev && <CustomAvatar photoURL={msg.userPhoto} name={msg.userName} size={28} />}
                      </div>
                    )}

                    <div className={`flex max-w-[80%] flex-col sm:max-w-[70%] ${isMine ? 'items-end' : 'items-start'}`}>
                      {!isMine && !isSameSenderAsPrev && (
                        <p className="mb-1 px-1 text-[13px] font-bold text-foreground">
                          {msg.userName}
                          {isCreator && <span className="font-normal text-muted-foreground"> · Organisateur</span>}
                        </p>
                      )}

                      <div
                        className={`rounded-2xl px-3.5 py-2 text-[15px] leading-snug ${
                          isMine ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className={`mt-0.5 select-none text-right text-[13px] ${isMine ? 'text-primary-foreground/85' : 'text-muted-foreground'}`}>
                          {msg.createdAt && format(new Date(msg.createdAt), 'HH:mm', { locale: fr })}
                        </p>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
          <div ref={scrollRef} />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex shrink-0 items-center gap-2 border-t border-border bg-card px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <input
          placeholder={t('chat_input_placeholder') || 'Écrivez un message au groupe...'}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="h-11 min-w-0 flex-1 rounded-full border border-input bg-background px-4 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
          aria-label="Message"
          enterKeyHint="send"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          aria-label="Envoyer le message"
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity duration-150 disabled:opacity-40"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
