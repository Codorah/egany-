import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Plus } from 'lucide-react';
import { SignaturePad } from './SignaturePad';

import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { calculateNextPayoutDate } from '@/lib/disbursements';
import { KYC_VERIFIED_LEVEL } from '@/lib/kyc';

const formSchema = z.object({
  name: z.string().min(2, "Le nom du groupe doit avoir au moins 2 caractères."),
  description: z.string().min(10, "La description doit avoir au moins 10 caractères."),
  contributionAmount: z.number().min(100, "Le montant minimum est de 100."),
  frequency: z.enum(['daily', 'weekly', 'bi-weekly', 'monthly']),
  currency: z.string().min(1),
  distributionMethod: z.enum(['sequential', 'draw', 'auction']),
  maxMembers: z.number().min(2, "Il faut au moins 2 participants.").max(500),
  startDate: z.string().min(1, "La date de début est requise."),
  endDate: z.string().optional(),
  rules: z.string().optional(),
  isPrivate: z.boolean(),
  penaltiesEnabled: z.boolean(),
  penaltyType: z.enum(['fixed', 'percentage']),
  penaltyAmount: z.number().min(0),
  penaltyRate: z.number().min(0),
  gracePeriod: z.number().min(0),
  termsAccepted: z.boolean().refine(val => val === true, "Vous devez accepter les conditions."),
  signature: z.string().min(1, "La signature électronique est requise."),
}).refine((data) => !data.endDate || data.endDate >= data.startDate, {
  message: "La date de fin doit être postérieure à la date de début.",
  path: ["endDate"],
});

type FormValues = z.infer<typeof formSchema>;

export function CreateGroupDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      contributionAmount: 0,
      frequency: "monthly",
      currency: "FCFA",
      distributionMethod: "sequential",
      maxMembers: 10,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
      rules: "",
      isPrivate: false,
      penaltiesEnabled: true,
      penaltyType: "percentage",
      penaltyAmount: 0,
      penaltyRate: 1,
      gracePeriod: 1,
      termsAccepted: false,
      signature: "",
    },
  });

  const penaltiesEnabled = watch('penaltiesEnabled');
  const penaltyType = watch('penaltyType');
  const isPrivate = watch('isPrivate');

  const onSubmit = async (values: FormValues) => {
    if (!navigator.onLine) {
      toast.error("Vous êtes hors-ligne. La création d'un cercle nécessite une connexion internet.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('kyc_level')
        .eq('id', user.id)
        .single();
      if (profileError) throw profileError;
      if ((profileRow?.kyc_level ?? 1) < KYC_VERIFIED_LEVEL) {
        toast.error("Vérifiez votre identité (Profil > Vérification d'identité) avant de créer un cercle.");
        return;
      }

      const joinCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const startDate = new Date(values.startDate).toISOString();
      const groupData = {
        name: values.name,
        description: values.description,
        contribution_amount: values.contributionAmount,
        frequency: values.frequency,
        currency: values.currency,
        distribution_method: values.distributionMethod,
        max_members: values.maxMembers,
        is_private: values.isPrivate,
        ...(values.endDate ? { end_date: new Date(values.endDate).toISOString() } : {}),
        ...(values.rules ? { rules: values.rules } : {}),
        ...(values.penaltiesEnabled ? {
          penalty_type: values.penaltyType,
          penalty_amount: values.penaltyType === 'fixed' ? values.penaltyAmount : 0,
          penalty_rate: values.penaltyType === 'percentage' ? values.penaltyRate : 0,
          grace_period: values.gracePeriod,
        } : {}),
        creator_id: user.id,
        status: 'active',
        start_date: startDate,
        next_payout_date: calculateNextPayoutDate(startDate, values.frequency),
        join_code: joinCode,
      };

      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert(groupData)
        .select()
        .single();
      if (groupError) throw groupError;

      const { error: memberError } = await supabase
        .from('group_members')
        .insert({ group_id: newGroup.id, user_id: user.id, status: 'active', payout_position: 0 });
      if (memberError) throw memberError;

      toast.success("Cercle créé avec succès !");
      setOpen(false);
      reset();
    } catch (error: any) {
      console.error("Error creating group:", error);
      toast.error("Erreur lors de la création du groupe.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        nativeButton={!trigger}
        render={trigger || <Button className="flex items-center gap-2 bg-brand hover:bg-brand/90 text-white font-bold rounded-2xl px-4 py-2.5 shadow-md transition-all cursor-pointer" />}
      >
        {trigger ? undefined : (
          <>
            <Plus className="w-4.5 h-4.5" />
            Nouveau Cercle
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto rounded-3xl bg-card border border-border">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-bold text-foreground">Créer un nouveau cercle</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configurez votre tontine digitale. Vous pourrez inviter des proches et automatiser les cotisations après sa création.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-bold text-foreground">Nom du cercle</Label>
            <Input id="name" placeholder="Ex: Cotisation de Solidarité" {...register("name")} disabled={isSubmitting} className="rounded-xl border-border focus:ring-secondary" />
            {errors.name && <p className="text-[11px] text-danger font-semibold">{errors.name.message}</p>}
          </div>
          
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-bold text-foreground">Description / Objectif</Label>
            <Textarea 
              id="description"
              placeholder="Ex: Financer l'achat d'un terrain, équipement ou s'entraider pour des projets..." 
              className="resize-none rounded-xl border-border focus:ring-secondary h-20 text-xs" 
              {...register("description")}
              disabled={isSubmitting}
            />
            {errors.description && <p className="text-[11px] text-danger font-semibold">{errors.description.message}</p>}
          </div>
 
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="contributionAmount" className="text-xs font-bold text-foreground">Montant (FCFA)</Label>
              <Input id="contributionAmount" type="number" {...register("contributionAmount", { valueAsNumber: true })} disabled={isSubmitting} className="rounded-xl border-border focus:ring-secondary" />
              {errors.contributionAmount && <p className="text-[11px] text-danger font-semibold">{errors.contributionAmount.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="frequency" className="text-xs font-bold text-foreground">Fréquence</Label>
              <Select onValueChange={(val) => setValue("frequency", val as any)} disabled={isSubmitting}>
                <SelectTrigger id="frequency" className="rounded-xl border-border">
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Quotidienne</SelectItem>
                  <SelectItem value="weekly">Hebdomadaire</SelectItem>
                  <SelectItem value="bi-weekly">Bi-hebdomadaire</SelectItem>
                  <SelectItem value="monthly">Mensuelle</SelectItem>
                </SelectContent>
              </Select>
              {errors.frequency && <p className="text-[11px] text-danger font-semibold">{errors.frequency.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="maxMembers" className="text-xs font-bold text-foreground">Nombre de participants</Label>
              <Input id="maxMembers" type="number" {...register("maxMembers", { valueAsNumber: true })} disabled={isSubmitting} className="rounded-xl border-border focus:ring-secondary" />
              {errors.maxMembers && <p className="text-[11px] text-danger font-semibold">{errors.maxMembers.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="distributionMethod" className="text-xs font-bold text-foreground">Méthode de distribution</Label>
              <Select defaultValue="sequential" onValueChange={(val) => setValue("distributionMethod", val as any)} disabled={isSubmitting}>
                <SelectTrigger id="distributionMethod" className="rounded-xl border-border">
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">Rotation séquentielle</SelectItem>
                  <SelectItem value="draw">Tirage au sort</SelectItem>
                  <SelectItem value="auction">Enchères (bientôt disponible)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="startDate" className="text-xs font-bold text-foreground">Date de début</Label>
              <Input id="startDate" type="date" {...register("startDate")} disabled={isSubmitting} className="rounded-xl border-border focus:ring-secondary" />
              {errors.startDate && <p className="text-[11px] text-danger font-semibold">{errors.startDate.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate" className="text-xs font-bold text-foreground">Date de fin (optionnel)</Label>
              <Input id="endDate" type="date" {...register("endDate")} disabled={isSubmitting} className="rounded-xl border-border focus:ring-secondary" />
              {errors.endDate && <p className="text-[11px] text-danger font-semibold">{errors.endDate.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rules" className="text-xs font-bold text-foreground">Règles du cercle (optionnel)</Label>
            <Textarea
              id="rules"
              placeholder="Ex: Tout retard de plus de 3 jours entraîne une pénalité. Toute exclusion nécessite un vote..."
              className="resize-none rounded-xl border-border focus:ring-secondary h-16 text-xs"
              {...register("rules")}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center justify-between bg-muted p-3.5 rounded-2xl border border-border">
            <div>
              <Label htmlFor="isPrivate" className="text-xs font-bold text-foreground">Cercle privé</Label>
              <p className="text-[10px] text-muted-foreground">Invisible dans la recherche publique ; rejoignable uniquement par lien, QR code ou code.</p>
            </div>
            <button
              id="isPrivate"
              type="button"
              onClick={() => setValue("isPrivate", !isPrivate)}
              disabled={isSubmitting}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isPrivate ? 'bg-secondary' : 'bg-muted'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-card shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isPrivate ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="bg-muted p-3.5 rounded-2xl border border-border space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="penaltiesEnabled" className="text-xs font-bold text-foreground">Pénalités de retard</Label>
              <button
                id="penaltiesEnabled"
                type="button"
                onClick={() => setValue("penaltiesEnabled", !penaltiesEnabled)}
                disabled={isSubmitting}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  penaltiesEnabled ? 'bg-secondary' : 'bg-muted'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-card shadow-lg ring-0 transition duration-200 ease-in-out ${
                    penaltiesEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {penaltiesEnabled && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-2 bg-card p-0.5 rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setValue("penaltyType", "fixed")}
                    className={`text-[11px] font-bold py-1.5 rounded-md ${penaltyType === 'fixed' ? 'bg-foreground text-background' : 'text-muted-foreground'}`}
                  >
                    Montant fixe
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue("penaltyType", "percentage")}
                    className={`text-[11px] font-bold py-1.5 rounded-md ${penaltyType === 'percentage' ? 'bg-foreground text-background' : 'text-muted-foreground'}`}
                  >
                    Pourcentage / jour
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="penaltyValue" className="text-[10px] font-bold text-muted-foreground uppercase">
                      {penaltyType === 'fixed' ? 'Montant (FCFA)' : 'Taux (% / jour)'}
                    </Label>
                    {penaltyType === 'fixed' ? (
                      <Input id="penaltyValue" type="number" {...register("penaltyAmount", { valueAsNumber: true })} disabled={isSubmitting} className="rounded-xl border-border focus:ring-secondary" />
                    ) : (
                      <Input id="penaltyValue" type="number" step="0.1" {...register("penaltyRate", { valueAsNumber: true })} disabled={isSubmitting} className="rounded-xl border-border focus:ring-secondary" />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gracePeriod" className="text-[10px] font-bold text-muted-foreground uppercase">Délai de grâce (jours)</Label>
                    <Input id="gracePeriod" type="number" {...register("gracePeriod", { valueAsNumber: true })} disabled={isSubmitting} className="rounded-xl border-border focus:ring-secondary" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-muted/50 p-4 rounded-xl border border-border space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Validation Légale</h4>
            
            <div className="flex items-start gap-3">
              <input 
                type="checkbox" 
                id="terms" 
                {...register("termsAccepted")}
                className="mt-1 w-4 h-4 rounded border-border text-brand focus:ring-brand/50"
              />
              <div className="space-y-1">
                <Label htmlFor="terms" className="text-sm font-bold text-foreground cursor-pointer">
                  J'accepte les conditions générales et la politique de gestion de tontine.
                </Label>
                <p className="text-xs text-muted-foreground">
                  En tant que gestionnaire, vous vous engagez à respecter les règles de transparence établies par égané.
                </p>
                {errors.termsAccepted && <span className="text-[10px] text-danger">{errors.termsAccepted.message}</span>}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/50">
              <Label className="text-sm font-bold text-foreground">Signature Électronique</Label>
              <SignaturePad onSignatureChange={(dataUrl) => setValue('signature', dataUrl || '', { shouldValidate: true })} />
              {errors.signature && <span className="text-[10px] text-danger">{errors.signature.message}</span>}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="submit" className="w-full bg-secondary hover:bg-secondary/90 text-white font-bold rounded-2xl h-11 shadow-sm cursor-pointer" disabled={isSubmitting}>
              {isSubmitting ? "Création en cours..." : "Créer le cercle d'épargne"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
