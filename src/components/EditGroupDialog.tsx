import React, { useEffect, useState } from 'react';
import { ArrowLeft, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import { calculateNextPayoutDate } from '@/lib/disbursements';
import type { Frequency, Group } from '@/types';

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'monthly', label: 'Chaque mois' },
  { value: 'bi-weekly', label: 'Tous les 15 jours' },
  { value: 'weekly', label: 'Chaque semaine' },
  { value: 'daily', label: 'Chaque jour' },
];

const DEFAULT_PENALTY = 1000;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3.5 space-y-2">
      <div>
        <p className="text-sm font-bold text-foreground">{label}</p>
        {hint && <p className="text-[13px] text-muted-foreground leading-snug">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[13px] font-bold text-muted-foreground px-3">{title}</h3>
      <div className="bg-card rounded-2xl border border-border shadow-soft divide-y divide-border">{children}</div>
    </section>
  );
}

/**
 * Corriger un cercle mal configuré. Tant qu'aucun argent n'a circulé, tout se
 * modifie ; ensuite seuls le nom, l'objectif et la confidentialité restent
 * modifiables (la migration 0029 l'impose aussi côté serveur).
 */
export function EditGroupDialog({
  group,
  moneyMoved,
  open,
  onOpenChange,
}: {
  group: Group;
  moneyMoved: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || '');
  const [isPrivate, setIsPrivate] = useState(group.isPrivate !== false);
  const [amount, setAmount] = useState(String(group.contributionAmount));
  const [maxMembers, setMaxMembers] = useState(group.maxMembers ?? Math.max(group.members.length, 2));
  const [frequency, setFrequency] = useState<Frequency>(group.frequency);
  const [startDate, setStartDate] = useState(group.startDate.slice(0, 10));
  const [distribution, setDistribution] = useState<string>(group.distributionMethod ?? 'draw');
  const [penalties, setPenalties] = useState((group.penaltyAmount ?? 0) > 0 || (group.penaltyRate ?? 0) > 0);
  const [saving, setSaving] = useState(false);

  // Repartir des valeurs actuelles à chaque ouverture.
  useEffect(() => {
    if (!open) return;
    setName(group.name);
    setDescription(group.description || '');
    setIsPrivate(group.isPrivate !== false);
    setAmount(String(group.contributionAmount));
    setMaxMembers(group.maxMembers ?? Math.max(group.members.length, 2));
    setFrequency(group.frequency);
    setStartDate(group.startDate.slice(0, 10));
    setDistribution(group.distributionMethod ?? 'draw');
    setPenalties((group.penaltyAmount ?? 0) > 0 || (group.penaltyRate ?? 0) > 0);
  }, [open, group]);

  const minMembers = Math.max(2, group.members.length);

  const save = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) return toast.error('Le nom doit comporter au moins 2 caractères.');

    const patch: Record<string, unknown> = {
      name: trimmedName,
      description: description.trim() || 'Tontine collective et solidaire Eganyé',
      is_private: isPrivate,
    };

    if (!moneyMoved) {
      const amt = Math.round(Number(amount));
      if (!amt || amt < 500) return toast.error('La cotisation minimale est de 500 FCFA.');
      if (maxMembers < minMembers || maxMembers > 100) {
        return toast.error(`Le nombre de places doit être compris entre ${minMembers} et 100.`);
      }
      if (!startDate) return toast.error('Choisissez la date du 1er tour.');
      const startIso = new Date(startDate).toISOString();
      Object.assign(patch, {
        contribution_amount: amt,
        max_members: maxMembers,
        frequency,
        distribution_method: distribution,
        start_date: startIso,
        next_payout_date: calculateNextPayoutDate(startIso, frequency),
        ...(penalties
          ? { penalty_type: 'fixed', penalty_amount: group.penaltyAmount || DEFAULT_PENALTY, penalty_rate: 0, grace_period: group.gracePeriod ?? 2 }
          : { penalty_amount: 0, penalty_rate: 0 }),
      });
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.from('groups').update(patch).eq('id', group.id).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Modification refusée.');
      toast.success('Cercle mis à jour.');
      onOpenChange(false);
    } catch (err: any) {
      console.error('Group update error:', err);
      toast.error(err?.message || 'Modification impossible.');
    } finally {
      setSaving(false);
    }
  };

  const pot = (Math.round(Number(amount)) || 0) * maxMembers;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        showHandle={false}
        className="top-0 h-[100dvh] flex flex-col gap-0 p-0 pb-0 rounded-none bg-background overflow-hidden sm:h-[min(860px,92vh)] sm:max-w-md sm:rounded-[2rem] sm:pb-0"
      >
        <div className="shrink-0 flex items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Retour"
            className="w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:bg-muted cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <DialogTitle className="flex-1 font-serif text-lg font-black text-foreground">Modifier le cercle</DialogTitle>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 space-y-5">
          <Block title="Le cercle">
            <Field label="Nom">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl h-12 bg-background" />
            </Field>
            <Field label="Objectif" hint="Facultatif">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="resize-none rounded-xl h-20 bg-background" />
            </Field>
            <div className="flex items-center justify-between gap-3 px-4 py-3.5">
              <div>
                <p className="text-sm font-bold text-foreground">Cercle privé</p>
                <p className="text-[13px] text-muted-foreground">On ne rejoint qu'avec le code d'invitation.</p>
              </div>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
            </div>
          </Block>

          {moneyMoved ? (
            <p className="text-[13px] text-muted-foreground bg-muted/50 rounded-2xl p-4 leading-relaxed">
              Des cotisations ont déjà été versées : le montant, le rythme et les règles ne peuvent plus changer,
              pour rester juste envers les membres qui ont payé.
            </p>
          ) : (
            <>
              <Block title="L'argent">
                <Field label="Cotisation par membre (FCFA)">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={500}
                    step={500}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="rounded-xl h-12 text-lg font-bold bg-background"
                  />
                </Field>
                <Field label="Participants" hint={group.members.length > 1 ? `Au moins ${minMembers} : des membres ont déjà rejoint.` : undefined}>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setMaxMembers((n) => Math.max(minMembers, n - 1))}
                      aria-label="Un participant de moins"
                      className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <span className="text-3xl font-serif font-black text-foreground">{maxMembers}</span>
                    <button
                      type="button"
                      onClick={() => setMaxMembers((n) => Math.min(100, n + 1))}
                      aria-label="Un participant de plus"
                      className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </Field>
                <div className="flex items-center justify-between px-4 py-3.5 text-sm">
                  <span className="text-muted-foreground">Cagnotte par tour</span>
                  <span className="font-bold text-foreground">{pot.toLocaleString()} FCFA</span>
                </div>
              </Block>

              <Block title="Le rythme">
                <Field label="Fréquence">
                  <div className="grid grid-cols-2 gap-2">
                    {FREQUENCIES.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setFrequency(f.value)}
                        className={`h-11 rounded-xl text-sm font-bold border-2 cursor-pointer transition-colors ${
                          frequency === f.value ? 'border-[#C96F4A] bg-[#C96F4A]/10 text-[#C96F4A]' : 'border-border text-foreground'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Date du 1er tour">
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-xl h-12 bg-background" />
                </Field>
              </Block>

              <Block title="Les règles">
                <Field label="Qui reçoit la cagnotte ?">
                  <div className="grid grid-cols-2 gap-2">
                    {([['draw', 'Tirage au sort'], ['sequential', 'Ordre convenu']] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDistribution(value)}
                        className={`h-11 rounded-xl text-sm font-bold border-2 cursor-pointer transition-colors ${
                          distribution === value ? 'border-[#C96F4A] bg-[#C96F4A]/10 text-[#C96F4A]' : 'border-border text-foreground'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>
                <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div>
                    <p className="text-sm font-bold text-foreground">Pénalité de retard</p>
                    <p className="text-[13px] text-muted-foreground">{(group.penaltyAmount || DEFAULT_PENALTY).toLocaleString()} FCFA par retard</p>
                  </div>
                  <Switch checked={penalties} onCheckedChange={setPenalties} />
                </div>
              </Block>
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-border bg-background px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            size="lg"
            onClick={save}
            disabled={saving}
            className="btn-shine w-full rounded-full gradient-sunset text-white font-bold cursor-pointer"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
