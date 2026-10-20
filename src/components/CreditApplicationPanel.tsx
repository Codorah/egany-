import React, { useRef, useState } from 'react';
import { AlertCircle, CalendarClock, CheckCircle2, Clock, Loader2, Wallet, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

interface CreditApplicationPanelProps {
  user: UserProfile;
  service: MarketplaceService;
  /** Dossiers de la personne, du plus récent au plus ancien. */
  applications: CreditApplication[];
  onChanged: () => Promise<void> | void;
  onShowTerms: () => void;
}

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Tout le parcours de l'emprunteur dans la fiche d'un service de crédit :
 * déposer un dossier, suivre son étude, répondre à l'offre, rembourser.
 */
export function CreditApplicationPanel({ user, service, applications, onChanged, onShowTerms }: CreditApplicationPanelProps) {
  const open = applications.find(isOpenApplication);
  const last = applications[0];

  if (open?.status === 'active') return <ActiveCredit app={open} user={user} onChanged={onChanged} />;
  if (open?.status === 'offered') return <OfferAnswer app={open} onChanged={onChanged} onShowTerms={onShowTerms} />;
  if (open?.status === 'submitted') return <UnderReview app={open} />;

  if (open && open.serviceId !== service.id) {
    return (
      <Notice icon={<Clock className="w-5 h-5 text-muted-foreground shrink-0" />}>
        Vous avez déjà un dossier de crédit en cours. Un seul dossier à la fois.
      </Notice>
    );
  }

  if (service.minReputationScore !== undefined && user.reputationScore < service.minReputationScore) {
    return (
      <div className="bg-danger-soft border border-danger/20 p-4 rounded-xl flex items-start gap-3">
        <XCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
        <p className="text-xs text-danger leading-relaxed">
          Ce crédit demande un score de réputation d'au moins {service.minReputationScore}. Le vôtre est de {user.reputationScore}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {last?.status === 'rejected' && (
        <Notice icon={<XCircle className="w-5 h-5 text-danger shrink-0" />}>
          Votre dossier « {last.projectTitle} » n'a pas été retenu{last.rejectionReason ? ` : ${last.rejectionReason}` : '.'} Vous pouvez en déposer un nouveau.
        </Notice>
      )}
      {last?.status === 'repaid' && (
        <Notice icon={<CheckCircle2 className="w-5 h-5 text-success shrink-0" />}>
          Votre crédit « {last.projectTitle} » est entièrement remboursé. Bravo !
        </Notice>
      )}
      <ApplicationForm user={user} service={service} onChanged={onChanged} onShowTerms={onShowTerms} />
    </div>
  );
}

function Notice({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-muted p-4 rounded-xl flex items-start gap-3 text-sm">
      {icon}
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex justify-between items-center gap-3 ${strong ? 'text-sm pt-2 border-t border-brand/10' : 'text-xs'}`}>
      <span className={strong ? 'font-bold text-foreground' : 'text-muted-foreground'}>{label}</span>
      <span className="font-bold text-foreground text-right">{value}</span>
    </div>
  );
}

// ------------------------------------------------------------- Dépôt ------

function ApplicationForm({ user, service, onChanged, onShowTerms }: Omit<CreditApplicationPanelProps, 'applications'>) {
  const cap = creditCap(user.totalSaved);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [months, setMonths] = useState('6');
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Même clé tant que la personne réessaie le même envoi : un double appui ou
  // un rejeu réseau ne crée jamais deux demandes.
  const idempotencyKey = useRef<string>(crypto.randomUUID());

  const submit = async () => {
    const value = Number(amount);
    const duration = Number(months);
    if (title.trim().length < 3) return toast.error('Donnez un nom à votre projet.');
    if (description.trim().length < 20) return toast.error('Expliquez votre projet en quelques phrases.');
    if (!value || value <= 0) return toast.error('Indiquez le montant dont vous avez besoin.');
    if (value > cap) return toast.error(`Le montant ne peut pas dépasser ${fcfa(cap)} pour le moment.`);
    if (!duration || duration < CREDIT_MIN_MONTHS || duration > CREDIT_MAX_MONTHS) {
      return toast.error(`Choisissez une durée entre ${CREDIT_MIN_MONTHS} et ${CREDIT_MAX_MONTHS} mois.`);
    }
    if (!accepted) return toast.error('Cochez la case pour accepter les conditions.');

    setSubmitting(true);
    const result = await submitCreditApplication({
      serviceId: service.id,
      projectTitle: title.trim(),
      projectDescription: description.trim(),
      requestedAmount: Math.round(value),
      requestedMonths: duration,
      idempotencyKey: idempotencyKey.current,
    });
    setSubmitting(false);
    if (!result.success) return toast.error(result.message);
    toast.success(result.message);
    await onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="credit-title" className="text-xs font-bold">Nom de votre projet</Label>
        <Input id="credit-title" maxLength={120} placeholder="Ex. : agrandir mon étal de légumes" value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl h-11" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="credit-desc" className="text-xs font-bold">À quoi servira l'argent ?</Label>
        <Textarea
          id="credit-desc"
          maxLength={4000}
          rows={4}
          placeholder="Ce que vous allez acheter, comment ça va rapporter, comment vous allez rembourser…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-xl"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="credit-amount" className="text-xs font-bold">Montant (FCFA)</Label>
          <Input id="credit-amount" type="number" inputMode="numeric" min={1} max={cap} placeholder={`Jusqu'à ${cap.toLocaleString('fr-FR')}`} value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="credit-months" className="text-xs font-bold">Rembourser en (mois)</Label>
          <Input id="credit-months" type="number" inputMode="numeric" min={CREDIT_MIN_MONTHS} max={CREDIT_MAX_MONTHS} value={months} onChange={(e) => setMonths(e.target.value)} className="rounded-xl h-11" />
        </div>
      </div>
      <p className="text-[12px] text-muted-foreground -mt-2">
        Plafond indicatif d'après votre épargne dans vos cercles : {fcfa(cap)}. L'équipe fixe le montant final, le taux et la durée dans son offre.
      </p>

      <CreditCostDisclosure />

      <div className="bg-brand/5 border border-brand/20 p-4 rounded-xl space-y-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-brand shrink-0 mt-0.5" />
          <p className="text-xs text-brand-deep leading-relaxed">
            La demande est <strong>gratuite</strong>. Vous ne vous engagez à rien tant que vous n'avez pas accepté l'offre de l'équipe.
          </p>
        </div>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-border text-[#C96F4A] cursor-pointer" />
          <span className="text-xs text-foreground leading-relaxed">
            J'ai lu{' '}
            <button type="button" onClick={onShowTerms} className="font-bold underline cursor-pointer">les conditions du microcrédit</button>.
          </span>
        </label>
      </div>

      <Button className="btn-shine w-full h-12 text-base font-bold rounded-xl" onClick={submit} disabled={submitting}>
        {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Envoi de la demande…</> : 'Envoyer ma demande'}
      </Button>
    </div>
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
    <div className="rounded-xl border border-border p-3 space-y-1.5 text-[12px] text-muted-foreground leading-relaxed">
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

function UnderReview({ app }: { app: CreditApplication }) {
  return (
    <div className="space-y-3">
      <Notice icon={<Clock className="w-5 h-5 text-warning shrink-0" />}>
        Votre demande « {app.projectTitle} » est en cours d'étude par notre équipe. Vous recevrez une notification dès qu'une décision sera prise.
      </Notice>
      <div className="bg-brand/5 border border-brand/20 rounded-2xl p-4 space-y-2.5">
        <Row label="Montant demandé" value={fcfa(app.requestedAmount)} />
        <Row label="Durée souhaitée" value={`${app.requestedMonths} mois`} />
        <Row label="Envoyée le" value={dateFr(app.createdAt)} />
      </div>
    </div>
  );
}

// ----------------------------------------------------------- Offre --------

function OfferAnswer({ app, onChanged, onShowTerms }: { app: CreditApplication; onChanged: () => Promise<void> | void; onShowTerms: () => void }) {
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [agreed, setAgreed] = useState(false);
  const total = app.totalDue ?? 0;
  const months = app.durationMonths ?? 1;
  const monthly = Math.floor(total / months);
  const interest = total - (app.offeredAmount ?? 0);

  const answer = async (kind: 'accept' | 'decline') => {
    if (kind === 'accept' && !agreed) return toast.error('Cochez la case pour accepter l’offre.');
    setBusy(kind);
    const result = kind === 'accept' ? await acceptCreditOffer(app.id) : await declineCreditOffer(app.id);
    setBusy(null);
    if (!result.success) return toast.error(result.message);
    toast.success(result.message);
    await onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="bg-success-soft border border-success/20 p-4 rounded-xl flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
        <p className="text-sm leading-relaxed">Bonne nouvelle : notre équipe vous fait une offre pour « {app.projectTitle} ».</p>
      </div>

      <div className="bg-brand/5 border border-brand/20 rounded-2xl p-4 space-y-2.5">
        <Row label="Vous recevez" value={fcfa(app.offeredAmount ?? 0)} />
        <Row label={`Intérêts (${app.interestRate ?? 0} %, soit ${annualRate(app.interestRate ?? 0, months)} % par an)`} value={fcfa(interest)} />
        <Row label="Durée" value={`${months} mois`} />
        <Row label="Mensualité" value={months > 1 ? `${fcfa(monthly)} environ` : fcfa(total)} />
        <Row label="Total à rembourser" value={fcfa(total)} strong />
      </div>
      {app.adminNotes && <p className="text-xs text-muted-foreground leading-relaxed">Message de l'équipe : {app.adminNotes}</p>}
      <p className="text-xs text-muted-foreground leading-relaxed">
        Chaque mensualité est prélevée automatiquement sur votre portefeuille à sa date. Gardez le solde nécessaire.
      </p>

      <label className="flex items-start gap-2.5 cursor-pointer">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-border text-[#C96F4A] cursor-pointer" />
        <span className="text-xs text-foreground leading-relaxed">
          Je m'engage à rembourser {fcfa(total)} en {months} mois, selon{' '}
          <button type="button" onClick={onShowTerms} className="font-bold underline cursor-pointer">les conditions du microcrédit</button>.
        </span>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-12 rounded-xl font-bold" onClick={() => answer('decline')} disabled={busy !== null}>
          {busy === 'decline' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refuser'}
        </Button>
        <Button className="btn-shine h-12 rounded-xl font-bold" onClick={() => answer('accept')} disabled={busy !== null}>
          {busy === 'accept' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Accepter'}
        </Button>
      </div>
    </div>
  );
}

// -------------------------------------------------------- En cours --------

function ActiveCredit({ app, user, onChanged }: { app: CreditApplication; user: UserProfile; onChanged: () => Promise<void> | void }) {
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
    <div className="space-y-4">
      <div className="bg-brand/5 border border-brand/20 rounded-2xl p-4 space-y-2.5">
        <p className="text-sm font-bold text-foreground">{app.projectTitle}</p>
        <Row label="Montant reçu" value={<AmountDisplay amount={app.offeredAmount ?? 0} size="sm" />} />
        <Row label="Déjà remboursé" value={<AmountDisplay amount={app.repaidAmount} size="sm" className="text-secondary" />} />
        <Row label="Reste à rembourser" value={<AmountDisplay amount={remaining} size="sm" className="text-brand" />} strong />
        {next && (
          <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground pt-1">
            <CalendarClock className="w-3.5 h-3.5" />
            Prochaine mensualité : {fcfa(next.amountDue - next.amountPaid)} le {dateFr(next.dueDate)}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-wider text-foreground">Échéancier</p>
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {app.installments.map((inst) => (
            <li key={inst.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs">
              <span className="text-muted-foreground">{inst.number}. {dateFr(inst.dueDate)}</span>
              <span className="font-bold text-foreground">{fcfa(inst.amountDue)}</span>
              <span className={`px-2 py-0.5 rounded-full font-bold ${statusLook[inst.status]}`}>{statusText[inst.status]}</span>
            </li>
          ))}
        </ul>
        <p className="text-[12px] text-muted-foreground">Chaque mensualité est prélevée automatiquement à sa date si votre portefeuille le permet. Vous pouvez aussi rembourser en avance.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="credit-repay" className="text-xs font-bold">Rembourser maintenant</Label>
        <Input id="credit-repay" type="number" inputMode="numeric" min={1} max={remaining} value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl h-11" />
        <p className="text-[12px] text-muted-foreground">Solde du portefeuille : {fcfa(user.walletBalance)}</p>
      </div>
      <Button className="btn-shine w-full h-12 text-base font-bold rounded-xl" onClick={repay} disabled={busy}>
        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wallet className="w-4 h-4 mr-2" />}
        Rembourser
      </Button>
    </div>
  );
}
