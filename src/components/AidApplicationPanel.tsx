import React, { useCallback, useRef, useState } from 'react';
import { CheckCircle2, Clock, Gift, Link2, Loader2, Upload, Video, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AmountField, FlowCheckbox, FlowNotice, FlowRow, FlowScreen } from '@/components/ui/FlowScreen';
import { UserProfile } from '@/types';
import { AID_MAX_AMOUNT, AidApplication, submitAidApplication, uploadAidVideo } from '@/lib/aid';

interface AidFlowProps {
  user: UserProfile;
  /** Dossiers de la personne, du plus récent au plus ancien. */
  applications: AidApplication[];
  applicationFee: number;
  onChanged: () => Promise<void> | void;
  onShowTerms: () => void;
  onClose: () => void;
}

const TITLE = 'Coup de pouce';
const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const STEPS = ['amount', 'project', 'video', 'review'] as const;
type Step = 'intro' | (typeof STEPS)[number] | 'done';

/**
 * Le parcours « Coup de pouce », écran par écran : présentation, montant,
 * activité, vidéo, récapitulatif avec les frais d'étude, puis confirmation.
 * Un dossier déjà déposé affiche son suivi à la place.
 */
export function AidFlow({ user, applications, applicationFee, onChanged, onShowTerms, onClose }: AidFlowProps) {
  const pending = applications.find((a) => a.status === 'submitted');
  const last = applications[0];

  const [step, setStep] = useState<Step>('intro');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [videoMode, setVideoMode] = useState<'upload' | 'link'>('upload');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoLink, setVideoLink] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [sending, setSending] = useState<'idle' | 'uploading' | 'submitting'>('idle');
  // Même clé tant que la personne réessaie le même envoi : un double appui ou
  // un rejeu réseau ne prélève jamais deux fois les frais.
  const idempotencyKey = useRef<string>(crypto.randomUUID());
  const uploadedPath = useRef<{ file: File; path: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const value = Number(amount);
  const notEnoughForFee = user.walletBalance < applicationFee;
  const linkOk = /^https:\/\/\S+$/i.test(videoLink.trim());
  const valid = {
    amount: value > 0 && value <= AID_MAX_AMOUNT,
    project: title.trim().length >= 3 && description.trim().length >= 20,
    video: videoMode === 'upload' ? !!videoFile : linkOk,
    review: accepted && !notEnoughForFee,
  };

  const goBack = useCallback(() => {
    if (sending !== 'idle') return;
    if (step === 'intro' || step === 'done') return onClose();
    const i = STEPS.indexOf(step);
    setStep(i <= 0 ? 'intro' : STEPS[i - 1]);
  }, [step, sending, onClose]);

  const next = () => {
    if (step === 'intro') return setStep('amount');
    const i = STEPS.indexOf(step as (typeof STEPS)[number]);
    if (i >= 0 && i < STEPS.length - 1) setStep(STEPS[i + 1]);
  };

  const submit = async () => {
    if (!valid.amount || !valid.project || !valid.video || !valid.review) return;

    let videoPath: string | undefined;
    if (videoMode === 'upload' && videoFile) {
      if (uploadedPath.current?.file === videoFile) {
        videoPath = uploadedPath.current.path;
      } else {
        setSending('uploading');
        const res = await uploadAidVideo(user.uid, videoFile);
        if (res.error || !res.path) {
          setSending('idle');
          return toast.error(res.error || 'Échec de l’envoi de la vidéo.');
        }
        uploadedPath.current = { file: videoFile, path: res.path };
        videoPath = res.path;
      }
    }

    setSending('submitting');
    const result = await submitAidApplication({
      projectTitle: title.trim(),
      projectDescription: description.trim(),
      requestedAmount: Math.round(value),
      videoPath,
      videoUrl: videoMode === 'link' ? videoLink.trim() : undefined,
      idempotencyKey: idempotencyKey.current,
    });
    setSending('idle');
    if (!result.success) return toast.error(result.message);
    setStep('done');
    await onChanged();
  };

  const stepNumber = STEPS.indexOf(step as (typeof STEPS)[number]) + 1;
  const common = { onBack: goBack, title: TITLE, ...(stepNumber > 0 ? { step: stepNumber, totalSteps: STEPS.length } : {}) };
  const nextButton = (enabled: boolean, label = 'Suivant') => (
    <Button className="btn-shine w-full h-13 text-base font-bold rounded-2xl" onClick={next} disabled={!enabled}>
      {label}
    </Button>
  );

  // ---------------------------------------------------------- Confirmation
  if (step === 'done') {
    return (
      <FlowScreen
        {...common}
        footer={<Button className="w-full h-13 text-base font-bold rounded-2xl" onClick={onClose}>Terminé</Button>}
      >
        <div className="flex flex-col items-center text-center pt-8 space-y-4">
          <div className="w-20 h-20 rounded-full bg-success-soft flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>
          <h1 className="text-[24px] font-serif font-bold text-foreground">Dossier déposé</h1>
          <p className="text-[14px] text-muted-foreground leading-relaxed max-w-xs">
            Notre équipe va regarder votre vidéo et étudier votre demande de {fcfa(value)}. Vous recevrez une notification dès qu'une décision sera prise.
          </p>
        </div>
      </FlowScreen>
    );
  }

  // ------------------------------------------------------ Dossier en cours
  if (pending) {
    return (
      <FlowScreen
        {...common}
        heading="Dossier en cours d'étude"
        desc="Vous recevrez une notification dès qu'une décision sera prise."
        footer={<Button variant="outline" className="w-full h-13 text-base font-bold rounded-2xl" onClick={onClose}>Fermer</Button>}
      >
        <FlowNotice tone="warning" icon={<Clock className="w-5 h-5 text-warning" />}>
          « {pending.projectTitle} » est entre les mains de notre équipe.
        </FlowNotice>
        <div className="rounded-2xl border border-border px-4 divide-y divide-border">
          <FlowRow label="Montant demandé" value={fcfa(pending.requestedAmount)} />
          <FlowRow label="Déposé le" value={dateFr(pending.createdAt)} />
          <FlowRow label="Frais d'étude réglés" value={fcfa(pending.applicationFee)} />
        </div>
      </FlowScreen>
    );
  }

  // ---------------------------------------------------------- Présentation
  if (step === 'intro') {
    return (
      <FlowScreen
        {...common}
        hero={
          <div className="gradient-sunset px-5 py-7 text-white">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
              <Gift className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-[26px] leading-tight font-serif font-bold">Une aide pour votre activité</h1>
            <p className="mt-1.5 text-[14px] opacity-90 font-medium">Gratuite, rien à rembourser.</p>
          </div>
        }
        footer={nextButton(true, 'Commencer')}
      >
        {last?.status === 'granted' && (
          <FlowNotice tone="success" icon={<Gift className="w-5 h-5 text-success" />}>
            Vous avez reçu {fcfa(last.grantedAmount ?? 0)} pour « {last.projectTitle} ». C'est une aide : rien à rembourser.
            {last.adminNotes ? ` Message de l'équipe : ${last.adminNotes}` : ''}
          </FlowNotice>
        )}
        {last?.status === 'rejected' && (
          <FlowNotice tone="danger" icon={<XCircle className="w-5 h-5 text-danger" />}>
            Votre dossier « {last.projectTitle} » n'a pas été retenu{last.rejectionReason ? ` : ${last.rejectionReason}` : '.'} Vous pouvez en déposer un nouveau.
          </FlowNotice>
        )}

        <div className="space-y-3">
          <p className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">Comment ça marche</p>
          {[
            ['Le montant', 'Dites combien il vous faut.'],
            ['Votre activité', 'Expliquez ce que vous ferez de l’argent.'],
            ['Une vidéo', 'Présentez-vous en 1 minute environ.'],
            ['L’étude', 'Notre équipe décide et vous verse l’aide si elle est accordée.'],
          ].map(([label, text], i) => (
            <div key={label} className="flex items-start gap-3">
              <span className="w-8 h-8 rounded-full bg-brand/10 text-brand text-sm font-black flex items-center justify-center shrink-0">{i + 1}</span>
              <div>
                <p className="text-sm font-bold text-foreground">{label}</p>
                <p className="text-[13px] text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>

        <FlowNotice tone="brand">
          Des frais d'étude de <strong>{fcfa(applicationFee)}</strong> sont prélevés sur votre portefeuille au dépôt du dossier. Ils ne sont pas remboursés si l'aide n'est pas accordée.
        </FlowNotice>
      </FlowScreen>
    );
  }

  // ---------------------------------------------------------------- Montant
  if (step === 'amount') {
    return (
      <FlowScreen
        {...common}
        heading="De combien avez-vous besoin ?"
        desc="Demandez ce dont vous avez vraiment besoin : l'équipe peut accorder tout ou partie du montant."
        footer={nextButton(valid.amount)}
      >
        <AmountField value={amount} onChange={setAmount} suggestions={[25000, 50000, 100000, 250000]} max={AID_MAX_AMOUNT} autoFocus />
      </FlowScreen>
    );
  }

  // --------------------------------------------------------------- Activité
  if (step === 'project') {
    const missing = 20 - description.trim().length;
    return (
      <FlowScreen
        {...common}
        heading="Parlez-nous de votre activité"
        desc="Quelques phrases suffisent. Soyez concret."
        footer={nextButton(valid.project)}
      >
        <div className="space-y-2">
          <Label htmlFor="aid-title" className="text-sm font-bold">Votre activité</Label>
          <Input id="aid-title" maxLength={120} placeholder="Ex. : mon atelier de couture" value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-2xl h-13 text-base" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aid-desc" className="text-sm font-bold">Que ferez-vous de l'argent ?</Label>
          <Textarea
            id="aid-desc"
            maxLength={4000}
            rows={6}
            placeholder="Ce que vous allez acheter et ce que ça va changer pour votre activité…"
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

  // ------------------------------------------------------------------ Vidéo
  if (step === 'video') {
    return (
      <FlowScreen
        {...common}
        heading="Présentez-vous en vidéo"
        desc="Environ 1 minute : qui vous êtes, votre activité, et ce que vous ferez de l'aide. La vidéo est obligatoire."
        footer={nextButton(valid.video)}
      >
        <div className="grid grid-cols-2 gap-3">
          {(['upload', 'link'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setVideoMode(mode)}
              className={`p-4 rounded-2xl border-2 text-sm font-bold flex flex-col items-center gap-2 cursor-pointer transition-colors ${
                videoMode === mode ? 'border-brand bg-brand/5 text-brand' : 'border-border text-muted-foreground'
              }`}
            >
              {mode === 'upload' ? <Upload className="w-6 h-6" /> : <Link2 className="w-6 h-6" />}
              {mode === 'upload' ? 'Filmer ou envoyer' : 'Coller un lien'}
            </button>
          ))}
        </div>

        {videoMode === 'upload' ? (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="video/*"
              capture="user"
              className="hidden"
              onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className={`w-full rounded-2xl border-2 border-dashed p-6 flex flex-col items-center gap-2 text-center cursor-pointer ${
                videoFile ? 'border-success/50 bg-success-soft' : 'border-border hover:bg-muted/40'
              }`}
            >
              {videoFile ? <CheckCircle2 className="w-8 h-8 text-success" /> : <Video className="w-8 h-8 text-muted-foreground" />}
              <span className="text-sm font-bold text-foreground break-all">
                {videoFile ? videoFile.name : 'Appuyez pour filmer ou choisir une vidéo'}
              </span>
              <span className="text-[12px] text-muted-foreground">
                {videoFile ? `${(videoFile.size / 1024 / 1024).toFixed(1)} Mo · appuyez pour changer` : '50 Mo maximum'}
              </span>
            </button>
          </>
        ) : (
          <div className="space-y-2">
            <Input
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={videoLink}
              onChange={(e) => setVideoLink(e.target.value)}
              className="rounded-2xl h-13 text-base"
            />
            <p className="text-[12px] text-muted-foreground">
              {videoLink.trim() && !linkOk ? 'Le lien doit commencer par https://' : 'YouTube, TikTok, Facebook ou Google Drive.'}
            </p>
          </div>
        )}
      </FlowScreen>
    );
  }

  // --------------------------------------------------------- Récapitulatif
  return (
    <FlowScreen
      {...common}
      heading="Vérifiez votre dossier"
      desc="Touchez « Modifier » pour corriger une réponse."
      footer={
        <Button className="btn-shine w-full h-13 text-base font-bold rounded-2xl" onClick={submit} disabled={!valid.review || sending !== 'idle'}>
          {sending === 'uploading' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Envoi de la vidéo…</>
            : sending === 'submitting' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Dépôt du dossier…</>
            : `Déposer et payer ${fcfa(applicationFee)}`}
        </Button>
      }
    >
      <div className="rounded-2xl border border-border px-4 divide-y divide-border">
        <FlowRow label="Montant demandé" value={fcfa(value)} onEdit={() => setStep('amount')} />
        <FlowRow label="Activité" value={title.trim()} onEdit={() => setStep('project')} />
        <FlowRow
          label="Vidéo"
          value={videoMode === 'upload' ? 'Fichier joint' : 'Lien'}
          onEdit={() => setStep('video')}
        />
        <FlowRow label="Frais d'étude" value={fcfa(applicationFee)} strong />
      </div>

      <FlowNotice tone="brand">
        Les frais d'étude paient l'examen de votre dossier par notre équipe. Ils <strong>ne sont pas remboursés</strong>, même si l'aide n'est pas accordée. La décision dépend uniquement de votre dossier, jamais du hasard.
      </FlowNotice>

      <FlowCheckbox checked={accepted} onChange={setAccepted}>
        J'accepte les frais d'étude et{' '}
        <button type="button" onClick={(e) => { e.preventDefault(); onShowTerms(); }} className="font-bold underline cursor-pointer">
          les conditions du Coup de pouce
        </button>.
      </FlowCheckbox>

      {notEnoughForFee && (
        <FlowNotice tone="danger" icon={<XCircle className="w-5 h-5 text-danger" />}>
          Votre portefeuille contient {fcfa(user.walletBalance)} : rechargez-le d'au moins {fcfa(applicationFee - user.walletBalance)} pour déposer votre dossier.
        </FlowNotice>
      )}
    </FlowScreen>
  );
}
