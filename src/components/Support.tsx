import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ChevronDown, Loader2 } from 'lucide-react';
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
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full min-h-[52px] flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer active:bg-muted transition-colors duration-150"
      >
        <span className="text-[15px] font-semibold text-foreground">{question}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{answer}</div>
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
    <div className="space-y-6 max-w-2xl mx-auto pb-20">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour"
          className="w-11 h-11 -ml-2 rounded-xl flex items-center justify-center text-foreground active:bg-muted cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-foreground">{t('support')}</h1>
      </div>

      <section className="space-y-2">
        <h2 className="text-[13px] font-bold text-muted-foreground px-3">{t('sup_faq_title')}</h2>
        <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
          {FAQ_ITEMS.map((item) => (
            <FaqAccordionItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="px-3">
          <h2 className="text-base font-bold text-foreground">{t('sup_report_problem_title')}</h2>
          <p className="text-sm text-muted-foreground">{t('sup_report_problem_desc')}</p>
        </div>
        <div>
          {submitted ? (
            <p className="text-sm text-secondary font-bold py-4 text-center">
              {t('sup_ticket_submitted_message')}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="support_subject" className="text-sm font-bold text-foreground">{t('sup_subject_label')}</Label>
                <Input
                  id="support_subject"
                  placeholder={t('sup_subject_placeholder')}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={submitting}
                  className="rounded-xl h-12 text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="support_message" className="text-sm font-bold text-foreground">{t('prof_description')}</Label>
                <Textarea
                  id="support_message"
                  placeholder={t('sup_message_placeholder')}
                  className="h-28 resize-none rounded-xl text-base"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full h-12 rounded-xl gap-1.5 font-bold cursor-pointer">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('sup_send_report_cta')}
              </Button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
