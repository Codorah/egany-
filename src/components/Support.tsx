import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    <div className="border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left cursor-pointer hover:bg-muted transition-colors"
      >
        <span className="text-sm font-semibold">{question}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
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
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LifeBuoy className="w-6 h-6" />
            {t('support')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('sup_header_subtitle')}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="w-4 h-4" />
            {t('sup_faq_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {FAQ_ITEMS.map((item) => (
            <FaqAccordionItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('sup_report_problem_title')}</CardTitle>
          <CardDescription>{t('sup_report_problem_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <p className="text-sm text-secondary font-semibold py-4 text-center">
              {t('sup_ticket_submitted_message')}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="support_subject">{t('sup_subject_label')}</Label>
                <Input
                  id="support_subject"
                  placeholder={t('sup_subject_placeholder')}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="support_message">{t('prof_description')}</Label>
                <Textarea
                  id="support_message"
                  placeholder={t('sup_message_placeholder')}
                  className="h-28 resize-none"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                {t('sup_send_report_cta')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
