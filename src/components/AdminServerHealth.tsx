import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiUrl } from '@/lib/apiBase';

interface HealthChecks {
  supabaseUrl: boolean;
  supabaseServiceKey: boolean;
  paydunya: boolean;
  paydunyaLive: boolean;
  sms: boolean;
  email: boolean;
  ai: boolean;
}

/**
 * Bandeau d'alerte du panneau admin : signale tout réglage serveur manquant
 * (voir api/health.ts) et permet de rattraper un paiement Paydunya payé mais
 * jamais crédité.
 */
export function AdminServerHealth() {
  const [checks, setChecks] = useState<HealthChecks | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/api/health'), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setChecks)
      .catch(() => setUnreachable(true));
  }, []);

  if (unreachable) {
    return (
      <Banner title="Impossible de vérifier la configuration du serveur">
        Le bilan /api/health ne répond pas. Les dépôts Mobile Money pourraient ne pas être crédités.
      </Banner>
    );
  }
  if (!checks) return null;

  const problems: string[] = [];
  if (!checks.supabaseUrl || !checks.supabaseServiceKey) {
    problems.push(
      "SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_URL) manque sur Vercel : les dépôts PayDunya payés ne sont PAS crédités, et les SMS, e-mails, WhatsApp et le Copilote IA sont bloqués."
    );
  }
  if (!checks.paydunya) problems.push('Les clés PayDunya manquent : aucun dépôt ne peut être lancé.');
  else if (!checks.paydunyaLive) problems.push('PayDunya est en mode test (sandbox) : les dépôts ne sont pas réels.');
  if (!checks.sms) problems.push('Aucun fournisseur SMS configuré.');
  if (!checks.email) problems.push('RESEND_API_KEY manque : aucun e-mail ne part.');
  if (!checks.ai) problems.push('ANTHROPIC_API_KEY manque : le Copilote IA ne répond pas.');

  const canCredit = checks.supabaseUrl && checks.supabaseServiceKey && checks.paydunya;

  return (
    <div className="space-y-3 mb-6">
      {problems.length > 0 && (
        <Banner title="Configuration du serveur incomplète">
          <ul className="list-disc pl-4 space-y-1">
            {problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <p className="mt-2">À corriger dans Vercel → projet → Settings → Environment Variables (Production), puis redéployer.</p>
        </Banner>
      )}
      {canCredit && <RecoverPayment />}
    </div>
  );
}

function Banner({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-danger-soft border border-danger/30 rounded-2xl p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
      <div className="text-xs text-foreground leading-relaxed">
        <p className="font-bold text-danger mb-1">{title}</p>
        {children}
      </div>
    </div>
  );
}

/**
 * Renvoie un jeton de facture au webhook : il revérifie le paiement auprès de
 * PayDunya et ne crédite qu'une facture réellement payée, une seule fois
 * (clé d'idempotence = jeton). Sert à rattraper les dépôts perdus pendant une
 * panne de configuration.
 */
function RecoverPayment() {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);

  const recover = async () => {
    const value = token.trim();
    if (!value) return toast.error('Collez le token de la facture PayDunya.');
    setBusy(true);
    try {
      const res = await fetch(apiUrl('/api/paydunya-webhook'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.credited) {
        toast.success('Paiement confirmé par PayDunya : portefeuille crédité (ou déjà crédité).');
        setToken('');
      } else if (res.ok) {
        toast.error(`PayDunya indique que cette facture n'est pas payée (statut : ${data.status || 'inconnu'}).`);
      } else {
        toast.error(data.error || `Échec (HTTP ${res.status}).`);
      }
    } catch {
      toast.error('Réseau indisponible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
      <p className="text-xs font-bold text-foreground">Rattraper un paiement PayDunya non crédité</p>
      <p className="text-[12px] text-muted-foreground">
        Copiez le token d'une facture payée depuis votre tableau de bord PayDunya. Il est revérifié auprès de PayDunya et ne peut jamais être crédité deux fois.
      </p>
      <div className="flex gap-2">
        <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token de la facture" className="h-10 rounded-xl" />
        <Button onClick={recover} disabled={busy} className="h-10 rounded-xl text-xs font-bold shrink-0">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Créditer'}
        </Button>
      </div>
    </div>
  );
}
