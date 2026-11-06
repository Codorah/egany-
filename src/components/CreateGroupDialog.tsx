import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronLeft, Check, Copy, Minus, Plus, ShieldCheck, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SignaturePad } from './SignaturePad';
import { supabase } from '@/lib/supabase';
import { KYC_VERIFIED_LEVEL } from '@/lib/kyc';
import { notifyUser } from '@/lib/notify';
import { toast } from 'sonner';
import { calculateNextPayoutDate } from '@/lib/disbursements';
import { useLanguage } from '@/contexts/LanguageContext';
import LegalDocumentDialog from './LegalDocumentDialog';
import { useBackHandler } from '@/hooks/useBackHandler';

/**
 * Alphabet du code d'invitation : sans 0/O, 1/I/L ni U/V.
 *
 * Ces codes se lisent à voix haute et se retapent à la main depuis un
 * message WhatsApp — les paires ambiguës provoquaient des « le code ne
 * marche pas » qui n'étaient que des confusions de caractères.
 */
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTWXYZ23456789';
const JOIN_CODE_LENGTH = 6;

/**
 * Math.random() n'est pas imprévisible : son état interne se déduit de
 * quelques tirages observés. Or le code d'invitation est la SEULE chose qui
 * protège un cercle privé — le deviner, c'est pouvoir demander à le
 * rejoindre. On tire donc dans le générateur cryptographique du navigateur.
 */
function generateJoinCode(): string {
  const bytes = new Uint8Array(JOIN_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const byte of bytes) {
    code += JOIN_CODE_ALPHABET[byte % JOIN_CODE_ALPHABET.length];
  }
  return code;
}

/**
 * La colonne `join_code` est UNIQUE en base, et rien ne vérifiait la
 * collision : deux cercles tirant le même code faisaient échouer la
 * création du second, sans nouvel essai, avec une erreur incompréhensible
 * pour l'organisatrice. On relance donc le tirage sur violation d'unicité
 * (code Postgres 23505) plutôt que d'abandonner.
 */
async function insertGroupWithUniqueJoinCode(groupData: Record<string, unknown>) {
  const MAX_ATTEMPTS = 5;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const result = await supabase
      .from('groups')
      .insert({ ...groupData, join_code: generateJoinCode() })
      .select()
      .single();

    const isDuplicateJoinCode =
      result.error?.code === '23505' && result.error.message.includes('join_code');

    if (!isDuplicateJoinCode) return result;
  }

  return {
    data: null,
    error: {
      message: "Impossible de générer un code d'invitation disponible. Réessayez.",
      code: '23505',
    } as any,
  };
}

function buildFormSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(2, t('cgd_err_name_min') || 'Le nom doit comporter au moins 2 caractères'),
    description: z.string().optional(),
    contributionAmount: z.number().min(500, 'Le montant minimum est de 500 FCFA'),
    frequency: z.enum(['daily', 'weekly', 'bi-weekly', 'monthly']),
    currency: z.string().min(1),
    distributionMethod: z.enum(['sequential', 'draw', 'auction']),
    // Plafond aligné sur le champ du formulaire (max={100}). Le schéma
    // autorisait 500 : au-delà de 100, et en mensuel, la dernière
    // participante attendrait des décennies son tour — un cercle qui ne
    // tourne jamais n'est pas une tontine.
    maxMembers: z
      .number()
      .min(2, 'Le cercle doit compter au moins 2 participants')
      .max(100, 'Un cercle ne peut pas dépasser 100 participants'),
    startDate: z.string().min(1, 'La date de début est requise'),
    isPrivate: z.boolean(),
    penaltiesEnabled: z.boolean(),
    penaltyAmount: z.number().min(0),
    termsAccepted: z.boolean().refine(val => val === true, 'Vous devez accepter la charte de solidarité'),
    signature: z.string().min(1, 'Votre signature est requise pour formaliser le cercle'),
  });
}

type FormValues = z.infer<ReturnType<typeof buildFormSchema>>;

const PRESET_THEMES = [
  { key: 'cgd_theme_0', label: 'Solidarité Famille', desc: 'Entraide familiale et projets communs' },
  { key: 'cgd_theme_1', label: 'Tontine Collègues', desc: 'Épargne mensuelle entre collègues de travail' },
  { key: 'cgd_theme_2', label: 'Projet Moto / Véhicule', desc: 'Financement groupé d’équipement et mobilité' },
  { key: 'cgd_theme_3', label: 'Commerce & Marché', desc: 'Fonds de roulement pour activités marchandes' },
  { key: 'cgd_theme_4', label: 'Épargne Fêtes & Célébrations', desc: 'Anticipation des fêtes et rentrées scolaires' },
];

const PRESET_AMOUNTS = [5000, 10000, 25000, 50000];
const PRESET_MEMBERS = [5, 10, 12, 15];

const FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Chaque mois' },
  { value: 'bi-weekly', label: 'Tous les 15 jours' },
  { value: 'weekly', label: 'Chaque semaine' },
  { value: 'daily', label: 'Chaque jour' },
] as const;

/**
 * Trois écrans : le cercle, son rythme et ses règles, puis l'engagement. Chaque étape
 * ne valide que ses propres champs avant de passer à la suivante.
 */
const STEPS = [
  { title: 'Votre cercle', fields: ['name', 'contributionAmount', 'maxMembers'] },
  { title: 'Rythme et règles', fields: ['frequency', 'startDate', 'distributionMethod'] },
  { title: 'Votre engagement', fields: ['termsAccepted', 'signature'] },
] as const satisfies readonly { title: string; fields: readonly (keyof FormValues)[] }[];

// Glissement court ; désactivé par le réglage « réduire les animations » du téléphone.
const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? 32 : -32, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -32 : 32, opacity: 0 }),
};

function ChoiceRow({ selected, onClick, title, hint }: {
  selected: boolean;
  onClick: () => void;
  title: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/50"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-foreground">{title}</span>
        {hint && <span className="block text-[13px] leading-snug text-muted-foreground">{hint}</span>}
      </span>
      {selected && <Check className="h-5 w-5 shrink-0 text-primary-ink" />}
    </button>
  );
}

function Pill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-11 cursor-pointer rounded-full border px-4 text-[13px] font-bold transition-colors duration-150 ${
        selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  );
}

export function CreateGroupDialog({
  trigger,
  triggerIsNativeButton = false,
  onNavigateToVerification,
  onGroupCreated,
}: {
  trigger?: React.ReactElement;
  triggerIsNativeButton?: boolean;
  onNavigateToVerification?: () => void;
  onGroupCreated?: (groupId: string) => void;
}) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  // Sens de l'animation : +1 on avance (l'écran part à gauche), -1 on recule.
  const [direction, setDirection] = useState(1);
  const TOTAL_STEPS = STEPS.length;

  // Le niveau KYC est contrôlé dès l'ouverture, pas à la soumission : sinon on
  // laisse remplir le formulaire et signer, pour refuser à la toute fin.
  const [kycState, setKycState] = useState<'checking' | 'ok' | 'required'>('checking');

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setKycState('checking');
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profileRow, error } = await supabase
          .from('profiles')
          .select('kyc_level')
          .eq('id', user.id)
          .single();
        if (error) throw error;
        if (cancelled) return;
        setKycState((profileRow?.kyc_level ?? 1) < KYC_VERIFIED_LEVEL ? 'required' : 'ok');
      } catch (err) {
        console.error('KYC level check failed:', err);
        // En cas d'échec réseau on laisse passer : la soumission revérifiera,
        // et le serveur reste l'autorité sur le niveau KYC.
        if (!cancelled) setKycState('ok');
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // État de succès après création : affiche la carte avec lien de partage WhatsApp
  const [createdGroup, setCreatedGroup] = useState<{
    id: string;
    name: string;
    joinCode: string;
    potAmount: number;
    frequency: string;
    membersCount: number;
  } | null>(null);

  const [copiedCode, setCopiedCode] = useState(false);
  const [showReglement, setShowReglement] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  // Valeur par défaut de date de début : dans 7 jours
  const defaultStartDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, []);

  const formSchema = useMemo(() => buildFormSchema(t), [t]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    trigger: triggerValidation,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      contributionAmount: 25000,
      frequency: 'monthly',
      currency: 'FCFA',
      distributionMethod: 'draw',
      maxMembers: 10,
      startDate: defaultStartDate,
      isPrivate: true,
      penaltiesEnabled: true,
      penaltyAmount: 1000,
      termsAccepted: false,
      signature: '',
    },
  });

  const contributionAmount = watch('contributionAmount') || 0;
  const maxMembers = watch('maxMembers') || 0;
  const frequency = watch('frequency');
  const isPrivate = watch('isPrivate');
  const penaltiesEnabled = watch('penaltiesEnabled');
  const groupName = watch('name');
  const distributionMethod = watch('distributionMethod');
  const startDateValue = watch('startDate');

  // Calcul dynamique de la cagnotte reçue par tour
  const totalPot = contributionAmount * maxMembers;

  const frequencyLabel = (f: string) => {
    switch (f) {
      case 'daily': return t('cgd_per_daily');
      case 'weekly': return t('cgd_per_weekly');
      case 'bi-weekly': return t('cgd_per_bi-weekly');
      case 'monthly': return t('cgd_per_monthly');
      default: return 'par cycle';
    }
  };

  const handleNextStep = async () => {
    const valid = await triggerValidation([...STEPS[step - 1].fields]);
    if (!valid) return;
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const handlePrevStep = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 1));
  };

  const resetForm = () => {
    reset();
    setStep(1);
    setDirection(1);
    setCreatedGroup(null);
    setCopiedCode(false);
    setShowOptions(false);
  };

  // Retour Android : étape précédente, puis fermeture. L'écran du dessous ne bouge pas.
  useBackHandler(
    React.useCallback(() => {
      if (!createdGroup && step > 1) {
        setDirection(-1);
        setStep((s) => Math.max(s - 1, 1));
      } else {
        setOpen(false);
        resetForm();
      }
      return true;
    }, [createdGroup, step]),
    open
  );

  const setMembers = (n: number) =>
    setValue('maxMembers', Math.min(100, Math.max(2, n)), { shouldValidate: true });

  const onSubmit = async (values: FormValues) => {
    if (!navigator.onLine) {
      toast.error(t('cgd_offline_error') || 'Connexion Internet requise');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Session expirée, veuillez vous reconnecter.');
      return;
    }

    try {
      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('kyc_level')
        .eq('id', user.id)
        .single();
      if (profileError) throw profileError;
      if ((profileRow?.kyc_level ?? 1) < KYC_VERIFIED_LEVEL) {
        // Garde-fou : normalement l'écran d'ouverture a déjà bloqué le cas.
        setKycState('required');
        return;
      }

      const startDate = new Date(values.startDate).toISOString();

      const groupData = {
        name: values.name.trim(),
        description: values.description?.trim() || 'Tontine collective et solidaire eganyé',
        contribution_amount: values.contributionAmount,
        frequency: values.frequency,
        currency: values.currency,
        distribution_method: values.distributionMethod,
        max_members: values.maxMembers,
        is_private: values.isPrivate,
        status: 'active',
        start_date: startDate,
        next_payout_date: calculateNextPayoutDate(startDate, values.frequency),
        creator_id: user.id,
        ...(values.penaltiesEnabled ? {
          penalty_type: 'fixed',
          penalty_amount: values.penaltyAmount ?? 1000,
          penalty_rate: 0,
          grace_period: 2,
        } : {}),
      };

      const { data: newGroup, error: groupError } = await insertGroupWithUniqueJoinCode(groupData);
      if (groupError) throw groupError;
      if (!newGroup) throw new Error('Création du cercle impossible.');

      // Inscrire le créateur comme premier membre actif du cercle
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: newGroup.id,
          user_id: user.id,
          status: 'active',
          payout_position: 0,
        });
      if (memberError) throw memberError;

      // Le code retenu est celui que la base a réellement accepté (le helper
      // relance le tirage en cas de collision), pas celui du premier essai.
      const joinCode = newGroup.join_code as string;

      // Afficher l'écran de partage festif
      setCreatedGroup({
        id: newGroup.id,
        name: values.name,
        joinCode,
        potAmount: values.contributionAmount * values.maxMembers,
        frequency: values.frequency,
        membersCount: values.maxMembers,
      });

      notifyUser({
        userId: user.id,
        title: 'Cercle créé',
        message: `« ${values.name.trim()} » est prêt. Partagez le code ${joinCode} pour inviter vos proches.`,
        type: 'system',
        link: `/group/${newGroup.id}`,
      }).catch((err) => console.warn('Circle creation notification skipped:', err));

      toast.success(t('cgd_created'));
    } catch (error: any) {
      console.error('Error creating group:', error);
      toast.error(error.message || 'Erreur lors de la création du cercle');
    }
  };

  // Entrée au clavier : avance d'un écran au lieu de soumettre tout le cercle.
  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (step < TOTAL_STEPS) {
      e.preventDefault();
      handleNextStep();
      return;
    }
    handleSubmit(onSubmit)(e);
  };

  const handleCopyCode = () => {
    if (!createdGroup) return;
    navigator.clipboard.writeText(createdGroup.joinCode);
    setCopiedCode(true);
    toast.success('Code copié.');
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const getWhatsAppMessage = () => {
    if (!createdGroup) return '';
    const shareUrl = `${window.location.origin}/?join=${createdGroup.joinCode}`;
    return encodeURIComponent(
      `👋 Salut ! Je viens de créer la tontine "${createdGroup.name}" sur eganyé.\n\n` +
      `💰 Cotisation : ${createdGroup.potAmount / createdGroup.membersCount} FCFA ${frequencyLabel(createdGroup.frequency)}\n` +
      `🎁 Cagnotte par tour : ${createdGroup.potAmount.toLocaleString()} FCFA\n\n` +
      `Rejoins-nous directement avec le code : *${createdGroup.joinCode}*\n` +
      `👉 Clique ici pour rejoindre : ${shareUrl}`
    );
  };

  const closeButton = (
    <button
      type="button"
      onClick={() => {
        setOpen(false);
        resetForm();
      }}
      aria-label="Fermer"
      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
    >
      <X className="h-5 w-5" />
    </button>
  );

  const startDateLabel = startDateValue
    ? new Date(startDateValue).toLocaleDateString(language === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <DialogTrigger
        nativeButton={trigger ? triggerIsNativeButton : true}
        render={
          trigger || (
            <Button className="h-11 cursor-pointer gap-2 rounded-xl font-bold">
              <Plus className="h-5 w-5" />
              <span>Créer un cercle</span>
            </Button>
          )
        }
      />

      {/* Plein écran sur téléphone ; sur ordinateur, un cadre au format téléphone. */}
      <DialogContent
        showCloseButton={false}
        showHandle={false}
        className="top-0 flex h-[100dvh] max-h-[100dvh] sm:max-h-[92vh] flex-col gap-0 overflow-hidden rounded-none bg-background p-0 pb-0 sm:h-[min(860px,92vh)] sm:max-w-md sm:rounded-2xl sm:pb-0"
      >
        {createdGroup ? (
          <div className="flex-1 overflow-y-auto px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto max-w-sm space-y-5 py-6">
              <div className="space-y-1.5 text-center">
                <DialogTitle className="text-2xl font-bold text-foreground">{t('cgd_created')}</DialogTitle>
                <p className="text-sm text-muted-foreground">{t('cgd_invite_now')} « {createdGroup.name} ».</p>
              </div>

              <dl className="divide-y divide-border rounded-2xl border border-border bg-card">
                <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <dt className="text-muted-foreground">{t('cgd_pot_per_round')}</dt>
                  <dd className="font-bold tabular-nums text-foreground">{createdGroup.potAmount.toLocaleString()} FCFA</dd>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <dt className="text-muted-foreground">{t('cgd_seats')}</dt>
                  <dd className="font-bold tabular-nums text-foreground">{createdGroup.membersCount}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-1 pl-4 pr-1 text-sm">
                  <dt className="text-muted-foreground">{t('cgd_code')}</dt>
                  <dd className="flex items-center gap-1 font-mono text-lg font-bold text-foreground">
                    {createdGroup.joinCode}
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      aria-label="Copier le code"
                      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted"
                    >
                      {copiedCode ? <Check className="h-5 w-5 text-secondary" /> : <Copy className="h-5 w-5" />}
                    </button>
                  </dd>
                </div>
              </dl>

              <div className="space-y-2">
                <a
                  href={`https://wa.me/?text=${getWhatsAppMessage()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-primary text-[15px] font-bold text-primary-foreground"
                >
                  {t('cgd_invite_whatsapp')}
                </a>
                <Button
                  variant="outline"
                  onClick={() => {
                    const id = createdGroup.id;
                    setOpen(false);
                    resetForm();
                    onGroupCreated?.(id);
                  }}
                  className="h-12 w-full cursor-pointer rounded-xl font-bold"
                >
                  {t('cgd_open')}
                </Button>
              </div>
            </div>
          </div>
        ) : kycState === 'checking' ? (
          /* Évite de montrer le formulaire pendant la fraction de seconde
             qui précède le verdict KYC. */
          <div className="flex flex-1 items-center justify-center">
            <DialogTitle className="sr-only">Chargement</DialogTitle>
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-border border-t-primary" />
          </div>
        ) : kycState === 'required' ? (
          <div className="flex flex-1 flex-col">
            <div className="flex justify-end px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">{closeButton}</div>
            <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 pb-10 text-center">
              <ShieldCheck className="h-10 w-10 text-muted-foreground" />
              <div className="space-y-2">
                <DialogTitle className="text-xl font-bold text-foreground">Vérification d'identité requise</DialogTitle>
                <p className="max-w-sm text-[15px] leading-relaxed text-muted-foreground">
                  Pour créer un cercle, votre identité doit d'abord être vérifiée.
                </p>
              </div>
              <Button
                onClick={() => {
                  setOpen(false);
                  onNavigateToVerification?.();
                }}
                className="h-12 w-full max-w-sm cursor-pointer rounded-xl font-bold"
              >
                Vérifier mon identité
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onFormSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 space-y-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
              <div className="flex items-center gap-1">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    aria-label="Étape précédente"
                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors duration-150 hover:bg-muted"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                ) : (
                  <span className="h-11 w-11 shrink-0" />
                )}
                <p className="flex-1 text-center text-[13px] font-bold text-muted-foreground">
                  {t('cgd_step_word')} {step} {t('cgd_of')} {TOTAL_STEPS}
                </p>
                {closeButton}
              </div>
              <div className="flex gap-1.5 px-2">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-200 ${i < step ? 'bg-primary' : 'bg-muted'}`}
                  />
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              <AnimatePresence mode="wait" initial={false} custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={slide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="space-y-6 px-5 pt-3 pb-6 motion-reduce:!transform-none"
                >
                  <DialogTitle className="text-2xl font-bold text-foreground">{t(`cgd_step_${step}`)}</DialogTitle>

                  {/* ── 1. Le cercle ── */}
                  {step === 1 && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-sm font-bold text-foreground">{t('cgd_name')}</Label>
                        <Input
                          id="name"
                          placeholder={t('cgd_name_ph')}
                          {...register('name')}
                          className="h-12 rounded-xl bg-card text-base"
                          autoFocus
                        />
                        {errors.name && <p className="text-[13px] font-medium text-danger">{errors.name.message}</p>}
                        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-none">
                          {PRESET_THEMES.map((theme) => (
                            <div key={t(theme.key)} className="shrink-0">
                              <Pill
                                selected={groupName === t(theme.key)}
                                onClick={() => {
                                  setValue('name', t(theme.key), { shouldValidate: true });
                                  setValue('description', theme.desc);
                                }}
                              >
                                {t(theme.key)}
                              </Pill>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="contributionAmount" className="text-sm font-bold text-foreground">{t('cgd_amount')}</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="contributionAmount"
                            type="number"
                            inputMode="numeric"
                            min={500}
                            step={500}
                            {...register('contributionAmount', { valueAsNumber: true })}
                            className="h-12 rounded-xl bg-card text-lg font-bold tabular-nums"
                          />
                          <span className="shrink-0 text-sm font-bold text-muted-foreground">FCFA</span>
                        </div>
                        {errors.contributionAmount && (
                          <p className="text-[13px] font-medium text-danger">{errors.contributionAmount.message}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {PRESET_AMOUNTS.map((amt) => (
                            <Pill
                              key={amt}
                              selected={contributionAmount === amt}
                              onClick={() => setValue('contributionAmount', amt, { shouldValidate: true })}
                            >
                              {amt.toLocaleString()}
                            </Pill>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="maxMembers" className="text-sm font-bold text-foreground">{t('cgd_members')}</Label>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setMembers(maxMembers - 1)}
                            aria-label="Un participant de moins"
                            className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-muted text-foreground"
                          >
                            <Minus className="h-5 w-5" />
                          </button>
                          <Input
                            id="maxMembers"
                            type="number"
                            inputMode="numeric"
                            min={2}
                            max={100}
                            {...register('maxMembers', { valueAsNumber: true })}
                            className="h-12 rounded-xl bg-card text-center text-lg font-bold tabular-nums"
                          />
                          <button
                            type="button"
                            onClick={() => setMembers(maxMembers + 1)}
                            aria-label="Un participant de plus"
                            className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-muted text-foreground"
                          >
                            <Plus className="h-5 w-5" />
                          </button>
                        </div>
                        {errors.maxMembers && (
                          <p className="text-[13px] font-medium text-danger">{errors.maxMembers.message}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {PRESET_MEMBERS.map((n) => (
                            <Pill key={n} selected={maxMembers === n} onClick={() => setMembers(n)}>{n}</Pill>
                          ))}
                        </div>
                      </div>

                      <p className="rounded-xl bg-muted px-4 py-3 text-sm text-foreground">
                        {t('cgd_pot_per_round')}{language === 'en' ? ':' : ' :'} <span className="font-bold tabular-nums">{totalPot.toLocaleString()} FCFA</span>
                      </p>
                    </div>
                  )}

                  {/* ── 2. Rythme et règles ── */}
                  {step === 2 && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-foreground">{t('cgd_frequency')}</p>
                        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
                          {FREQUENCY_OPTIONS.map((opt) => (
                            <ChoiceRow
                              key={opt.value}
                              selected={frequency === opt.value}
                              onClick={() => setValue('frequency', opt.value, { shouldValidate: true })}
                              title={t(`cgd_freq_${opt.value}`)}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="startDate" className="text-sm font-bold text-foreground">{t('cgd_start')}</Label>
                        <Input
                          id="startDate"
                          type="date"
                          min={new Date().toISOString().slice(0, 10)}
                          {...register('startDate')}
                          className="h-12 rounded-xl bg-card text-base"
                        />
                        {errors.startDate && (
                          <p className="text-[13px] font-medium text-danger">{errors.startDate.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-bold text-foreground">{t('cgd_who')}</p>
                        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
                          <ChoiceRow
                            selected={distributionMethod === 'draw'}
                            onClick={() => setValue('distributionMethod', 'draw')}
                            title={t('cgd_draw')}
                            hint={t('cgd_draw_hint')}
                          />
                          <ChoiceRow
                            selected={distributionMethod === 'sequential'}
                            onClick={() => setValue('distributionMethod', 'sequential')}
                            title={t('cgd_order')}
                            hint={t('cgd_order_hint')}
                          />
                        </div>
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => setShowOptions((value) => !value)}
                          aria-expanded={showOptions}
                          className="flex min-h-11 w-full cursor-pointer items-center justify-between text-sm font-bold text-foreground"
                        >
                          Options
                          <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none ${showOptions ? 'rotate-180' : ''}`} />
                        </button>
                        {showOptions && (
                          <div className="mt-2 space-y-3">
                            <div className="space-y-1.5">
                              <Label htmlFor="description" className="text-[13px] font-bold text-muted-foreground">Objectif du cercle</Label>
                              <Textarea
                                id="description"
                                placeholder="L'esprit du groupe ou l'objectif commun"
                                className="h-20 resize-none rounded-xl bg-card text-base"
                                {...register('description')}
                              />
                            </div>
                            <div className="divide-y divide-border rounded-2xl border border-border bg-card">
                              <div className="flex items-center justify-between gap-3 px-4 py-3">
                                <div>
                                  <Label htmlFor="isPrivate" className="cursor-pointer text-sm font-bold text-foreground">Cercle privé</Label>
                                  <p className="text-[13px] leading-snug text-muted-foreground">On ne rejoint qu'avec votre code.</p>
                                </div>
                                <Switch id="isPrivate" checked={isPrivate} onCheckedChange={(checked) => setValue('isPrivate', checked)} />
                              </div>
                              <div className="flex items-center justify-between gap-3 px-4 py-3">
                                <div>
                                  <Label htmlFor="penaltiesEnabled" className="cursor-pointer text-sm font-bold text-foreground">Pénalité de retard</Label>
                                  <p className="text-[13px] leading-snug text-muted-foreground">1 000 FCFA après 2 jours de retard.</p>
                                </div>
                                <Switch id="penaltiesEnabled" checked={penaltiesEnabled} onCheckedChange={(checked) => setValue('penaltiesEnabled', checked)} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── 3. Récapitulatif, engagement et signature ── */}
                  {step === 3 && (
                    <div className="space-y-5">
                      <dl className="divide-y divide-border rounded-2xl border border-border bg-card">
                        {[
                          [t('cgd_sum_circle'), groupName],
                          [t('cgd_sum_amount'), `${contributionAmount.toLocaleString()} FCFA ${frequencyLabel(frequency)}`],
                          [t('cgd_sum_members'), `${maxMembers}`],
                          [t('cgd_pot_per_round'), `${totalPot.toLocaleString()} FCFA`],
                          [t('cgd_sum_first'), startDateLabel],
                          [t('cgd_sum_attr'), distributionMethod === 'draw' ? t('cgd_draw') : t('cgd_order')],
                          [t('cgd_sum_access'), isPrivate ? t('cgd_private') : t('cgd_public')],
                          [t('cgd_sum_penalty'), penaltiesEnabled ? '1 000 FCFA' : t('cgd_none')],
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                            <dt className="text-muted-foreground">{label}</dt>
                            <dd className="truncate text-right font-bold text-foreground">{value}</dd>
                          </div>
                        ))}
                      </dl>

                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          id="terms"
                          {...register('termsAccepted')}
                          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-border accent-[var(--primary)]"
                        />
                        <div className="space-y-1">
                          <Label htmlFor="terms" className="cursor-pointer text-sm font-normal leading-relaxed text-foreground">
                            {t('cgd_pledge')}
                          </Label>
                          <button
                            type="button"
                            onClick={() => setShowReglement(true)}
                            className="block min-h-11 cursor-pointer text-[13px] font-bold text-primary-ink underline underline-offset-2"
                          >
                            {t('cgd_read_rules')}
                          </button>
                          {errors.termsAccepted && (
                            <span className="block text-[13px] font-medium text-danger">{errors.termsAccepted.message}</span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-sm font-bold text-foreground">{t('cgd_signature')}</Label>
                        <SignaturePad
                          onSignatureChange={(dataUrl) => setValue('signature', dataUrl || '', { shouldValidate: true })}
                        />
                        {errors.signature && (
                          <span className="block text-[13px] font-medium text-danger">{errors.signature.message}</span>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bouton principal toujours au même endroit, sous le pouce */}
            <div className="shrink-0 border-t border-border bg-background px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {step < TOTAL_STEPS ? (
                <Button type="button" onClick={handleNextStep} className="h-12 w-full cursor-pointer rounded-xl font-bold">
                  {t('cgd_continue')}
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting} className="h-12 w-full cursor-pointer rounded-xl font-bold">
                  {isSubmitting ? '…' : t('cgd_create_mine')}
                </Button>
              )}
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
    <LegalDocumentDialog docId={showReglement ? 'reglement' : null} onClose={() => setShowReglement(false)} />
    </>
  );
}
