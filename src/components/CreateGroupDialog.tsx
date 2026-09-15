import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

function buildFormSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(2, t('cgd_err_name_min') || 'Le nom doit comporter au moins 2 caractères'),
    description: z.string().optional(),
    contributionAmount: z.number().min(500, 'Le montant minimum est de 500 FCFA'),
    frequency: z.enum(['daily', 'weekly', 'bi-weekly', 'monthly']),
    currency: z.string().min(1),
    distributionMethod: z.enum(['sequential', 'draw', 'auction']),
    maxMembers: z.number().min(2, 'Le cercle doit compter au moins 2 participants').max(500),
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
  const TOTAL_STEPS = 3;

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
    if (step === 1) {
      const valid = await triggerValidation(['name']);
      if (!valid) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      const valid = await triggerValidation(['contributionAmount', 'maxMembers', 'startDate']);
      if (!valid) return;
      setStep(3);
    }
  };

  const handlePrevStep = () => setStep((s) => Math.max(s - 1, 1));

  const resetForm = () => {
    reset();
    setStep(1);
    setCreatedGroup(null);
    setCopiedCode(false);
  };

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

      const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
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
        join_code: joinCode,
        creator_id: user.id,
        ...(values.penaltiesEnabled ? {
          penalty_type: 'fixed',
          penalty_amount: values.penaltyAmount ?? 1000,
          penalty_rate: 0,
          grace_period: 2,
        } : {}),
      };

      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert(groupData)
        .select()
        .single();
      if (groupError) throw groupError;

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

  return (
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

      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto rounded-3xl bg-card border border-border p-5 sm:p-6">
        {/* ── CAS 1 : ÉCRAN DE SUCCÈS & INVITATION WHATSAPP ── */}
        {createdGroup ? (
          <div className="space-y-5 text-center py-2">
            <div className="w-16 h-16 rounded-3xl bg-[#EBF5EA] text-[#718A68] mx-auto flex items-center justify-center shadow-soft">
              <EganyeIcon name="check" size={32} strokeWidth={2.5} />
            </div>

            <div className="space-y-1">
              <h2 className="font-serif font-black text-2xl text-foreground tracking-tight">
                Cercle créé avec succès ! 🎉
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
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

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Places prévues</span>
                <span className="font-bold text-foreground">{createdGroup.membersCount} participants</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Code d'invitation</span>
                <div className="flex items-center gap-1.5 font-mono font-black text-base text-[#3E2F24] dark:text-foreground">
                  <span>{createdGroup.joinCode}</span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="p-1 rounded-md hover:bg-white/60 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    title="Copier le code"
                  >
                    <EganyeIcon name={copiedCode ? "check" : "copy"} size={15} />
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
                className="w-full h-12 rounded-2xl bg-[#25D366] hover:bg-[#20BE5B] text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95"
              >
                <EganyeIcon name="send" size={17} />
                <span>Inviter mes proches sur WhatsApp</span>
              </a>

              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                className="w-full h-11 rounded-2xl font-bold cursor-pointer"
              >
                Accéder au cercle
              </Button>
            </div>

            {/* Badge de réassurance sur la vérification */}
            <div className="p-3 rounded-xl bg-[#EBF5EA]/80 dark:bg-muted/60 border border-[#718A68]/20 flex items-center gap-2.5 text-left">
              <div className="w-6 h-6 rounded-full bg-[#718A68]/15 text-[#718A68] flex items-center justify-center shrink-0">
                <EganyeIcon name="shield" size={13} />
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                <strong className="text-foreground">Sécurité :</strong> Les membres et vous pourrez valider votre pièce d'identité avant le lancement officiel des paiements.
              </p>
            </div>
          </div>
        ) : kycState === 'checking' ? (
          /* Évite de montrer un formulaire de plusieurs étapes pendant la
             fraction de seconde qui précède le verdict KYC. */
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="w-10 h-10 rounded-full border-[3px] border-border border-t-primary animate-spin" />
            <span className="sr-only">Chargement</span>
          </div>
        ) : kycState === 'required' ? (
          <div className="flex flex-col items-center text-center gap-5 py-4">
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

            <div className="w-full space-y-3 pt-1">
              <Button
                size="lg"
                onClick={() => {
                  setOpen(false);
                  onNavigateToVerification?.();
                }}
                className="btn-shine w-full rounded-2xl gradient-sunset text-white gap-2"
              >
                Vérifier mon identité
                <EganyeIcon name="chevron-right" size={18} />
              </Button>
            </div>
          </div>
        ) : (
          /* ── CAS 2 : LE WIZARD DE CRÉATION FLUIDE ── */
          <>
            <DialogHeader className="space-y-1">
              <DialogTitle className="font-serif text-xl sm:text-2xl font-black text-foreground">
                Créer un cercle d'épargne
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Configure ta tontine en 3 étapes simples et invite tes proches.
              </p>
            </DialogHeader>

            {/* Stepper visuel épuré */}
            <div className="space-y-1.5 pt-2">
              <div className="flex gap-1.5">
                {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                      i < step ? 'bg-[#C96F4A]' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
              <p className="text-[11px] font-bold text-muted-foreground">
                Étape {step} sur {TOTAL_STEPS} · {
                  step === 1 ? 'Identité du cercle' : step === 2 ? 'Règles financières' : 'Solidarité & Signature'
                }
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
              {/* ── ÉTAPE 1 : Identité & Objectif ── */}
              {step === 1 && (
                <div className="space-y-4">
                  {/* Suggestions de thèmes rapides */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Idées de cercles fréquents</Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {PRESET_THEMES.map((theme) => (
                        <button
                          key={theme.label}
                          type="button"
                          onClick={() => {
                            setValue('name', theme.label);
                            setValue('description', theme.desc);
                          }}
                          className={`py-1 px-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                            groupName === theme.label
                              ? 'border-[#C96F4A] bg-[#C96F4A]/10 text-[#C96F4A]'
                              : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/60'
                          }`}
                        >
                          {theme.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Nom du cercle */}
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs font-bold text-foreground">
                      Nom du cercle <span className="text-[#C96F4A]">*</span>
                    </Label>
                    <Input
                      id="name"
                      placeholder="Ex: Tontine Famille 2026, Épargne Moto..."
                      {...register('name')}
                      className="rounded-xl h-12 text-sm font-semibold"
                      autoFocus
                    />
                    {errors.name && <p className="text-[11px] text-danger font-medium">{errors.name.message}</p>}
                  </div>

                  {/* Description courte */}
                  <div className="space-y-1.5">
                    <Label htmlFor="description" className="text-xs font-bold text-foreground">
                      Objectif du cercle (optionnel)
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="Décris l'esprit du groupe ou l'objectif commun..."
                      className="resize-none rounded-xl h-20 text-xs"
                      {...register('description')}
                    />
                  </div>

                  {/* Switch Cercle Privé */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/50 border border-border">
                    <div className="space-y-0.5">
                      <Label htmlFor="isPrivate" className="text-xs font-bold text-foreground cursor-pointer">
                        Cercle privé (recommandé)
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Accessible uniquement via ton code d'invitation ou QR code.
                      </p>
                    </div>
                    <Switch
                      id="isPrivate"
                      checked={isPrivate}
                      onCheckedChange={(checked) => setValue('isPrivate', checked)}
                    />
                  </div>
                </div>
              )}

              {/* ── ÉTAPE 2 : Règles financières & Cagnotte magique ── */}
              {step === 2 && (
                <div className="space-y-4">
                  {/* Encadré dynamique de la Cagnotte (Effet Waouh) */}
                  <div className="bg-gradient-to-br from-[#FFF4EC] to-[#F7ECE0] dark:from-card dark:to-muted rounded-2xl p-4 border border-[#C96F4A]/30 space-y-1 text-center">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#C96F4A]">
                      Cagnotte par tour
                    </span>
                    <p className="text-2xl sm:text-3xl font-serif font-black text-foreground">
                      {totalPot.toLocaleString()} FCFA
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Chaque tour, un participant reçoit l'intégralité de cette cagnotte !
                    </p>
                  </div>

                  {/* Montant de la cotisation */}
                  <div className="space-y-2">
                    <Label htmlFor="contributionAmount" className="text-xs font-bold text-foreground">
                      Cotisation par participant (FCFA)
                    </Label>
                    <Input
                      id="contributionAmount"
                      type="number"
                      min={500}
                      step={500}
                      {...register('contributionAmount', { valueAsNumber: true })}
                      className="rounded-xl h-12 text-lg font-serif font-black"
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      {PRESET_AMOUNTS.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setValue('contributionAmount', amt)}
                          className={`py-1 px-2.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                            contributionAmount === amt
                              ? 'border-[#C96F4A] bg-[#C96F4A]/10 text-[#C96F4A]'
                              : 'border-border text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {amt.toLocaleString()}
                        </button>
                      ))}
                    </div>
                    {errors.contributionAmount && (
                      <p className="text-[11px] text-danger font-medium">{errors.contributionAmount.message}</p>
                    )}
                  </div>

                  {/* Fréquence & Nombre de membres */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="frequency" className="text-xs font-bold text-foreground">
                        Fréquence
                      </Label>
                      <Select
                        defaultValue="monthly"
                        value={frequency}
                        onValueChange={(val: any) => setValue('frequency', val)}
                      >
                        <SelectTrigger id="frequency" className="rounded-xl h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Mensuelle</SelectItem>
                          <SelectItem value="bi-weekly">Tous les 15 jours</SelectItem>
                          <SelectItem value="weekly">Hebdomadaire</SelectItem>
                          <SelectItem value="daily">Quotidienne</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="maxMembers" className="text-xs font-bold text-foreground">
                        Participants
                      </Label>
                      <Input
                        id="maxMembers"
                        type="number"
                        min={2}
                        max={100}
                        {...register('maxMembers', { valueAsNumber: true })}
                        className="rounded-xl h-11 font-bold"
                      />
                    </div>
                  </div>

                  {/* Suggestions pour nombre de membres */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground mr-1">Taille fréquente :</span>
                    {PRESET_MEMBERS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setValue('maxMembers', n)}
                        className={`py-0.5 px-2 rounded-md text-xs font-bold border transition-colors cursor-pointer ${
                          maxMembers === n
                            ? 'border-[#718A68] bg-[#EBF5EA] text-[#718A68]'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {n} pers.
                      </button>
                    ))}
                  </div>

                  {/* Date de début du premier tour */}
                  <div className="space-y-1.5 pt-1">
                    <Label htmlFor="startDate" className="text-xs font-bold text-foreground">
                      Date de lancement du 1er tour
                    </Label>
                    <Input
                      id="startDate"
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      {...register('startDate')}
                      className="rounded-xl h-11 text-xs font-medium"
                    />
                  </div>
                </div>
              )}

              {/* ── ÉTAPE 3 : Distribution & Charte de solidarité ── */}
              {step === 3 && (
                <div className="space-y-4">
                  {/* Méthode de distribution */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Mode d'attribution de la cagnotte</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setValue('distributionMethod', 'draw')}
                        className={`p-3 rounded-2xl border-2 text-left space-y-1 cursor-pointer transition-colors ${
                          watch('distributionMethod') === 'draw'
                            ? 'border-[#C96F4A] bg-[#C96F4A]/5 text-[#C96F4A]'
                            : 'border-border text-foreground hover:bg-muted/60'
                        }`}
                      >
                        <div className="font-bold text-xs flex items-center gap-1.5">
                          <EganyeIcon name="shuffle" size={14} />
                          <span>Tirage au sort</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Le hasard désigne équitablement le gagnant à chaque tour.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setValue('distributionMethod', 'sequential')}
                        className={`p-3 rounded-2xl border-2 text-left space-y-1 cursor-pointer transition-colors ${
                          watch('distributionMethod') === 'sequential'
                            ? 'border-[#C96F4A] bg-[#C96F4A]/5 text-[#C96F4A]'
                            : 'border-border text-foreground hover:bg-muted/60'
                        }`}
                      >
                        <div className="font-bold text-xs flex items-center gap-1.5">
                          <EganyeIcon name="list" size={14} />
                          <span>Ordre convenu</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Selon l'ordre d'inscription ou accord entre membres.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Pénalité de retard symbolique */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border">
                    <div>
                      <Label htmlFor="penaltiesEnabled" className="text-xs font-bold text-foreground cursor-pointer">
                        Pénalité de retard symbolique (1 000 FCFA)
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Encourage la discipline financière et le respect des échéances.
                      </p>
                    </div>
                    <Switch
                      id="penaltiesEnabled"
                      checked={penaltiesEnabled}
                      onCheckedChange={(checked) => setValue('penaltiesEnabled', checked)}
                    />
                  </div>

                  {/* Charte d'engagement solidaire */}
                  <div className="bg-[#FDFBF7] dark:bg-card p-4 rounded-2xl border border-[#EFE2D0] dark:border-border/80 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        id="terms"
                        {...register('termsAccepted')}
                        className="mt-0.5 w-4 h-4 rounded border-border text-[#C96F4A] focus:ring-[#C96F4A]/50 cursor-pointer"
                      />
                      <div className="space-y-0.5">
                        <Label htmlFor="terms" className="text-xs font-bold text-foreground cursor-pointer">
                          Engagement de solidarité Eganyé
                        </Label>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Je m'engage sur l'honneur à honorer mes versements et à respecter la confiance accordée par les membres de ce cercle.
                        </p>
                        {errors.termsAccepted && (
                          <span className="text-[11px] text-danger font-medium block">{errors.termsAccepted.message}</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 pt-1 border-t border-border/60">
                      <Label className="text-xs font-bold text-foreground">Signature tactile du créateur</Label>
                      <SignaturePad
                        onSignatureChange={(dataUrl) => setValue('signature', dataUrl || '', { shouldValidate: true })}
                      />
                      {errors.signature && (
                        <span className="text-[11px] text-danger font-medium block">{errors.signature.message}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Barre d'action de bas de formulaire */}
              <div className="flex gap-2 pt-2">
                {step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevStep}
                    disabled={isSubmitting}
                    className="flex-1 rounded-2xl h-11 font-bold cursor-pointer"
                  >
                    Retour
                  </Button>
                )}

                {step < TOTAL_STEPS ? (
                  <Button
                    type="button"
                    onClick={handleNextStep}
                    className="btn-shine gradient-sunset flex-1 text-white font-bold rounded-2xl h-11 shadow-sm cursor-pointer"
                  >
                    Continuer
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="btn-shine gradient-sunset flex-1 text-white font-bold rounded-2xl h-11 shadow-sm cursor-pointer"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Création en cours...' : 'Créer mon cercle'}
                  </Button>
                )}
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
