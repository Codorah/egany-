import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, createChannel } from '@/lib/supabase';
import { mapMessageRow } from '@/lib/mappers';
import { UserProfile, Message } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';

interface ChatProps {
  groupId: string;
  user: UserProfile;
}

export function Chat({ groupId, user }: ChatProps) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Error fetching messages:', error);
      setLoading(false);
      return;
    }
    setMessages((data ?? []).map(mapMessageRow));
    setLoading(false);
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }, 100);
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

    return () => { supabase.removeChannel(channel); };
  }, [groupId, fetchMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      const { error } = await supabase.from('messages').insert({
        group_id: groupId,
        user_id: user.uid,
        user_name: user.displayName,
        user_photo: user.photoURL || '',
        content: messageContent,
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Pas de carte ni d'en-tête ici : le titre « Discussion » et le bouton
  // retour vivent déjà dans l'en-tête de section de GroupDetails. Ce
  // composant occupe tout l'espace restant, comme un vrai fil WhatsApp —
  // pas une carte de 500px flottant au milieu de la page.
  return (
    <div className="flex flex-col h-[calc(100dvh-13rem)] min-h-[420px] -mx-4 sm:mx-0">
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-3 py-3">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm italic">
              {t('chat_empty_state')}
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMine = msg.userId === user.uid;
              const prev = messages[idx - 1];
              const showSender = !isMine && (!prev || prev.userId !== msg.userId);
              return (
                <div key={msg.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                  <Avatar className={`w-7 h-7 shrink-0 ${isMine ? 'invisible' : ''}`}>
                    <AvatarImage src={msg.userPhoto} />
                    <AvatarFallback>{msg.userName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className={`flex flex-col max-w-[78%] ${isMine ? 'items-end' : 'items-start'}`}>
                    {showSender && (
                      <span className="text-[11px] font-bold text-muted-foreground mb-0.5 px-1">{msg.userName}</span>
                    )}
                    <div
                      className={`px-3.5 py-2 rounded-3xl text-sm leading-snug ${
                        isMine
                          ? 'bg-primary text-primary-foreground rounded-tr-md'
                          : 'bg-muted text-foreground rounded-tl-md'
                      }`}
                    >
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                      {msg.createdAt && format(new Date(msg.createdAt), 'HH:mm', { locale: fr })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <form onSubmit={handleSendMessage} className="px-4 py-3 border-t border-border/70 bg-background flex gap-2 shrink-0">
        <Input
          placeholder={t('chat_input_placeholder')}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1 rounded-full h-11 bg-muted border-transparent"
        />
        <Button type="submit" size="icon" disabled={!newMessage.trim()} className="group/send rounded-full h-11 w-11 shrink-0 cursor-pointer">
          <Send className="w-4 h-4 transition-transform duration-200 group-hover/send:translate-x-0.5 group-hover/send:-translate-y-0.5" />
        </Button>
      </form>
    </div>
  );
}
