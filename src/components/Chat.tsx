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

interface ChatProps {
  groupId: string;
  user: UserProfile;
}

export function Chat({ groupId, user }: ChatProps) {
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

  return (
    <div className="flex flex-col h-[500px] border rounded-xl bg-background overflow-hidden shadow-sm">
      <div className="p-4 border-bottom bg-muted/30 flex items-center justify-between">
        <h3 className="font-semibold">Chat du Cercle</h3>
        <span className="text-xs text-muted-foreground">{messages.length} messages</span>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm italic">
              Commencez la discussion...
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.userId === user.uid ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={msg.userPhoto} />
                  <AvatarFallback>{msg.userName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className={`flex flex-col max-w-[80%] ${msg.userId === user.uid ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">{msg.userName}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {msg.createdAt && format(new Date(msg.createdAt), 'HH:mm', { locale: fr })}
                    </span>
                  </div>
                  <div
                    className={`p-3 rounded-2xl text-sm ${
                      msg.userId === user.uid
                        ? 'bg-primary text-primary-foreground rounded-tr-none'
                        : 'bg-muted rounded-tl-none'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <form onSubmit={handleSendMessage} className="p-4 border-t bg-background flex gap-2">
        <Input
          placeholder="Votre message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={!newMessage.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
