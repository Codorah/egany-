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

import { db, auth } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { calculateNextPayoutDate } from '@/lib/disbursements';

const formSchema = z.object({
  name: z.string().min(2, "Le nom du groupe doit avoir au moins 2 caractères."),
  description: z.string().min(10, "La description doit avoir au moins 10 caractères."),
  contributionAmount: z.number().min(100, "Le montant minimum est de 100."),
  frequency: z.enum(['daily', 'weekly', 'bi-weekly', 'monthly']),
  currency: z.string().min(1),
  distributionMethod: z.enum(['sequential', 'draw', 'auction']),
  penaltiesEnabled: z.boolean(),
  penaltyType: z.enum(['fixed', 'percentage']),
  penaltyAmount: z.number().min(0),
  penaltyRate: z.number().min(0),
  gracePeriod: z.number().min(0),
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
      penaltiesEnabled: false,
      penaltyType: "fixed",
      penaltyAmount: 500,
      penaltyRate: 1,
      gracePeriod: 2,
    },
  });

  const penaltiesEnabled = watch('penaltiesEnabled');
  const penaltyType = watch('penaltyType');

  const onSubmit = async (values: FormValues) => {
    if (!auth.currentUser) return;

    try {
      const joinCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const startDate = new Date().toISOString();
      const groupData = {
        name: values.name,
        description: values.description,
        contributionAmount: values.contributionAmount,
        frequency: values.frequency,
        currency: values.currency,
        distributionMethod: values.distributionMethod,
        ...(values.penaltiesEnabled ? {
          penaltyType: values.penaltyType,
          penaltyAmount: values.penaltyType === 'fixed' ? values.penaltyAmount : 0,
          penaltyRate: values.penaltyType === 'percentage' ? values.penaltyRate : 0,
          gracePeriod: values.gracePeriod,
        } : {}),
        creatorId: auth.currentUser.uid,
        members: [auth.currentUser.uid],
        status: 'active',
        payoutOrder: [auth.currentUser.uid],
        currentPayoutIndex: 0,
        startDate,
        nextPayoutDate: calculateNextPayoutDate(startDate, values.frequency),
        createdAt: serverTimestamp(),
        joinCode,
      };

      await addDoc(collection(db, 'groups'), groupData);
      toast.success("Cercle créé avec succès !");
      setOpen(false);
      reset();
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Erreur lors de la création du groupe.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger || <Button className="flex items-center gap-2 bg-[#E67E22] hover:bg-[#E67E22]/90 text-white font-bold rounded-2xl px-4 py-2.5 shadow-md transition-all cursor-pointer" />}>
        {trigger ? undefined : (
          <>
            <Plus className="w-4.5 h-4.5" />
            Nouveau Cercle
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-3xl bg-white border border-[#D4A574]/30">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-bold text-[#4B2E05]">Créer un nouveau cercle</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Configurez votre tontine digitale. Vous pourrez inviter des proches et automatiser les cotisations après sa création.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-bold text-[#4B2E05]">Nom du cercle</Label>
            <Input id="name" placeholder="Ex: Cotisation de Solidarité" {...register("name")} disabled={isSubmitting} className="rounded-xl border-slate-200 focus:ring-[#2BB673]" />
            {errors.name && <p className="text-[11px] text-red-600 font-semibold">{errors.name.message}</p>}
          </div>
          
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-bold text-[#4B2E05]">Description / Objectif</Label>
            <Textarea 
              id="description"
              placeholder="Ex: Financer l'achat d'un terrain, équipement ou s'entraider pour des projets..." 
              className="resize-none rounded-xl border-slate-200 focus:ring-[#2BB673] h-20 text-xs" 
              {...register("description")}
              disabled={isSubmitting}
            />
            {errors.description && <p className="text-[11px] text-red-600 font-semibold">{errors.description.message}</p>}
          </div>
 
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="contributionAmount" className="text-xs font-bold text-[#4B2E05]">Montant (FCFA)</Label>
              <Input id="contributionAmount" type="number" {...register("contributionAmount", { valueAsNumber: true })} disabled={isSubmitting} className="rounded-xl border-slate-200 focus:ring-[#2BB673]" />
              {errors.contributionAmount && <p className="text-[11px] text-red-600 font-semibold">{errors.contributionAmount.message}</p>}
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="frequency" className="text-xs font-bold text-[#4B2E05]">Fréquence</Label>
              <Select onValueChange={(val) => setValue("frequency", val as any)} disabled={isSubmitting}>
                <SelectTrigger id="frequency" className="rounded-xl border-slate-200">
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Quotidienne</SelectItem>
                  <SelectItem value="weekly">Hebdomadaire</SelectItem>
                  <SelectItem value="bi-weekly">Bi-hebdomadaire</SelectItem>
                  <SelectItem value="monthly">Mensuelle</SelectItem>
                </SelectContent>
              </Select>
              {errors.frequency && <p className="text-[11px] text-red-600 font-semibold">{errors.frequency.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="distributionMethod" className="text-xs font-bold text-[#4B2E05]">Méthode de distribution</Label>
            <Select defaultValue="sequential" onValueChange={(val) => setValue("distributionMethod", val as any)} disabled={isSubmitting}>
              <SelectTrigger id="distributionMethod" className="rounded-xl border-slate-200">
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sequential">Rotation séquentielle</SelectItem>
                <SelectItem value="draw">Tirage au sort</SelectItem>
                <SelectItem value="auction">Enchères (bientôt disponible)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="penaltiesEnabled" className="text-xs font-bold text-[#4B2E05]">Pénalités de retard</Label>
              <button
                id="penaltiesEnabled"
                type="button"
                onClick={() => setValue("penaltiesEnabled", !penaltiesEnabled)}
                disabled={isSubmitting}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  penaltiesEnabled ? 'bg-[#2BB673]' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    penaltiesEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {penaltiesEnabled && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-2 bg-white p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setValue("penaltyType", "fixed")}
                    className={`text-[11px] font-bold py-1.5 rounded-md ${penaltyType === 'fixed' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
                  >
                    Montant fixe
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue("penaltyType", "percentage")}
                    className={`text-[11px] font-bold py-1.5 rounded-md ${penaltyType === 'percentage' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
                  >
                    Pourcentage / jour
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="penaltyValue" className="text-[10px] font-bold text-slate-500 uppercase">
                      {penaltyType === 'fixed' ? 'Montant (FCFA)' : 'Taux (% / jour)'}
                    </Label>
                    {penaltyType === 'fixed' ? (
                      <Input id="penaltyValue" type="number" {...register("penaltyAmount", { valueAsNumber: true })} disabled={isSubmitting} className="rounded-xl border-slate-200 focus:ring-[#2BB673]" />
                    ) : (
                      <Input id="penaltyValue" type="number" step="0.1" {...register("penaltyRate", { valueAsNumber: true })} disabled={isSubmitting} className="rounded-xl border-slate-200 focus:ring-[#2BB673]" />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gracePeriod" className="text-[10px] font-bold text-slate-500 uppercase">Délai de grâce (jours)</Label>
                    <Input id="gracePeriod" type="number" {...register("gracePeriod", { valueAsNumber: true })} disabled={isSubmitting} className="rounded-xl border-slate-200 focus:ring-[#2BB673]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="submit" className="w-full bg-[#2BB673] hover:bg-[#2BB673]/90 text-white font-bold rounded-2xl h-11 shadow-sm cursor-pointer" disabled={isSubmitting}>
              {isSubmitting ? "Création en cours..." : "Créer le cercle d'épargne"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
