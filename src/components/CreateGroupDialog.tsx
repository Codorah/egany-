import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, Minus, Plus } from 'lucide-react';
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
import { EganyeIcon } from './ui/EganyeIcon';
import { SignaturePad } from './SignaturePad';
import { supabase } from '@/lib/supabase';
import { KYC_VERIFIED_LEVEL } from '@/lib/kyc';
import { notifyUser } from '@/lib/notify';
import { toast } from 'sonner';
import { calculateNextPayoutDate } from '@/lib/disbursements';
import { useLanguage } from '@/contexts/LanguageContext';
import LegalDocumentDialog from './LegalDocumentDialog';

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
  { label: 'Solidarité Famille', icon: 'house' as const, desc: 'Entraide familiale et projets communs' },
  { label: 'Tontine Collègues', icon: 'coin' as const, desc: 'Épargne mensuelle entre collègues de travail' },
  { label: 'Projet Moto / Véhicule', icon: 'travel' as const, desc: 'Financement groupé d’équipement et mobilité' },
  { label: 'Commerce & Marché', icon: 'savings' as const, desc: 'Fonds de roulement pour activités marchandes' },
  { label: 'Épargne Fêtes & Célébrations', icon: 'star' as const, desc: 'Anticipation des fêtes et rentrées scolaires' },
];

const PRESET_AMOUNTS = [5000, 10000, 25000, 50000, 100000];
const PRESET_MEMBERS = [5, 10, 12, 15];

const FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Chaque mois', hint: 'Le rythme le plus courant' },
  { value: 'bi-weekly', label: 'Tous les 15 jours', hint: 'Deux cotisations par mois' },
  { value: 'weekly', label: 'Chaque semaine', hint: 'Pour les petites cotisations' },
  { value: 'daily', label: 'Chaque jour', hint: 'Idéal pour le commerce au marché' },
] as const;

/**
 * Un écran par question, comme une app mobile : le cercle se remplit pas à
 * pas au lieu d'un long formulaire dans une fenêtre. Chaque étape ne valide
 * que ses propres champs avant de passer à la suivante.
 */
const STEPS = [
  { title: 'Comment s’appelle ton cercle ?', subtitle: 'Choisis une idée ou écris ton propre nom.', fields: ['name'] },
  { title: 'Combien cotise chaque membre ?', subtitle: 'Le montant que chacun verse à chaque tour.', fields: ['contributionAmount'] },
  { title: 'Combien de participants ?', subtitle: 'Toi compris. Chacun recevra la cagnotte à son tour.', fields: ['maxMembers'] },
  { title: 'À quel rythme ?', subtitle: 'La fréquence des cotisations et la date du 1er tour.', fields: ['frequency', 'startDate'] },
  { title: 'Les règles du cercle', subtitle: 'Qui reçoit la cagnotte, et comment on s’organise.', fields: ['distributionMethod'] },
  { title: 'Ton engagement', subtitle: 'Vérifie le récapitulatif, puis signe pour créer le cercle.', fields: ['termsAccepted', 'signature'] },
] as const satisfies readonly { title: string; subtitle: string; fields: readonly (keyof FormValues)[] }[];

const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? 64 : -64, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -64 : 64, opacity: 0 }),
};

function OptionCard({
  selected, onClick, title, hint, icon,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  hint: string;
  icon?: React.ComponentProps<typeof EganyeIcon>['name'];
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full flex items-center gap-3.5 p-4 rounded-2xl border-2 text-left transition-colors cursor-pointer ${
        selected ? 'border-[#C96F4A] bg-[#C96F4A]/5' : 'border-border bg-card hover:bg-muted/60'
      }`}
    >
      {icon && (
        <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
          selected ? 'bg-[#C96F4A] text-white' : 'bg-muted text-muted-foreground'
        }`}>
          <EganyeIcon name={icon} size={20} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] font-bold ${selected ? 'text-[#C96F4A]' : 'text-foreground'}`}>{title}</span>
        <span className="block text-[13px] text-muted-foreground leading-snug">{hint}</span>
      </span>
      <span className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
        selected ? 'border-[#C96F4A] bg-[#C96F4A] text-white' : 'border-border'
      }`}>
        {selected && <Check className="w-3 h-3" strokeWidth={3} />}
      </span>
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
  const { t } = useLanguage();
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
      case 'daily': return 'par jour';
      case 'weekly': return 'par semaine';
      case 'bi-weekly': return 'tous les 15 jours';
      case 'monthly': return 'par mois';
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
  };

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
        description: values.description?.trim() || 'Tontine collective et solidaire Eganyé',
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

      toast.success('Votre cercle a été créé avec succès !');
      onGroupCreated?.(newGroup.id);
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
    toast.success('Code copié dans le presse-papier !');
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const getWhatsAppMessage = () => {
    if (!createdGroup) return '';
    const shareUrl = `${window.location.origin}/?join=${createdGroup.joinCode}`;
    return encodeURIComponent(
      `👋 Salut ! Je viens de créer la tontine "${createdGroup.name}" sur Eganyé.\n\n` +
      `💰 Cotisation : ${createdGroup.potAmount / createdGroup.membersCount} FCFA ${frequencyLabel(createdGroup.frequency)}\n` +
      `🎁 Cagnotte par tour : ${createdGroup.potAmount.toLocaleString()} FCFA\n\n` +
      `Rejoins-nous directement avec le code : *${createdGroup.joinCode}*\n` +
      `👉 Clique ici pour rejoindre : ${shareUrl}`
    );
  };

  const closeButton = (
    <button
      type="button"
      onClick={() => setOpen(false)}
      aria-label="Fermer"
      className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer shrink-0"
    >
      <EganyeIcon name="close" size={18} />
    </button>
  );

  const startDateLabel = startDateValue
    ? new Date(startDateValue).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
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
            <Button className="btn-shine gradient-sunset flex items-center gap-2 text-white font-bold rounded-2xl px-4 py-2.5 shadow-md transition-all cursor-pointer">
              <EganyeIcon name="plus" size={18} strokeWidth={2.5} />
              <span>Créer un cercle</span>
            </Button>
          )
        }
      />

      {/* Plein écran sur téléphone ; sur ordinateur, un cadre au format
          téléphone pour garder la même expérience écran par écran. */}
      <DialogContent
        showCloseButton={false}
        showHandle={false}
        className="top-0 h-[100dvh] flex flex-col gap-0 p-0 pb-0 rounded-none bg-background overflow-hidden sm:h-[min(860px,92vh)] sm:max-w-md sm:rounded-[2rem] sm:pb-0"
      >
        {/* ── CAS 1 : ÉCRAN DE SUCCÈS & INVITATION WHATSAPP ── */}
        {createdGroup ? (
          <div className="flex-1 overflow-y-auto px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="space-y-5 text-center py-6 max-w-sm mx-auto">
              <DialogTitle className="sr-only">Cercle créé</DialogTitle>
              <div className="w-20 h-20 rounded-[28px] bg-[#EBF5EA] text-[#718A68] mx-auto flex items-center justify-center shadow-soft">
                <EganyeIcon name="check" size={38} strokeWidth={2.5} />
              </div>

              <div className="space-y-1.5">
                <h2 className="font-serif font-black text-2xl text-foreground tracking-tight">
                  Cercle créé avec succès ! 🎉
                </h2>
                <p className="text-sm text-muted-foreground">
                  Ton cercle <span className="font-bold text-foreground">{createdGroup.name}</span> est prêt. Il ne te reste plus qu'à inviter les participants !
                </p>
              </div>

              {/* Carte récapitulative du cercle */}
              <div className="bg-gradient-to-br from-[#FFF8F2] to-[#F8EFE3] dark:from-card dark:to-muted rounded-2xl p-4 border border-[#C96F4A]/25 text-left space-y-3">
                <div className="flex items-center justify-between border-b border-[#C96F4A]/15 pb-2.5">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cagnotte distribuée</span>
                  <span className="font-serif font-black text-xl text-[#C96F4A]">
                    {createdGroup.potAmount.toLocaleString()} FCFA
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Places prévues</span>
                  <span className="font-bold text-foreground">{createdGroup.membersCount} participants</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Code d'invitation</span>
                  <div className="flex items-center gap-1.5 font-mono font-black text-lg text-[#3E2F24] dark:text-foreground">
                    <span>{createdGroup.joinCode}</span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="p-1.5 rounded-md hover:bg-white/60 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                      title="Copier le code"
                    >
                      <EganyeIcon name={copiedCode ? "check" : "copy"} size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Gros bouton d'invitation WhatsApp */}
              <div className="space-y-2.5 pt-1">
                <a
                  href={`https://wa.me/?text=${getWhatsAppMessage()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-13 py-3.5 rounded-full bg-[#25D366] hover:bg-[#20BE5B] text-white font-bold text-[15px] shadow-md flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95"
                >
                  <EganyeIcon name="send" size={18} />
                  <span>Inviter mes proches sur WhatsApp</span>
                </a>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setOpen(false)}
                  className="w-full rounded-full font-bold cursor-pointer"
                >
                  Accéder au cercle
                </Button>
              </div>

              {/* Badge de réassurance sur la vérification */}
              <div className="p-3 rounded-xl bg-[#EBF5EA]/80 dark:bg-muted/60 border border-[#718A68]/20 flex items-center gap-2.5 text-left">
                <div className="w-6 h-6 rounded-full bg-[#718A68]/15 text-[#718A68] flex items-center justify-center shrink-0">
                  <EganyeIcon name="shield" size={13} />
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  <strong className="text-foreground">Sécurité :</strong> Les membres et vous pourrez valider votre pièce d'identité avant le lancement officiel des paiements.
                </p>
              </div>
            </div>
          </div>
        ) : kycState === 'checking' ? (
          /* Évite de montrer un formulaire de plusieurs étapes pendant la
             fraction de seconde qui précède le verdict KYC. */
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <DialogTitle className="sr-only">Chargement</DialogTitle>
            <div className="w-10 h-10 rounded-full border-[3px] border-border border-t-primary animate-spin" />
          </div>
        ) : kycState === 'required' ? (
          <div className="flex-1 flex flex-col">
            <div className="flex justify-end px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">{closeButton}</div>
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 px-6 pb-10">
              <div className="w-20 h-20 rounded-[28px] bg-[#C96F4A]/10 text-[#C96F4A] flex items-center justify-center">
                <EganyeIcon name="shield" size={36} />
              </div>

              <div className="space-y-2">
                <DialogTitle className="font-serif text-2xl font-bold text-foreground">
                  Vérification d'identité requise
                </DialogTitle>
                <p className="text-[15px] leading-relaxed text-muted-foreground max-w-sm">
                  Pour créer un cercle et gérer de l'argent réel, ton identité doit d'abord être vérifiée.
                </p>
              </div>

              <Button
                size="lg"
                onClick={() => {
                  setOpen(false);
                  onNavigateToVerification?.();
                }}
                className="btn-shine w-full max-w-sm rounded-full gradient-sunset text-white gap-2"
              >
                Vérifier mon identité
                <EganyeIcon name="chevron-right" size={18} />
              </Button>
            </div>
          </div>
        ) : (
          /* ── CAS 2 : UN ÉCRAN PAR QUESTION ── */
          <form onSubmit={onFormSubmit} className="flex-1 min-h-0 flex flex-col">
            {/* En-tête : retour, progression, fermer */}
            <div className="shrink-0 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 space-y-3">
              <div className="flex items-center gap-2">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    aria-label="Étape précédente"
                    className="w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:bg-muted cursor-pointer shrink-0"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                ) : (
                  <span className="w-10 h-10 shrink-0" />
                )}
                <p className="flex-1 text-center text-[13px] font-bold text-muted-foreground">
                  Étape {step} sur {TOTAL_STEPS}
                </p>
                {closeButton}
              </div>
              <div className="flex gap-1.5 px-2">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                      i < step ? 'bg-[#C96F4A]' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Contenu de l'écran courant, qui glisse latéralement */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
              <AnimatePresence mode="wait" initial={false} custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={slide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="px-5 pt-4 pb-6 space-y-6"
                >
                  <div className="space-y-1.5">
                    <DialogTitle className="font-serif text-[26px] leading-tight font-black text-foreground tracking-tight">
                      {STEPS[step - 1].title}
                    </DialogTitle>
                    <p className="text-[15px] text-muted-foreground">{STEPS[step - 1].subtitle}</p>
                  </div>

                  {/* ── 1. Nom ── */}
                  {step === 1 && (
                    <div className="space-y-5">
                      <div className="space-y-1.5">
                        <Input
                          id="name"
                          placeholder="Ex : Tontine Famille 2026"
                          {...register('name')}
                          className="rounded-2xl h-14 text-base font-semibold bg-card"
                          autoFocus
                        />
                        {errors.name && <p className="text-[13px] text-danger font-medium">{errors.name.message}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[13px] font-bold text-muted-foreground">Ou choisis une idée</Label>
                        <div className="space-y-2">
                          {PRESET_THEMES.map((theme) => (
                            <OptionCard
                              key={theme.label}
                              selected={groupName === theme.label}
                              onClick={() => {
                                setValue('name', theme.label, { shouldValidate: true });
                                setValue('description', theme.desc);
                              }}
                              title={theme.label}
                              hint={theme.desc}
                              icon={theme.icon}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="description" className="text-[13px] font-bold text-muted-foreground">
                          Objectif du cercle (facultatif)
                        </Label>
                        <Textarea
                          id="description"
                          placeholder="L'esprit du groupe ou l'objectif commun…"
                          className="resize-none rounded-2xl h-24 text-sm bg-card"
                          {...register('description')}
                        />
                      </div>
                    </div>
                  )}

                  {/* ── 2. Cotisation ── */}
                  {step === 2 && (
                    <div className="space-y-5">
                      <div className="rounded-3xl bg-card border border-border p-5 text-center space-y-1">
                        <div className="flex items-baseline justify-center gap-2">
                          <Input
                            id="contributionAmount"
                            type="number"
                            inputMode="numeric"
                            min={500}
                            step={500}
                            aria-label="Cotisation par participant en FCFA"
                            {...register('contributionAmount', { valueAsNumber: true })}
                            className="h-auto w-full max-w-[220px] border-0 bg-transparent p-0 text-center text-4xl font-serif font-black shadow-none focus-visible:ring-0"
                          />
                          <span className="text-lg font-bold text-muted-foreground">FCFA</span>
                        </div>
                        <p className="text-[13px] text-muted-foreground">par membre et par tour</p>
                      </div>
                      {errors.contributionAmount && (
                        <p className="text-[13px] text-danger font-medium">{errors.contributionAmount.message}</p>
                      )}

                      <div className="grid grid-cols-3 gap-2">
                        {PRESET_AMOUNTS.map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setValue('contributionAmount', amt, { shouldValidate: true })}
                            className={`h-12 rounded-2xl text-sm font-bold border-2 transition-colors cursor-pointer ${
                              contributionAmount === amt
                                ? 'border-[#C96F4A] bg-[#C96F4A]/10 text-[#C96F4A]'
                                : 'border-border bg-card text-foreground hover:bg-muted/60'
                            }`}
                          >
                            {amt.toLocaleString()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── 3. Participants ── */}
                  {step === 3 && (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between gap-4 rounded-3xl bg-card border border-border p-4">
                        <button
                          type="button"
                          onClick={() => setMembers(maxMembers - 1)}
                          aria-label="Un participant de moins"
                          className="w-14 h-14 rounded-2xl bg-muted text-foreground flex items-center justify-center hover:bg-muted/70 cursor-pointer shrink-0"
                        >
                          <Minus className="w-6 h-6" />
                        </button>
                        <div className="text-center">
                          <Input
                            id="maxMembers"
                            type="number"
                            inputMode="numeric"
                            min={2}
                            max={100}
                            aria-label={t('cgd_participants_label')}
                            {...register('maxMembers', { valueAsNumber: true })}
                            className="h-auto w-24 border-0 bg-transparent p-0 text-center text-5xl font-serif font-black shadow-none focus-visible:ring-0"
                          />
                          <p className="text-[13px] text-muted-foreground">participants</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setMembers(maxMembers + 1)}
                          aria-label="Un participant de plus"
                          className="w-14 h-14 rounded-2xl bg-muted text-foreground flex items-center justify-center hover:bg-muted/70 cursor-pointer shrink-0"
                        >
                          <Plus className="w-6 h-6" />
                        </button>
                      </div>
                      {errors.maxMembers && (
                        <p className="text-[13px] text-danger font-medium">{errors.maxMembers.message}</p>
                      )}

                      <div className="grid grid-cols-4 gap-2">
                        {PRESET_MEMBERS.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setMembers(n)}
                            className={`h-11 rounded-2xl text-sm font-bold border-2 transition-colors cursor-pointer ${
                              maxMembers === n
                                ? 'border-[#718A68] bg-[#EBF5EA] text-[#718A68]'
                                : 'border-border bg-card text-foreground hover:bg-muted/60'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>

                      {/* La cagnotte se calcule sous les yeux : l'intérêt du cercle */}
                      <div className="bg-gradient-to-br from-[#FFF4EC] to-[#F7ECE0] dark:from-card dark:to-muted rounded-3xl p-5 border border-[#C96F4A]/30 space-y-1 text-center">
                        <span className="text-[12px] font-bold uppercase tracking-wider text-[#C96F4A]">
                          Cagnotte par tour
                        </span>
                        <p className="text-3xl font-serif font-black text-foreground">
                          {totalPot.toLocaleString()} FCFA
                        </p>
                        <p className="text-[13px] text-muted-foreground">
                          {contributionAmount.toLocaleString()} FCFA × {maxMembers} participants. À chaque tour, un membre reçoit tout.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── 4. Rythme ── */}
                  {step === 4 && (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        {FREQUENCY_OPTIONS.map((opt) => (
                          <OptionCard
                            key={opt.value}
                            selected={frequency === opt.value}
                            onClick={() => setValue('frequency', opt.value, { shouldValidate: true })}
                            title={opt.label}
                            hint={opt.hint}
                          />
                        ))}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="startDate" className="text-[13px] font-bold text-muted-foreground">
                          Date du 1er tour
                        </Label>
                        <Input
                          id="startDate"
                          type="date"
                          min={new Date().toISOString().slice(0, 10)}
                          {...register('startDate')}
                          className="rounded-2xl h-14 text-base font-semibold bg-card"
                        />
                        {errors.startDate && (
                          <p className="text-[13px] text-danger font-medium">{errors.startDate.message}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── 5. Règles ── */}
                  {step === 5 && (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <Label className="text-[13px] font-bold text-muted-foreground">Qui reçoit la cagnotte ?</Label>
                        <OptionCard
                          selected={distributionMethod === 'draw'}
                          onClick={() => setValue('distributionMethod', 'draw')}
                          title="Tirage au sort"
                          hint="Le hasard désigne équitablement le bénéficiaire à chaque tour."
                          icon="shuffle"
                        />
                        <OptionCard
                          selected={distributionMethod === 'sequential'}
                          onClick={() => setValue('distributionMethod', 'sequential')}
                          title="Ordre convenu"
                          hint="Selon l'ordre d'inscription ou un accord entre membres."
                          icon="list"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border">
                          <div className="space-y-0.5">
                            <Label htmlFor="isPrivate" className="text-[15px] font-bold text-foreground cursor-pointer">
                              Cercle privé (recommandé)
                            </Label>
                            <p className="text-[13px] text-muted-foreground leading-snug">
                              On ne rejoint qu'avec ton code d'invitation.
                            </p>
                          </div>
                          <Switch
                            id="isPrivate"
                            checked={isPrivate}
                            onCheckedChange={(checked) => setValue('isPrivate', checked)}
                          />
                        </div>

                        <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border">
                          <div className="space-y-0.5">
                            <Label htmlFor="penaltiesEnabled" className="text-[15px] font-bold text-foreground cursor-pointer">
                              Pénalité de retard (1 000 FCFA)
                            </Label>
                            <p className="text-[13px] text-muted-foreground leading-snug">
                              Encourage chacun à respecter les échéances.
                            </p>
                          </div>
                          <Switch
                            id="penaltiesEnabled"
                            checked={penaltiesEnabled}
                            onCheckedChange={(checked) => setValue('penaltiesEnabled', checked)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── 6. Récapitulatif, engagement et signature ── */}
                  {step === 6 && (
                    <div className="space-y-5">
                      <div className="rounded-3xl bg-card border border-border divide-y divide-border">
                        {[
                          ['Cercle', groupName],
                          ['Cotisation', `${contributionAmount.toLocaleString()} FCFA ${frequencyLabel(frequency)}`],
                          ['Participants', `${maxMembers}`],
                          ['Cagnotte par tour', `${totalPot.toLocaleString()} FCFA`],
                          ['1er tour', startDateLabel],
                          ['Attribution', distributionMethod === 'draw' ? 'Tirage au sort' : 'Ordre convenu'],
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-bold text-foreground text-right truncate">{value}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-start gap-3 p-4 rounded-2xl bg-card border border-border">
                        <input
                          type="checkbox"
                          id="terms"
                          {...register('termsAccepted')}
                          className="mt-0.5 w-5 h-5 shrink-0 rounded border-border text-[#C96F4A] focus:ring-[#C96F4A]/50 cursor-pointer"
                        />
                        <div className="space-y-1">
                          <Label htmlFor="terms" className="text-[15px] font-bold text-foreground cursor-pointer">
                            Engagement de solidarité Eganyé
                          </Label>
                          <p className="text-[13px] text-muted-foreground leading-relaxed">
                            Je m'engage sur l'honneur à honorer mes versements et à respecter la confiance accordée par les membres de ce cercle.{' '}
                            <button
                              type="button"
                              onClick={() => setShowReglement(true)}
                              className="font-bold text-[#C96F4A] hover:underline cursor-pointer"
                            >
                              Lire le règlement des cercles
                            </button>
                          </p>
                          {errors.termsAccepted && (
                            <span className="text-[13px] text-danger font-medium block">{errors.termsAccepted.message}</span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[13px] font-bold text-muted-foreground">Ta signature</Label>
                        <SignaturePad
                          onSignatureChange={(dataUrl) => setValue('signature', dataUrl || '', { shouldValidate: true })}
                        />
                        {errors.signature && (
                          <span className="text-[13px] text-danger font-medium block">{errors.signature.message}</span>
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
                <Button
                  type="button"
                  size="lg"
                  onClick={handleNextStep}
                  className="btn-shine w-full rounded-full gradient-sunset text-white font-bold gap-2 cursor-pointer"
                >
                  Continuer
                  <ArrowRight className="w-5 h-5" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting}
                  className="btn-shine w-full rounded-full gradient-sunset text-white font-bold cursor-pointer"
                >
                  {isSubmitting ? 'Création en cours…' : 'Créer mon cercle'}
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
