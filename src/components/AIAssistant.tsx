import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Sparkles, Send, Activity, AlertTriangle, ShieldCheck, Bell, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { mapContributionRow } from '@/lib/mappers';
import { apiUrl } from '@/lib/apiBase';
import { Group, UserProfile } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';

interface AIAssistantProps {
  user: UserProfile;
  groups: Group[];
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
}

export function AIAssistant({ user, groups }: AIAssistantProps) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: t('ais_welcome_message')
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [lateContributions, setLateContributions] = useState<{ groupName: string; amount: number; currency: string; period?: string }[]>([]);
  const [loadingContext, setLoadingContext] = useState(true);

  useEffect(() => {
    const loadContext = async () => {
      const { data } = await supabase.from('contributions').select('*').eq('user_id', user.uid).eq('status', 'late');
      const rows = (data ?? []).map(mapContributionRow);
      setLateContributions(rows.map((c) => {
        const g = groups.find((gr) => gr.id === c.groupId);
        return { groupName: g?.name || t('ais_circle_fallback_label'), amount: c.amount, currency: g?.currency || 'FCFA', period: c.period };
      }));
      setLoadingContext(false);
    };
    loadContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid, groups.length]);

  const activeGroups = groups.filter((g) => g.status === 'active');
  const totalCommitted = activeGroups.reduce((acc, g) => acc + g.contributionAmount * g.members.length, 0);
  const nextPayoutGroup = activeGroups.find((g) => {
    const idx = g.payoutOrder.indexOf(user.uid);
    return idx >= g.currentPayoutIndex;
  }) || activeGroups[0] || null;

  const financialContext = useMemo(() => ({
    displayName: user.displayName,
    soldeDisponible: user.walletBalance,
    totalEpargne: user.totalSaved,
    scoreReputation: user.reputationScore,
    cerclesActifs: activeGroups.map((g) => ({
      nom: g.name,
      cotisation: g.contributionAmount,
      devise: g.currency,
      frequence: g.frequency,
      membres: g.members.length,
      potParCycle: g.contributionAmount * g.members.length,
      prochaineDateVersement: g.nextPayoutDate,
    })),
    cotisationsEnRetard: lateContributions,
    prochainTour: nextPayoutGroup ? {
      cercle: nextPayoutGroup.name,
      montant: nextPayoutGroup.contributionAmount * nextPayoutGroup.members.length,
      date: nextPayoutGroup.nextPayoutDate,
    } : null,
    montantTotalEngage: totalCommitted,
  }), [user, activeGroups, lateContributions, nextPayoutGroup, totalCommitted]);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    const newMsg: Message = { id: Date.now().toString(), sender: 'user', text: query };
    setMessages((prev) => [...prev, newMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    try {
      const response = await fetch(apiUrl('/api/ai-assistant'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query, context: financialContext }),
      });
      const data = await response.json();
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: data.reply || t('ais_no_reply_fallback'),
      }]);
    } catch (err) {
      toast.error(t('ais_connection_error_toast'));
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: t('ais_network_error_message'),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto flex flex-col min-h-[calc(100dvh-140px)]">
      {/* Copilote Header */}
      <div className="gradient-sunset p-6 rounded-3xl border border-amber-900/20 shadow-elevated text-white shrink-0 flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-2xl backdrop-blur-xs">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-serif font-black flex items-center gap-2">
              {t('ais_header_title')} <span className="text-[10px] uppercase bg-white/20 px-2 py-0.5 rounded-full font-bold tracking-widest">{t('ais_status_operational')}</span>
            </h1>
          </div>
          <p className="text-white/80 text-xs font-medium">
            {t('ais_header_subtitle')}
          </p>
        </div>
      </div>

      {/* Operational Treasury Alerts */}
      <div className="bg-card border border-border/80 rounded-3xl p-5 shadow-soft space-y-4 shrink-0">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          {t('ais_detection_health_title')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lateContributions.length > 0 ? (
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl space-y-2">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-foreground">
                    {lateContributions.length} {t('ais_late_contributions_count_label')}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {lateContributions[0].groupName} : {lateContributions[0].amount.toLocaleString()} {lateContributions[0].currency}
                    {lateContributions.length > 1 ? ` ${t('ais_and_label')} ${lateContributions.length - 1} ${t('ais_others_label')}` : ''}.
                  </p>
                  <Button
                    onClick={() => handleSend('Aide-moi à rédiger un rappel pour mes cotisations en retard')}
                    size="sm"
                    className="mt-2.5 h-8 text-[11px] font-bold gradient-sunset text-white rounded-xl shadow-xs"
                  >
                    <Bell className="w-3.5 h-3.5 mr-1" /> {t('ais_draft_reminder_cta')}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl space-y-2">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-foreground">{t('ais_no_late_contribution_title')}</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {loadingContext ? t('ais_checking_ellipsis') : t('ais_all_payments_uptodate')}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-primary/10 border border-primary/20 p-4 rounded-2xl space-y-2">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-foreground">
                  {activeGroups.length} {t('ais_active_circles_count_label')}
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {totalCommitted.toLocaleString()} {t('ais_engaged_this_cycle_suffix')}
                </p>
                <Button
                  onClick={() => handleSend('Fais-moi un bilan de ma caisse')}
                  variant="outline"
                  size="sm"
                  className="mt-2.5 h-8 text-[11px] font-bold border-border text-foreground rounded-xl"
                >
                  <FileText className="w-3.5 h-3.5 mr-1" /> {t('ais_generate_report_cta')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => handleSend('Résume mes cotisations en retard et suggère un message de rappel')}
          className="px-3.5 py-2 rounded-2xl bg-card border border-border text-xs font-bold text-foreground hover:bg-muted/50 transition-colors shrink-0 flex items-center gap-1.5"
        >
          <Bell className="w-3.5 h-3.5 text-primary" /> {t('ais_smart_reminders_chip')}
        </button>
        <button
          onClick={() => handleSend('Fais-moi un bilan de ma caisse')}
          className="px-3.5 py-2 rounded-2xl bg-card border border-border text-xs font-bold text-foreground hover:bg-muted/50 transition-colors shrink-0 flex items-center gap-1.5"
        >
          <FileText className="w-3.5 h-3.5 text-emerald-500" /> {t('ais_treasury_report_chip')}
        </button>
        <button
          onClick={() => handleSend('Quand et combien vais-je recevoir à mon prochain tour ?')}
          className="px-3.5 py-2 rounded-2xl bg-card border border-border text-xs font-bold text-foreground hover:bg-muted/50 transition-colors shrink-0 flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" /> {t('ais_next_turn_chip')}
        </button>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 bg-card border border-border/80 rounded-3xl shadow-soft flex flex-col overflow-hidden min-h-[300px]">
        <div className="p-4 border-b border-border/60 bg-muted/20 flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground">{t('ais_conversation_label')}</span>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] p-3.5 rounded-2xl text-xs whitespace-pre-line leading-relaxed ${
                  m.sender === 'user'
                    ? 'gradient-sunset text-white rounded-br-none font-medium'
                    : 'bg-muted/40 text-foreground border border-border/60 rounded-bl-none font-normal'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-muted/40 text-muted-foreground p-3 rounded-2xl text-xs animate-pulse">
                {t('ais_analyzing_ellipsis')}
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border/60 bg-card flex gap-2">
          <Input
            placeholder={t('ais_input_placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="rounded-2xl h-11 text-xs border-border/80 focus-visible:ring-primary"
          />
          <Button onClick={() => handleSend()} className="gradient-sunset text-white rounded-2xl h-11 px-4 cursor-pointer">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
