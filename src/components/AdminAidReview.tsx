import { useEffect, useState } from 'react';
import { Check, ExternalLink, Gift, Loader2, PlayCircle, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AidApplicationForReview,
  fetchAidApplicationsForReview,
  getAidVideoUrl,
  grantAidApplication,
  rejectAidApplication,
} from '@/lib/aid';

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR');

interface AdminAidReviewProps {
  /** Nombre de dossiers à étudier, pour la pastille de l'onglet. */
  onPendingCountChange?: (count: number) => void;
}

/**
 * Étude des dossiers « Coup de pouce » : regarder la vidéo, lire le besoin,
 * puis verser l'aide (montant libre, rien à rembourser) ou refuser avec un motif.
 */
export function AdminAidReview({ onPendingCountChange }: AdminAidReviewProps) {
  const [apps, setApps] = useState<AidApplicationForReview[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const rows = await fetchAidApplicationsForReview();
    setApps(rows);
    onPendingCountChange?.(rows.length);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs mb-6">
      <CardHeader className="pb-4 bg-muted/30 border-b border-border flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-lg font-serif font-bold text-foreground flex items-center gap-2">
            <Gift className="w-5 h-5 text-brand" /> Dossiers Coup de pouce
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Aide gratuite, versée sur le portefeuille dès votre accord. Frais d'étude déjà encaissés.
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
          <p className="text-center py-12 text-muted-foreground text-xs font-medium">Aucun dossier à étudier.</p>
        ) : (
          <div className="divide-y divide-border">
            {apps.map((app) => <AidRow key={app.id} app={app} onDone={load} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AidRow({ app, onDone }: { app: AidApplicationForReview; onDone: () => void }) {
  const [amount, setAmount] = useState(String(app.requestedAmount));
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<'grant' | 'reject'>('grant');
  const [busy, setBusy] = useState(false);

  const openVideo = async () => {
    if (app.videoUrl) return window.open(app.videoUrl, '_blank', 'noopener');
    if (!app.videoPath) return;
    const url = await getAidVideoUrl(app.videoPath);
    if (!url) return toast.error('Impossible d’ouvrir la vidéo.');
    window.open(url, '_blank', 'noopener');
  };

  const grant = async () => {
    const a = Math.round(Number(amount));
    if (!a || a <= 0) return toast.error('Indiquez le montant de l’aide.');
    if (!window.confirm(`Verser ${fcfa(a)} à ${app.userName} ? Cet argent ne sera pas remboursé.`)) return;
    setBusy(true);
    const res = await grantAidApplication(app.id, a, notes.trim());
    setBusy(false);
    if (!res.success) return toast.error(res.message);
    toast.success(`${fcfa(a)} versés à ${app.userName}.`);
    onDone();
  };

  const reject = async () => {
    if (reason.trim().length < 5) return toast.error('Expliquez le motif du refus à la personne.');
    setBusy(true);
    const res = await rejectAidApplication(app.id, reason.trim());
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
        <Button variant="outline" size="sm" onClick={openVideo} className="h-9 rounded-xl text-xs font-bold shrink-0">
          {app.videoUrl ? <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> : <PlayCircle className="w-3.5 h-3.5 mr-1.5" />}
          Voir la vidéo
        </Button>
      </div>

      <p className="text-xs text-foreground leading-relaxed whitespace-pre-line bg-muted/30 rounded-2xl p-3">{app.projectDescription}</p>
      <p className="text-[13px] text-brand font-bold">Demande : {fcfa(app.requestedAmount)}</p>

      <div className="bg-muted/30 border border-border rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant={mode === 'grant' ? 'default' : 'outline'} onClick={() => setMode('grant')} className="h-9 rounded-xl text-xs font-bold">
            <Check className="w-3.5 h-3.5 mr-1.5" /> Accorder
          </Button>
          <Button size="sm" variant={mode === 'reject' ? 'default' : 'outline'} onClick={() => setMode('reject')} className="h-9 rounded-xl text-xs font-bold">
            <X className="w-3.5 h-3.5 mr-1.5" /> Refuser
          </Button>
        </div>

        {mode === 'grant' ? (
          <>
            <div className="space-y-1">
              <Label className="text-[12px] font-bold text-muted-foreground">Montant versé (FCFA)</Label>
              <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10 rounded-xl bg-card" />
            </div>
            <Textarea rows={2} placeholder="Message pour la personne (facultatif)" value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl bg-card text-xs" />
            <Button onClick={grant} disabled={busy} className="btn-shine w-full h-10 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/90 text-white">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verser l’aide'}
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
    </div>
  );
}
