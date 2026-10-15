import { useEffect, useState } from 'react';
import { Check, ExternalLink, Loader2, PlayCircle, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CREDIT_MAX_MONTHS,
  CreditApplicationForReview,
  fetchCreditApplicationsForReview,
  getCreditVideoUrl,
  makeCreditOffer,
  offerTotal,
  rejectCreditApplication,
  remainingDue,
} from '@/lib/credit';

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR');

interface AdminCreditReviewProps {
  /** Nombre de dossiers en attente de décision, pour la pastille de l'onglet. */
  onPendingCountChange?: (count: number) => void;
}

/**
 * Étude des dossiers de microcrédit : lire le projet, regarder la vidéo,
 * puis faire une offre (montant, taux, durée) ou refuser avec un motif.
 * Suit aussi les offres en attente de réponse et les crédits en cours.
 */
export function AdminCreditReview({ onPendingCountChange }: AdminCreditReviewProps) {
  const [apps, setApps] = useState<CreditApplicationForReview[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const rows = await fetchCreditApplicationsForReview();
    setApps(rows);
    onPendingCountChange?.(rows.filter((a) => a.status === 'submitted').length);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = [
    { status: 'submitted', title: 'À étudier' },
    { status: 'offered', title: 'Offres en attente de réponse' },
    { status: 'active', title: 'Crédits en cours' },
  ] as const;

  return (
    <Card className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs mb-6">
      <CardHeader className="pb-4 bg-muted/30 border-b border-border flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-lg font-serif font-bold text-foreground">Dossiers de microcrédit</CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Frais de dossier déjà encaissés. L'argent n'est versé que lorsque la personne accepte votre offre.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-9 rounded-xl shrink-0" title="Actualiser">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : apps.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground text-xs font-medium">Aucun dossier de crédit en cours.</p>
        ) : (
          groups.map(({ status, title }) => {
            const list = apps.filter((a) => a.status === status);
            if (list.length === 0) return null;
            return (
              <div key={status}>
                <p className="px-5 pt-4 pb-1 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">{title} ({list.length})</p>
                <div className="divide-y divide-border">
                  {list.map((app) => <ApplicationRow key={app.id} app={app} onDone={load} />)}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function ApplicationRow({ app, onDone }: { app: CreditApplicationForReview; onDone: () => void }) {
  const [amount, setAmount] = useState(String(app.requestedAmount));
  const [rate, setRate] = useState('10');
  const [months, setMonths] = useState(String(app.requestedMonths));
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<'offer' | 'reject'>('offer');
  const [busy, setBusy] = useState(false);

  const total = offerTotal(Number(amount) || 0, Number(rate) || 0);
  const lateCount = app.installments.filter((i) => i.status === 'late').length;

  const openVideo = async () => {
    if (app.videoUrl) return window.open(app.videoUrl, '_blank', 'noopener');
    if (!app.videoPath) return;
    const url = await getCreditVideoUrl(app.videoPath);
    if (!url) return toast.error('Impossible d’ouvrir la vidéo.');
    window.open(url, '_blank', 'noopener');
  };

  const sendOffer = async () => {
    const a = Number(amount), r = Number(rate), m = Number(months);
    if (!a || a <= 0) return toast.error('Indiquez le montant offert.');
    if (!(r >= 0 && r <= 100)) return toast.error('Le taux doit être entre 0 et 100 %.');
    if (!m || m < 1 || m > CREDIT_MAX_MONTHS) return toast.error(`La durée doit être entre 1 et ${CREDIT_MAX_MONTHS} mois.`);
    setBusy(true);
    const res = await makeCreditOffer({ applicationId: app.id, offeredAmount: a, interestRate: r, durationMonths: m, adminNotes: notes.trim() });
    setBusy(false);
    if (!res.success) return toast.error(res.message);
    toast.success(`Offre envoyée à ${app.userName}.`);
    onDone();
  };

  const reject = async () => {
    if (reason.trim().length < 5) return toast.error('Expliquez le motif du refus à la personne.');
    setBusy(true);
    const res = await rejectCreditApplication(app.id, reason.trim());
    setBusy(false);
    if (!res.success) return toast.error(res.message);
    toast.success('Dossier refusé, la personne est prévenue.');
    onDone();
  };

  return (
    <div className="p-5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <p className="text-sm font-bold text-foreground">{app.projectTitle}</p>
          <p className="text-[13px] text-muted-foreground">{app.userName} • {app.userEmail}</p>
          <p className="text-[13px] text-muted-foreground">
            Épargne : {fcfa(app.userTotalSaved)} • Réputation : {app.userReputation} • Déposé le {dateFr(app.createdAt)}
          </p>
        </div>
        {(app.videoPath || app.videoUrl) && (
          <Button variant="outline" size="sm" onClick={openVideo} className="h-9 rounded-xl text-xs font-bold shrink-0">
            {app.videoUrl ? <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> : <PlayCircle className="w-3.5 h-3.5 mr-1.5" />}
            Voir la vidéo
          </Button>
        )}
      </div>

      <p className="text-xs text-foreground leading-relaxed whitespace-pre-line bg-muted/30 rounded-2xl p-3">{app.projectDescription}</p>
      <p className="text-[13px] text-brand font-bold">
        Demande : {fcfa(app.requestedAmount)} sur {app.requestedMonths} mois
      </p>

      {app.status === 'submitted' && (
        <div className="bg-muted/30 border border-border rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant={mode === 'offer' ? 'default' : 'outline'} onClick={() => setMode('offer')} className="h-9 rounded-xl text-xs font-bold">
              <Check className="w-3.5 h-3.5 mr-1.5" /> Faire une offre
            </Button>
            <Button size="sm" variant={mode === 'reject' ? 'default' : 'outline'} onClick={() => setMode('reject')} className="h-9 rounded-xl text-xs font-bold">
              <X className="w-3.5 h-3.5 mr-1.5" /> Refuser
            </Button>
          </div>

          {mode === 'offer' ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[12px] font-bold text-muted-foreground">Montant (FCFA)</Label>
                  <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10 rounded-xl bg-card" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[12px] font-bold text-muted-foreground">Taux (%)</Label>
                  <Input type="number" min={0} max={100} step="0.5" value={rate} onChange={(e) => setRate(e.target.value)} className="h-10 rounded-xl bg-card" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[12px] font-bold text-muted-foreground">Durée (mois)</Label>
                  <Input type="number" min={1} max={CREDIT_MAX_MONTHS} value={months} onChange={(e) => setMonths(e.target.value)} className="h-10 rounded-xl bg-card" />
                </div>
              </div>
              <p className="text-xs text-foreground">
                La personne remboursera <strong>{fcfa(total)}</strong>
                {Number(months) > 0 && <> , soit environ <strong>{fcfa(Math.floor(total / Number(months)))}</strong> par mois</>}.
              </p>
              <Textarea rows={2} placeholder="Message pour la personne (facultatif)" value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl bg-card text-xs" />
              <Button onClick={sendOffer} disabled={busy} className="btn-shine w-full h-10 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/90 text-white">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Envoyer l’offre'}
              </Button>
            </>
          ) : (
            <>
              <Textarea rows={3} placeholder="Motif du refus, envoyé à la personne" value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-xl bg-card text-xs" />
              <Button onClick={reject} disabled={busy} variant="outline" className="w-full h-10 rounded-xl text-xs font-bold border-danger/30 text-danger hover:bg-danger-soft">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refuser le dossier'}
              </Button>
            </>
          )}
        </div>
      )}

      {app.status === 'offered' && (
        <p className="text-xs text-muted-foreground">
          Offre envoyée le {app.offeredAt ? dateFr(app.offeredAt) : '—'} : {fcfa(app.offeredAmount ?? 0)} à {app.interestRate} % sur {app.durationMonths} mois
          (total {fcfa(app.totalDue ?? 0)}). En attente de la réponse de la personne.
        </p>
      )}

      {app.status === 'active' && (
        <p className="text-xs text-muted-foreground">
          Versé le {app.disbursedAt ? dateFr(app.disbursedAt) : '—'} • Remboursé {fcfa(app.repaidAmount)} sur {fcfa(app.totalDue ?? 0)} •
          Reste {fcfa(remainingDue(app))}
          {lateCount > 0 && <span className="text-danger font-bold"> • {lateCount} mensualité(s) en retard</span>}
        </p>
      )}
    </div>
  );
}
