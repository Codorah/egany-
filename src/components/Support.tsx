import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, HelpCircle, LifeBuoy, ChevronDown, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface SupportProps {
  user: UserProfile;
  onBack: () => void;
}

interface FaqAccordionItemProps {
  question: string;
  answer: string;
}

const FaqAccordionItem: React.FC<FaqAccordionItemProps> = ({ question, answer }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/70 rounded-2xl overflow-hidden bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left cursor-pointer hover:bg-muted transition-colors active:scale-[0.99]"
      >
        <span className="text-sm font-bold text-foreground">{question}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-primary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 text-[13px] text-muted-foreground leading-relaxed">{answer}</div>
      )}
    </div>
  );
}

export function Support({ user, onBack }: SupportProps) {
  const { t } = useLanguage();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const FAQ_ITEMS = [
    { question: t('sup_faq_1_q'), answer: t('sup_faq_1_a') },
    { question: t('sup_faq_2_q'), answer: t('sup_faq_2_a') },
    { question: t('sup_faq_3_q'), answer: t('sup_faq_3_a') },
    { question: t('sup_faq_4_q'), answer: t('sup_faq_4_a') },
    { question: t('sup_faq_5_q'), answer: t('sup_faq_5_a') },
    { question: t('sup_faq_6_q'), answer: t('sup_faq_6_a') },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error(t('sup_fill_required_toast'));
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('support_tickets').insert({
        user_id: user.uid,
        user_name: user.displayName,
        user_email: user.email,
        subject: subject.trim(),
        message: message.trim(),
        status: 'open',
      });
      if (error) throw error;
      setSubmitted(true);
      setSubject('');
      setMessage('');
      toast.success(t('sup_ticket_sent_toast'));
    } catch (error) {
      console.error('Error submitting support ticket:', error);
      toast.error(t('sup_ticket_send_error_toast'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 max-w-3xl mx-auto pb-20">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl shrink-0 cursor-pointer active:scale-95 transition-transform">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-foreground flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-primary" />
            {t('support')}
          </h1>
          <p className="text-[13px] text-muted-foreground font-medium">{t('sup_header_subtitle')}</p>
        </div>
      </div>

      <div className="glass-card rounded-3xl shadow-soft border border-border/70 p-4 sm:p-5 space-y-3">
        <h2 className="text-base font-serif font-black text-foreground flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-primary" />
          {t('sup_faq_title')}
        </h2>
        <div className="space-y-2">
          {FAQ_ITEMS.map((item) => (
            <FaqAccordionItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>
      </div>

      <div className="glass-card rounded-3xl shadow-soft border border-border/70 p-4 sm:p-5 space-y-1">
        <h2 className="text-base font-serif font-black text-foreground">{t('sup_report_problem_title')}</h2>
        <p className="text-[13px] text-muted-foreground">{t('sup_report_problem_desc')}</p>
        <div className="pt-2">
          {submitted ? (
            <p className="text-sm text-secondary font-bold py-4 text-center">
              {t('sup_ticket_submitted_message')}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="support_subject" className="text-xs font-bold text-foreground">{t('sup_subject_label')}</Label>
                <Input
                  id="support_subject"
                  placeholder={t('sup_subject_placeholder')}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={submitting}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="support_message" className="text-xs font-bold text-foreground">{t('prof_description')}</Label>
                <Textarea
                  id="support_message"
                  placeholder={t('sup_message_placeholder')}
                  className="h-28 resize-none rounded-xl"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto rounded-xl gap-1.5 cursor-pointer active:scale-95 transition-transform">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {t('sup_send_report_cta')}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
