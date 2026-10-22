import React, { useCallback, useRef, useState } from 'react';
import { CalendarClock, CheckCircle2, Clock, Loader2, Wallet, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AmountField, FlowCheckbox, FlowNotice, FlowRow, FlowScreen } from '@/components/ui/FlowScreen';
import { AmountDisplay } from './ui/AmountDisplay';
import { MarketplaceService, UserProfile } from '@/types';
import {
  CREDIT_MAX_ANNUAL_RATE,
  CREDIT_MAX_MONTHS,
  CREDIT_MAX_RATE,
  CREDIT_MIN_MONTHS,
  CreditApplication,
  acceptCreditOffer,
  annualRate,
  creditCap,
  declineCreditOffer,
  isOpenApplication,
  nextInstallment,
  remainingDue,
  repayCredit,
  submitCreditApplication,
} from '@/lib/credit';

interface CreditFlowProps {
  user: UserProfile;
  service: MarketplaceService;
  /** Icône du service, reprise dans le bandeau de présentation. */
  icon: React.ComponentType<{ className?: string }>;
  /** Dossiers de la personne, du plus récent au plus ancien. */
  applications: CreditApplication[];
  onChanged: () => Promise<void> | void;
  onShowTerms: () => void;
  onClose: () => void;
}

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const MONTH_CHOICES = [3, 6, 9, 12, 18, 24].filter((m) => m >= CREDIT_MIN_MONTHS && m <= CREDIT_MAX_MONTHS);

/**
 * Tout le parcours de l'emprunteur, en écrans plein écran : déposer un
 * dossier étape par étape, suivre son étude, répondre à l'offre, rembourser.
 */
export function CreditFlow(props: CreditFlowProps) {
  const { user, service, applications, onClose } = props;
  const open = applications.find(isOpenApplication);
  // Juste après l'envoi, le dossier passe « en étude » : on garde l'écran de
  // confirmation du parcours au lieu de basculer sur le suivi.
  const [justSent, setJustSent] = useState(false);

  if (justSent) return <ApplicationFlow {...props} onSent={() => setJustSent(true)} />;
  if (open?.status === 'active') return <ActiveCredit {...props} app={open} />;
  if (open?.status === 'offered') return <OfferAnswer {...props} app={open} />;
  if (open?.status === 'submitted') return <UnderReview app={open} title={service.title} onClose={onClose} />;

  if (open && open.serviceId !== service.id) {
    return (
      <InfoScreen title={service.title} heading="Un dossier est déjà en cours" onClose={onClose}>
        <FlowNotice icon={<Clock className="w-5 h-5 text-muted-foreground" />}>
          Vous avez déjà un dossier de crédit en cours. Un seul dossier à la fois.
        </FlowNotice>
      </InfoScreen>
    );
  }

  if (service.minReputationScore !== undefined && user.reputationScore < service.minReputationScore) {
    return (
      <InfoScreen title={service.title} heading="Pas encore accessible" onClose={onClose}>
        <FlowNotice tone="danger" icon={<XCircle className="w-5 h-5 text-danger" />}>
          Ce crédit demande un score de réputation d'au moins {service.minReputationScore}. Le vôtre est de {user.reputationScore}. Cotisez régulièrement dans vos cercles pour l'augmenter.
        </FlowNotice>
      </InfoScreen>
    );
  }

  return <ApplicationFlow {...props} onSent={() => setJustSent(true)} />;
}

function InfoScreen({ title, heading, onClose, children }: { title: string; heading: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <FlowScreen
      onBack={onClose}
      title={title}
      heading={heading}
      footer={<Button variant="outline" className="w-full h-13 text-base font-bold rounded-2xl" onClick={onClose}>Fermer</Button>}
    >
      {children}
    </FlowScreen>
  );
}

// ------------------------------------------------------------- Dépôt ------

const STEPS = ['amount', 'project', 'review'] as const;
type Step = 'intro' | (typeof STEPS)[number] | 'done';

function ApplicationFlow({ user, service, icon: Icon, applications, onChanged, onShowTerms, onClose, onSent }: CreditFlowProps & { onSent: () => void }) {
  const last = applications[0];
  const cap = creditCap(user.totalSaved);
  const [step, setStep] = useState<Step>('intro');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [months, setMonths] = useState(6);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Même clé tant que la personne réessaie le même envoi : un double appui ou
  // un rejeu réseau ne crée jamais deux demandes.
  const idempotencyKey = useRef<string>(crypto.randomUUID());

  const value = Number(amount);
  const valid = {
    amount: value > 0 && value <= cap,
    project: title.trim().length >= 3 && description.trim().length >= 20,
    review: accepted,
  };

  const goBack = useCallback(() => {
    if (submitting) return;
    if (step === 'intro' || step === 'done') return onClose();
    const i = STEPS.indexOf(step);
    setStep(i <= 0 ? 'intro' : STEPS[i - 1]);
  }, [step, submitting, onClose]);

  const next = () => {
    if (step === 'intro') return setStep('amount');
    const i = STEPS.indexOf(step as (typeof STEPS)[number]);
    if (i >= 0 && i < STEPS.length - 1) setStep(STEPS[i + 1]);
  };

  const submit = async () => {
    if (!valid.amount || !valid.project || !valid.review) return;
    setSubmitting(true);
    const result = await submitCreditApplication({
      serviceId: service.id,
      projectTitle: title.trim(),
      projectDescription: description.trim(),
      requestedAmount: Math.round(value),
      requestedMonths: months,
      idempotencyKey: idempotencyKey.current,
    });
    setSubmitting(false);
    if (!result.success) return toast.error(result.message);
    setStep('done');
    onSent();
    await onChanged();
  };

  const stepNumber = STEPS.indexOf(step as (typeof STEPS)[number]) + 1;
  const common = { onBack: goBack, title: service.title, ...(stepNumber > 0 ? { step: stepNumber, totalSteps: STEPS.length } : {}) };
  const nextButton = (enabled: boolean, label = 'Suivant') => (
    <Button className="btn-shine w-full h-13 text-base font-bold rounded-2xl" onClick={next} disabled={!enabled}>{label}</Button>
  );

  if (step === 'done') {
    return (
      <FlowScreen {...common} footer={<Button className="w-full h-13 text-base font-bold rounded-2xl" onClick={onClose}>Terminé</Button>}>
        <div className="flex flex-col items-center text-center pt-8 space-y-4">
          <div className="w-20 h-20 rounded-full bg-success-soft flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>
          <h1 className="text-[24px] font-serif font-bold text-foreground">Demande envoyée</h1>
          <p className="text-[14px] text-muted-foreground leading-relaxed max-w-xs">
            Notre équipe étudie votre demande de {fcfa(value)} sur {months} mois. Si elle est acceptée, vous recevrez une offre à accepter ou refuser : rien n'est engagé avant.
          </p>
        </div>
      </FlowScreen>
    );
  }

  if (step === 'intro') {
    return (
      <FlowScreen
        {...common}
        hero={
          <div className={`${service.colorClass} px-5 py-7 text-white`}>
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
              <Icon className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-[26px] leading-tight font-serif font-bold">{service.title}</h1>
            <p className="mt-1.5 text-[14px] opacity-90 font-medium">{service.provider}</p>
          </div>
        }
        footer={nextButton(true, 'Faire une demande')}
      >
        {last?.status === 'rejected' && (
          <FlowNotice tone="danger" icon={<XCircle className="w-5 h-5 text-danger" />}>
            Votre dossier « {last.projectTitle} » n'a pas été retenu{last.rejectionReason ? ` : ${last.rejectionReason}` : '.'} Vous pouvez en déposer un nouveau.
          </FlowNotice>
        )}
        {last?.status === 'repaid' && (
          <FlowNotice tone="success" icon={<CheckCircle2 className="w-5 h-5 text-success" />}>
            Votre crédit « {last.projectTitle} » est entièrement remboursé. Bravo !
          </FlowNotice>
        )}

        <p className="text-[15px] text-foreground leading-relaxed">{service.description}</p>

        {service.requirements && service.requirements.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">Conditions</p>
            {service.requirements.map((req, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-sm text-foreground">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                {req}
              </div>
            ))}
          </div>
        )}

        <FlowNotice tone="brand">
          La demande est <strong>gratuite</strong>. Vous ne vous engagez à rien tant que vous n'avez pas accepté l'offre de l'équipe.
        </FlowNotice>

        <CreditCostDisclosure />
      </FlowScreen>
    );
  }

  if (step === 'amount') {
    return (
      <FlowScreen
        {...common}
        heading="Combien et sur combien de temps ?"
        desc={`D'après votre épargne dans vos cercles, vous pouvez demander jusqu'à ${fcfa(cap)}. L'équipe fixe le montant final, le taux et la durée dans son offre.`}
        footer={nextButton(valid.amount)}
      >
        <AmountField value={amount} onChange={setAmount} suggestions={[25000, 50000, 100000, 200000]} max={cap} autoFocus />
        {value > cap && (
          <p className="text-[13px] text-danger font-medium">Le montant ne peut pas dépasser {fcfa(cap)} pour le moment.</p>
        )}
        <div className="space-y-2.5">
          <p className="text-sm font-bold text-foreground">Rembourser en</p>
          <div className="grid grid-cols-3 gap-2">
            {MONTH_CHOICES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonths(m)}
                className={`h-12 rounded-2xl border-2 text-sm font-bold cursor-pointer transition-colors ${
                  months === m ? 'border-brand bg-brand/10 text-brand' : 'border-border text-foreground'
                }`}
              >
                {m} mois
              </button>
            ))}
          </div>
        </div>
      </FlowScreen>
    );
  }

  if (step === 'project') {
    const missing = 20 - description.trim().length;
    return (
      <FlowScreen
        {...common}
        heading="Votre projet"
        desc="Expliquez simplement à quoi servira l'argent et comment vous rembourserez."
        footer={nextButton(valid.project)}
      >
        <div className="space-y-2">
          <Label htmlFor="credit-title" className="text-sm font-bold">Nom du projet</Label>
          <Input id="credit-title" maxLength={120} placeholder="Ex. : agrandir mon étal de légumes" value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-2xl h-13 text-base" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="credit-desc" className="text-sm font-bold">À quoi servira l'argent ?</Label>
          <Textarea
            id="credit-desc"
            maxLength={4000}
            rows={6}
            placeholder="Ce que vous allez acheter, comment ça va rapporter, comment vous allez rembourser…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-2xl text-base"
          />
          <p className="text-[12px] text-muted-foreground">
            {missing > 0 ? `Encore ${missing} caractère${missing > 1 ? 's' : ''} au minimum.` : 'C’est bon.'}
          </p>
        </div>
      </FlowScreen>
    );
  }

  return (
    <FlowScreen
      {...common}
      heading="Vérifiez votre demande"
      desc="Touchez « Modifier » pour corriger une réponse."
      footer={
        <Button className="btn-shine w-full h-13 text-base font-bold rounded-2xl" onClick={submit} disabled={!valid.review || submitting}>
          {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Envoi de la demande…</> : 'Envoyer ma demande'}
        </Button>
      }
    >
      <div className="rounded-2xl border border-border px-4 divide-y divide-border">
        <FlowRow label="Montant" value={fcfa(value)} onEdit={() => setStep('amount')} />
        <FlowRow label="Durée" value={`${months} mois`} onEdit={() => setStep('amount')} />
        <FlowRow label="Projet" value={title.trim()} onEdit={() => setStep('project')} />
        <FlowRow label="Frais de demande" value="Gratuit" strong />
      </div>

      <FlowCheckbox checked={accepted} onChange={setAccepted}>
        J'ai lu{' '}
        <button type="button" onClick={(e) => { e.preventDefault(); onShowTerms(); }} className="font-bold underline cursor-pointer">
          les conditions du microcrédit
        </button>.
      </FlowCheckbox>
    </FlowScreen>
  );
}

/**
 * Ce que Google Play exige d'afficher pour un prêt personnel : durées
 * minimum et maximum, taux annuel maximum et un exemple de coût total.
 */
export function CreditCostDisclosure() {
  const exampleAmount = 50000;
  const exampleMonths = 6;
  const exampleRate = 10;
  const exampleTotal = exampleAmount + Math.round((exampleAmount * exampleRate) / 100);
  return (
    <div className="rounded-2xl border border-border p-4 space-y-1.5 text-[13px] text-muted-foreground leading-relaxed">
      <p className="font-bold text-foreground">Coût du crédit</p>
      <p>
        Durée de remboursement : de {CREDIT_MIN_MONTHS} à {CREDIT_MAX_MONTHS} mois. Intérêt simple, sans autres frais : taux annuel maximum {CREDIT_MAX_ANNUAL_RATE} %, et
        jamais plus de {CREDIT_MAX_RATE} % du montant prêté sur toute la durée.
      </p>
      <p>
        Exemple : {fcfa(exampleAmount)} sur {exampleMonths} mois à {exampleRate} % (taux annuel {annualRate(exampleRate, exampleMonths)} %), soit {fcfa(exampleTotal)} à
        rembourser en tout, environ {fcfa(Math.floor(exampleTotal / exampleMonths))} par mois.
      </p>
    </div>
  );
}

// --------------------------------------------------------- En étude -------

function UnderReview({ app, title, onClose }: { app: CreditApplication; title: string; onClose: () => void }) {
  return (
    <FlowScreen
      onBack={onClose}
      title={title}
      heading="Demande en cours d'étude"
      desc="Vous recevrez une notification dès qu'une décision sera prise."
      footer={<Button variant="outline" className="w-full h-13 text-base font-bold rounded-2xl" onClick={onClose}>Fermer</Button>}
    >
      <FlowNotice tone="warning" icon={<Clock className="w-5 h-5 text-warning" />}>
        « {app.projectTitle} » est entre les mains de notre équipe.
      </FlowNotice>
      <div className="rounded-2xl border border-border px-4 divide-y divide-border">
        <FlowRow label="Montant demandé" value={fcfa(app.requestedAmount)} />
        <FlowRow label="Durée souhaitée" value={`${app.requestedMonths} mois`} />
        <FlowRow label="Envoyée le" value={dateFr(app.createdAt)} />
      </div>
    </FlowScreen>
  );
}

// ----------------------------------------------------------- Offre --------

function OfferAnswer({ app, service, onChanged, onShowTerms, onClose }: CreditFlowProps & { app: CreditApplication }) {
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [agreed, setAgreed] = useState(false);
  const total = app.totalDue ?? 0;
  const months = app.durationMonths ?? 1;
  const monthly = Math.floor(total / months);
  const interest = total - (app.offeredAmount ?? 0);

  const answer = async (kind: 'accept' | 'decline') => {
    if (kind === 'accept' && !agreed) return;
    setBusy(kind);
    const result = kind === 'accept' ? await acceptCreditOffer(app.id) : await declineCreditOffer(app.id);
    setBusy(null);
    if (!result.success) return toast.error(result.message);
    toast.success(result.message);
    await onChanged();
  };

  return (
    <FlowScreen
      onBack={onClose}
      title={service.title}
      heading="Une offre vous attend"
      desc={`Notre équipe vous fait une offre pour « ${app.projectTitle} ».`}
      footer={
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button variant="outline" className="h-13 rounded-2xl font-bold" onClick={() => answer('decline')} disabled={busy !== null}>
            {busy === 'decline' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refuser'}
          </Button>
          <Button className="btn-shine h-13 rounded-2xl font-bold text-base" onClick={() => answer('accept')} disabled={busy !== null || !agreed}>
            {busy === 'accept' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Accepter l’offre'}
          </Button>
        </div>
      }
    >
      <div className="rounded-3xl bg-success-soft border border-success/20 p-5 text-center">
        <p className="text-[13px] font-bold text-muted-foreground">Vous recevez</p>
        <p className="text-[34px] font-black text-foreground tabular-nums leading-tight">{fcfa(app.offeredAmount ?? 0)}</p>
      </div>

      <div className="rounded-2xl border border-border px-4 divide-y divide-border">
        <FlowRow label={`Intérêts (${app.interestRate ?? 0} %, soit ${annualRate(app.interestRate ?? 0, months)} % par an)`} value={fcfa(interest)} />
        <FlowRow label="Durée" value={`${months} mois`} />
        <FlowRow label="Mensualité" value={months > 1 ? `${fcfa(monthly)} environ` : fcfa(total)} />
        <FlowRow label="Total à rembourser" value={fcfa(total)} strong />
      </div>
      {app.adminNotes && <FlowNotice>Message de l'équipe : {app.adminNotes}</FlowNotice>}
      <p className="text-[13px] text-muted-foreground leading-relaxed">
        Chaque mensualité est prélevée automatiquement sur votre portefeuille à sa date. Gardez le solde nécessaire.
      </p>

      <FlowCheckbox checked={agreed} onChange={setAgreed}>
        Je m'engage à rembourser {fcfa(total)} en {months} mois, selon{' '}
        <button type="button" onClick={(e) => { e.preventDefault(); onShowTerms(); }} className="font-bold underline cursor-pointer">
          les conditions du microcrédit
        </button>.
      </FlowCheckbox>
    </FlowScreen>
  );
}

// -------------------------------------------------------- En cours --------

function ActiveCredit({ app, user, service, onChanged, onClose }: CreditFlowProps & { app: CreditApplication }) {
  const remaining = remainingDue(app);
  const next = nextInstallment(app);
  const [amount, setAmount] = useState(next ? String(next.amountDue - next.amountPaid) : '');
  const [busy, setBusy] = useState(false);
  const key = useRef<{ amount: string; key: string } | null>(null);

  const repay = async () => {
    const value = Math.round(Number(amount));
    if (!value || value <= 0) return toast.error('Indiquez le montant à rembourser.');
    if (value > remaining) return toast.error(`Il ne vous reste que ${fcfa(remaining)} à rembourser.`);
    if (value > user.walletBalance) return toast.error('Solde insuffisant dans votre portefeuille.');
    if (key.current?.amount !== amount) key.current = { amount, key: crypto.randomUUID() };
    setBusy(true);
    const result = await repayCredit(app.id, value, key.current.key);
    setBusy(false);
    if (!result.success) return toast.error(result.message);
    key.current = null;
    toast.success(result.message);
    await onChanged();
  };

  const statusLook = {
    paid: 'bg-success-soft text-secondary',
    late: 'bg-danger-soft text-danger',
    pending: 'bg-muted text-muted-foreground',
  } as const;
  const statusText = { paid: 'Payée', late: 'En retard', pending: 'À venir' } as const;

  return (
    <FlowScreen
      onBack={onClose}
      title={service.title}
      footer={
        <Button className="btn-shine w-full h-13 text-base font-bold rounded-2xl" onClick={repay} disabled={busy || !amount}>
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wallet className="w-4 h-4 mr-2" />}
          Rembourser {amount ? fcfa(Number(amount)) : ''}
        </Button>
      }
    >
      <div className="rounded-3xl gradient-sunset p-5 text-white">
        <p className="text-[13px] font-bold opacity-90">{app.projectTitle} · reste à rembourser</p>
        <p className="text-[34px] font-black tabular-nums leading-tight">{fcfa(remaining)}</p>
        {next && (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium opacity-95">
            <CalendarClock className="w-4 h-4" />
            Prochaine mensualité : {fcfa(next.amountDue - next.amountPaid)} le {dateFr(next.dueDate)}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border px-4 divide-y divide-border">
        <FlowRow label="Montant reçu" value={<AmountDisplay amount={app.offeredAmount ?? 0} size="sm" />} />
        <FlowRow label="Déjà remboursé" value={<AmountDisplay amount={app.repaidAmount} size="sm" className="text-secondary" />} />
      </div>

      <div className="space-y-2">
        <p className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">Échéancier</p>
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {app.installments.map((inst) => (
            <li key={inst.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="text-muted-foreground">{inst.number}. {dateFr(inst.dueDate)}</span>
              <span className="font-bold text-foreground">{fcfa(inst.amountDue)}</span>
              <span className={`px-2 py-0.5 rounded-full text-[12px] font-bold ${statusLook[inst.status]}`}>{statusText[inst.status]}</span>
            </li>
          ))}
        </ul>
        <p className="text-[12px] text-muted-foreground">Chaque mensualité est prélevée automatiquement à sa date si votre portefeuille le permet. Vous pouvez aussi rembourser en avance.</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-bold text-foreground">Rembourser maintenant</p>
        <AmountField value={amount} onChange={setAmount} max={remaining} />
        <p className="text-[12px] text-muted-foreground text-center">Solde du portefeuille : {fcfa(user.walletBalance)}</p>
      </div>
    </FlowScreen>
  );
}
