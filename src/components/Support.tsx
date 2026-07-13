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

interface SupportProps {
  user: UserProfile;
  onBack: () => void;
}

const FAQ_ITEMS = [
  {
    question: "Comment fonctionne une tontine sur eganyé ?",
    answer: "Chaque membre cotise le même montant à intervalle régulier (quotidien, hebdomadaire, bi-hebdomadaire ou mensuel). À chaque cycle, un membre reçoit le pot total selon la méthode de distribution choisie (rotation, tirage au sort ou enchères)."
  },
  {
    question: "Comment rejoindre une tontine ?",
    answer: "Via un lien d'invitation, un code QR, ou un code à saisir. Votre demande doit ensuite être validée par l'administrateur du cercle avant que vous n'en deveniez membre."
  },
  {
    question: "Que se passe-t-il si je paie en retard ?",
    answer: "Si le cercle a activé les pénalités de retard, un montant fixe ou un pourcentage par jour de retard sera automatiquement ajouté à votre prochaine cotisation, après un éventuel délai de grâce."
  },
  {
    question: "Comment recharger mon portefeuille eganyé ?",
    answer: "Depuis votre Profil > Portefeuille, choisissez « Recharger » et suivez les instructions de paiement (Mobile Money : Wave, Orange Money, MTN...)."
  },
  {
    question: "Qu'est-ce que le Score de Réputation ?",
    answer: "Un score de 0 à 100 calculé selon votre ponctualité de paiement. Un score élevé renforce la confiance des autres membres et administrateurs des cercles que vous rejoignez."
  },
  {
    question: "Comment activer les notifications push ?",
    answer: "Depuis votre Profil > Paramètres > Notifications, activez l'interrupteur « Notifications push » et autorisez les notifications lorsque votre navigateur vous le demande."
  }
];

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
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error('Veuillez remplir le sujet et le message.');
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
      toast.success('Votre signalement a été envoyé !');
    } catch (error) {
      console.error('Error submitting support ticket:', error);
      toast.error("Erreur lors de l'envoi du signalement.");
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
            Support
          </h1>
          <p className="text-muted-foreground text-sm">Questions fréquentes et signalement de problème.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="w-4 h-4" />
            Questions fréquentes
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
          <CardTitle className="text-base">Signaler un problème</CardTitle>
          <CardDescription>Notre équipe examinera votre message dans les meilleurs délais.</CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <p className="text-sm text-secondary font-semibold py-4 text-center">
              Merci ! Votre signalement a bien été transmis.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="support_subject">Sujet</Label>
                <Input
                  id="support_subject"
                  placeholder="Ex: Problème de paiement, bug d'affichage..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="support_message">Description</Label>
                <Textarea
                  id="support_message"
                  placeholder="Décrivez le problème rencontré en détail..."
                  className="h-28 resize-none"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Envoyer le signalement
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
