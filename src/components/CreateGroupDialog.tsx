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

const formSchema = z.object({
  name: z.string().min(2, "Le nom du groupe doit avoir au moins 2 caractères."),
  description: z.string().min(10, "La description doit avoir au moins 10 caractères."),
  contributionAmount: z.number().min(100, "Le montant minimum est de 100."),
  frequency: z.enum(['weekly', 'bi-weekly', 'monthly']),
  currency: z.string().min(1),
});

type FormValues = z.infer<typeof formSchema>;

export function CreateGroupDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const { register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      contributionAmount: 0,
      frequency: "monthly",
      currency: "FCFA",
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!auth.currentUser) return;

    try {
      const joinCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const groupData = {
        ...values,
        creatorId: auth.currentUser.uid,
        members: [auth.currentUser.uid],
        status: 'active',
        payoutOrder: [auth.currentUser.uid],
        currentPayoutIndex: 0,
        startDate: new Date().toISOString(),
        nextPayoutDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), 
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
                  <SelectItem value="weekly">Hebdomadaire</SelectItem>
                  <SelectItem value="bi-weekly">Bi-hebdomadaire</SelectItem>
                  <SelectItem value="monthly">Mensuelle</SelectItem>
                </SelectContent>
              </Select>
              {errors.frequency && <p className="text-[11px] text-red-600 font-semibold">{errors.frequency.message}</p>}
            </div>
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
