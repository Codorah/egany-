import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, createChannel } from '@/lib/supabase';
import { mapMessageRow } from '@/lib/mappers';
import { UserProfile, Message } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CustomAvatar } from './CustomAvatar';
import { EganyeIcon } from './ui/EganyeIcon';
import { EganyeMascot } from './ui/EganyeMascot';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'motion/react';

interface ChatProps {
  groupId: string;
  user: UserProfile;
  groupName?: string;
  creatorId?: string;
}

// Suggestions de réponses rapides adaptées à la tontine
const QUICK_TONTINE_CHIPS = [
  '💰 J’ai envoyé ma cotisation !',
  '🎉 Félicitations pour ce tour !',
  '🤝 Merci à tout le cercle !',
  '⏳ Je cotise dans la journée',
];

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
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }, 80);
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
      fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  };

  // Helper pour formater la date du séparateur
  const formatDaySeparator = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isToday(date)) return 'Aujourd’hui';
    if (isYesterday(date)) return 'Hier';
    return format(date, 'EEEE d MMMM', { locale: fr });
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-13.5rem)] min-h-[460px] -mx-4 sm:mx-0 bg-[#FBF7F0]/40 dark:bg-background/40 rounded-3xl overflow-hidden border border-[#EFE2D0]/80 dark:border-border/60">
      {/* ── ZONE DE DÉFILEMENT DES MESSAGES ── */}
      <ScrollArea className="flex-1 px-3 sm:px-4">
        <div className="space-y-3 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <EganyeMascot variant="loading" size={70} />
              <p className="text-xs text-muted-foreground font-medium animate-pulse">
                Chargement des échanges...
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 px-4 max-w-sm mx-auto space-y-3">
              <EganyeMascot variant="empty" size={90} />
              <h4 className="text-sm font-serif font-black text-foreground">
                Discussion de {groupName || 'ce cercle'}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Partagez des nouvelles, confirmez vos versements ou encouragez le bénéficiaire de ce tour !
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMine = msg.userId === user.uid;
              const prev = messages[idx - 1];

              // Date separator check
              const currentDate = msg.createdAt ? new Date(msg.createdAt).toDateString() : '';
              const prevDate = prev?.createdAt ? new Date(prev.createdAt).toDateString() : '';
              const showDateSeparator = idx === 0 || currentDate !== prevDate;

              const isSameSenderAsPrev = prev && prev.userId === msg.userId && !showDateSeparator;
              const isCreator = msg.userId === creatorId;

              return (
                <React.Fragment key={msg.id}>
                  {/* Séparateur temporel épuré */}
                  {showDateSeparator && (
                    <div className="flex justify-center my-3">
                      <span className="px-3 py-1 rounded-full bg-[#EFE2D0]/60 dark:bg-muted text-[10px] font-bold text-muted-foreground tracking-wide uppercase select-none shadow-2xs">
                        {formatDaySeparator(msg.createdAt)}
                      </span>
                    </div>
                  )}

                  {/* Ligne de message style WhatsApp / iMessage */}
                  <div
                    className={`flex items-end gap-2 ${
                      isMine ? 'flex-row-reverse' : 'flex-row'
                    } ${isSameSenderAsPrev ? 'mt-1' : 'mt-2.5'}`}
                  >
                    {/* Avatar expéditeur (autres membres uniquement) */}
                    {!isMine && (
                      <div className="w-7 shrink-0">
                        {!isSameSenderAsPrev ? (
                          <CustomAvatar
                            photoURL={msg.userPhoto}
                            name={msg.userName}
                            size={28}
                            className="ring-1 ring-white dark:ring-card"
                          />
                        ) : (
                          <div className="w-7" />
                        )}
                      </div>
                    )}

                    {/* Bulle de texte */}
                    <div className={`flex flex-col max-w-[80%] sm:max-w-[70%] ${isMine ? 'items-end' : 'items-start'}`}>
                      {/* En-tête expéditeur (nom + badge créateur) */}
                      {!isMine && !isSameSenderAsPrev && (
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[11px] font-extrabold text-[#C96F4A] dark:text-primary">
                            {msg.userName}
                          </span>
                          {isCreator && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-[#FFF4E5] dark:bg-primary/20 text-[#C96F4A] dark:text-primary text-[9px] font-bold">
                              👑 Organisateur
                            </span>
                          )}
                        </div>
                      )}

                      {/* Corps de la bulle avec queue directionnelle */}
                      <div
                        className={`relative px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-xs ${
                          isMine
                            ? 'bg-gradient-to-br from-[#C96F4A] to-[#B85C36] text-white rounded-2xl rounded-br-xs'
                            : 'bg-white dark:bg-card border border-[#EFE2D0] dark:border-border text-foreground rounded-2xl rounded-bl-xs'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                        {/* Horodatage & coches de lecture */}
                        <div
                          className={`flex items-center justify-end gap-1 mt-1 text-[9px] select-none ${
                            isMine ? 'text-white/75' : 'text-muted-foreground'
                          }`}
                        >
                          <span>
                            {msg.createdAt && format(new Date(msg.createdAt), 'HH:mm', { locale: fr })}
                          </span>
                          {isMine && (
                            <span className="text-[10px] font-bold tracking-tighter" title="Distribué">
                              ✓✓
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* ── PILLS DE RÉPONSES RAPIDES TONTINE ── */}
      <div className="px-3 py-1.5 overflow-x-auto no-scrollbar flex items-center gap-1.5 border-t border-[#EFE2D0]/60 dark:border-border/40 bg-white/60 dark:bg-card/60 backdrop-blur-xs">
        {QUICK_TONTINE_CHIPS.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(chip)}
            className="shrink-0 text-[11px] font-semibold px-3 py-1 rounded-full bg-[#FFFBF7] dark:bg-muted border border-[#EFE2D0] dark:border-border text-foreground hover:border-[#C96F4A] hover:text-[#C96F4A] transition-colors cursor-pointer select-none"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* ── BARRE DE SAISIE MOBILE NATIVE ── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 border-t border-[#EFE2D0] dark:border-border bg-white dark:bg-card flex items-center gap-2 shrink-0"
      >
        <Input
          placeholder={t('chat_input_placeholder') || 'Écrivez un message au groupe...'}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1 rounded-full h-11 bg-[#F8F0E4]/60 dark:bg-muted border-transparent focus:border-[#C96F4A] px-4 text-xs sm:text-sm"
        />

        <Button
          type="submit"
          size="icon"
          disabled={!newMessage.trim() || sending}
          className="rounded-full h-11 w-11 bg-[#C96F4A] hover:bg-[#B85C36] text-white shrink-0 cursor-pointer shadow-xs transition-transform active:scale-95 disabled:opacity-40"
          aria-label="Envoyer le message"
        >
          <EganyeIcon name="send" size={16} />
        </Button>
      </form>
    </div>
  );
}
