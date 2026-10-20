import React, { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Gift, Link2, Loader2, Upload, Video, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UserProfile } from '@/types';
import { AID_MAX_AMOUNT, AidApplication, submitAidApplication, uploadAidVideo } from '@/lib/aid';

interface AidApplicationPanelProps {
  user: UserProfile;
  /** Dossiers de la personne, du plus récent au plus ancien. */
  applications: AidApplication[];
  applicationFee: number;
  onChanged: () => Promise<void> | void;
  onShowTerms: () => void;
}

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Le parcours « Coup de pouce » : déposer un dossier (montant + vidéo + frais
 * d'étude), suivre son étude, voir l'aide reçue ou le motif du refus.
 */
export function AidApplicationPanel({ user, applications, applicationFee, onChanged, onShowTerms }: AidApplicationPanelProps) {
  const pending = applications.find((a) => a.status === 'submitted');
  const last = applications[0];

  if (pending) {
    return (
      <div className="space-y-3">
        <Notice icon={<Clock className="w-5 h-5 text-warning shrink-0" />}>
          Votre dossier « {pending.projectTitle} » est en cours d'étude par notre équipe. Vous recevrez une notification dès qu'une décision sera prise.
        </Notice>
        <div className="bg-brand/5 border border-brand/20 rounded-2xl p-4 space-y-2.5 text-xs">
          <Row label="Montant demandé" value={fcfa(pending.requestedAmount)} />
          <Row label="Déposé le" value={dateFr(pending.createdAt)} />
          <Row label="Frais d'étude réglés" value={fcfa(pending.applicationFee)} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {last?.status === 'granted' && (
        <Notice icon={<Gift className="w-5 h-5 text-success shrink-0" />}>
          Vous avez reçu {fcfa(last.grantedAmount ?? 0)} pour « {last.projectTitle} ». C'est une aide : rien à rembourser.
          {last.adminNotes ? ` Message de l'équipe : ${last.adminNotes}` : ''}
        </Notice>
      )}
      {last?.status === 'rejected' && (
        <Notice icon={<XCircle className="w-5 h-5 text-danger shrink-0" />}>
          Votre dossier « {last.projectTitle} » n'a pas été retenu{last.rejectionReason ? ` : ${last.rejectionReason}` : '.'} Vous pouvez en déposer un nouveau.
        </Notice>
      )}
      <AidForm user={user} applicationFee={applicationFee} onChanged={onChanged} onShowTerms={onShowTerms} />
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold text-foreground text-right">{value}</span>
    </div>
  );
}

function AidForm({ user, applicationFee, onChanged, onShowTerms }: Omit<AidApplicationPanelProps, 'applications'>) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [videoMode, setVideoMode] = useState<'upload' | 'link'>('upload');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoLink, setVideoLink] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [step, setStep] = useState<'idle' | 'uploading' | 'submitting'>('idle');
  // Même clé tant que la personne réessaie le même envoi : un double appui ou
  // un rejeu réseau ne prélève jamais deux fois les frais.
  const idempotencyKey = useRef<string>(crypto.randomUUID());
  const uploadedPath = useRef<{ file: File; path: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const notEnoughForFee = user.walletBalance < applicationFee;
  const hasVideo = videoMode === 'upload' ? !!videoFile : videoLink.trim().length > 0;

  const submit = async () => {
    const value = Number(amount);
    if (title.trim().length < 3) return toast.error('Donnez un nom à votre activité.');
    if (description.trim().length < 20) return toast.error('Expliquez en quelques phrases ce que vous ferez de l’aide.');
    if (!value || value <= 0 || value > AID_MAX_AMOUNT) return toast.error('Indiquez le montant dont vous avez besoin.');
    if (!hasVideo) return toast.error('La vidéo est obligatoire : filmez-vous ou collez un lien.');
    if (videoMode === 'link' && !/^https:\/\/\S+$/i.test(videoLink.trim())) {
      return toast.error('Le lien de la vidéo doit commencer par https://');
    }
    if (!accepted) return toast.error('Cochez la case pour accepter les frais d’étude.');
    if (notEnoughForFee) return toast.error(`Il faut ${fcfa(applicationFee)} sur votre portefeuille pour les frais d’étude.`);

    let videoPath: string | undefined;
    if (videoMode === 'upload' && videoFile) {
      if (uploadedPath.current?.file === videoFile) {
        videoPath = uploadedPath.current.path;
      } else {
        setStep('uploading');
        const res = await uploadAidVideo(user.uid, videoFile);
        if (res.error || !res.path) {
          setStep('idle');
          return toast.error(res.error || 'Échec de l’envoi de la vidéo.');
        }
        uploadedPath.current = { file: videoFile, path: res.path };
        videoPath = res.path;
      }
    }

    setStep('submitting');
    const result = await submitAidApplication({
      projectTitle: title.trim(),
      projectDescription: description.trim(),
      requestedAmount: Math.round(value),
      videoPath,
      videoUrl: videoMode === 'link' ? videoLink.trim() : undefined,
      idempotencyKey: idempotencyKey.current,
    });
    setStep('idle');
    if (!result.success) return toast.error(result.message);
    toast.success(result.message);
    await onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="aid-title" className="text-xs font-bold">Votre activité</Label>
        <Input id="aid-title" maxLength={120} placeholder="Ex. : mon atelier de couture" value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl h-11" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="aid-desc" className="text-xs font-bold">Que ferez-vous de l'argent ?</Label>
        <Textarea
          id="aid-desc"
          maxLength={4000}
          rows={4}
          placeholder="Ce que vous allez acheter et ce que ça va changer pour votre activité…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-xl"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="aid-amount" className="text-xs font-bold">Montant dont vous avez besoin (FCFA)</Label>
        <Input id="aid-amount" type="number" inputMode="numeric" min={1} placeholder="Ex. : 75 000" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl h-11" />
        <p className="text-[12px] text-muted-foreground">Demandez ce dont vous avez vraiment besoin : l'équipe peut accorder tout ou partie du montant.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-bold flex items-center gap-1.5"><Video className="w-4 h-4" /> Votre vidéo (obligatoire)</Label>
        <p className="text-[12px] text-muted-foreground -mt-1">Présentez-vous, montrez votre activité et dites ce que vous ferez de l'aide, en 1 minute environ.</p>
        <div className="grid grid-cols-2 gap-2">
          {(['upload', 'link'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setVideoMode(mode)}
              className={`h-10 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${videoMode === mode ? 'border-brand bg-brand/10 text-brand' : 'border-border text-muted-foreground'}`}
            >
              {mode === 'upload' ? <><Upload className="w-4 h-4" /> Filmer / envoyer</> : <><Link2 className="w-4 h-4" /> Coller un lien</>}
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
              className="w-full rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground text-left cursor-pointer hover:bg-muted/40"
            >
              {videoFile ? `${videoFile.name} — ${(videoFile.size / 1024 / 1024).toFixed(1)} Mo` : 'Choisir ou filmer une vidéo (50 Mo maximum).'}
            </button>
          </>
        ) : (
          <Input type="url" placeholder="https://youtube.com/… ou lien TikTok, Facebook, Drive" value={videoLink} onChange={(e) => setVideoLink(e.target.value)} className="rounded-xl h-11" />
        )}
      </div>

      <div className="bg-brand/5 border border-brand/20 p-4 rounded-xl space-y-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-brand shrink-0 mt-0.5" />
          <p className="text-xs text-brand-deep leading-relaxed">
            <strong>Frais d'étude : {fcfa(applicationFee)}</strong>, prélevés sur votre portefeuille au dépôt. Ils paient l'étude de votre dossier par notre équipe et <strong>ne sont pas remboursés</strong>, même si l'aide n'est pas accordée. La décision dépend uniquement de votre dossier, jamais du hasard.
          </p>
        </div>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-border text-[#C96F4A] cursor-pointer" />
          <span className="text-xs text-foreground leading-relaxed">
            J'accepte les frais d'étude et{' '}
            <button type="button" onClick={onShowTerms} className="font-bold underline cursor-pointer">les conditions du Coup de pouce</button>.
          </span>
        </label>
      </div>

      {notEnoughForFee && (
        <p className="text-xs text-danger font-medium">
          Votre portefeuille contient {fcfa(user.walletBalance)} : rechargez-le d'au moins {fcfa(applicationFee - user.walletBalance)} pour déposer votre dossier.
        </p>
      )}

      <Button className="btn-shine w-full h-12 text-base font-bold rounded-xl" onClick={submit} disabled={step !== 'idle'}>
        {step === 'uploading' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Envoi de la vidéo…</>
          : step === 'submitting' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Dépôt du dossier…</>
          : <><CheckCircle2 className="w-4 h-4 mr-2" /> Déposer mon dossier ({fcfa(applicationFee)})</>}
      </Button>
    </div>
  );
}
