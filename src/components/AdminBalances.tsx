import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Loader2, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fetchBalancesOverview, memberTotal, type BalancesOverview, type MemberBalance } from '@/lib/adminBalances';

const PAGE = 50;

function money(value: number): string {
  return `${value.toLocaleString('fr-FR')} F`;
}

function Figure({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-muted-foreground leading-snug">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${muted || value === 0 ? 'text-muted-foreground' : 'text-foreground'}`}>
        {money(value)}
      </p>
    </div>
  );
}

function MemberRow({ member }: { member: MemberBalance }) {
  const [open, setOpen] = useState(false);
  const hasDetail = member.vaults.length > 0;

  return (
    <div className="p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{member.name}</p>
          <p className="text-[13px] text-muted-foreground truncate">{member.email}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[13px] text-muted-foreground">Total</p>
          <p className="text-base font-serif font-bold text-foreground tabular-nums">{money(memberTotal(member))}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-2">
        <Figure label="Portefeuille" value={member.wallet} />
        <Figure label={`Coffres (${member.vaults.length})`} value={member.savings} />
        <Figure label="Retrait en cours" value={member.pendingWithdrawals} />
        <Figure label="Crédit à rembourser" value={member.creditDue} />
        <Figure label="Cotisé (cumul)" value={member.contributed} muted />
      </div>

      {hasDetail && (
        <div>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="flex items-center gap-1 py-1 text-[13px] font-bold text-primary-ink cursor-pointer"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            {open ? 'Masquer les coffres' : 'Voir les coffres'}
          </button>
          {open && (
            <ul className="mt-2 rounded-xl bg-muted/50 divide-y divide-border">
              {member.vaults.map((vault) => {
                const locked = new Date(vault.unlockAt).getTime() > Date.now();
                return (
                  <li key={vault.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-foreground truncate">{vault.name}</p>
                      <p className="text-[13px] text-muted-foreground">
                        {locked ? `Bloqué jusqu'au ${new Date(vault.unlockAt).toLocaleDateString('fr-FR')}` : 'Disponible'}
                      </p>
                    </div>
                    <span className="text-[13px] font-bold text-foreground tabular-nums shrink-0">{money(vault.balance)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Vue en lecture seule de l'argent des membres. Rien ici ne modifie un solde. */
export function AdminBalances() {
  const [overview, setOverview] = useState<BalancesOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlyWithMoney, setOnlyWithMoney] = useState(true);
  const [visible, setVisible] = useState(PAGE);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setOverview(await fetchBalancesOverview());
    } catch (err: any) {
      // Pas de chiffres plutôt que des chiffres faux.
      setOverview(null);
      setError(err.message || 'Lecture des soldes impossible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!overview) return [];
    const query = search.trim().toLowerCase();
    return overview.members
      .filter((m) => !onlyWithMoney || memberTotal(m) > 0 || m.creditDue > 0)
      .filter((m) => !query || m.name.toLowerCase().includes(query) || m.email.toLowerCase().includes(query))
      .sort((a, b) => memberTotal(b) - memberTotal(a));
  }, [overview, search, onlyWithMoney]);

  useEffect(() => { setVisible(PAGE); }, [search, onlyWithMoney]);

  return (
    <Card className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
      <CardHeader className="pb-4 bg-muted/30 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-serif font-bold text-foreground">Soldes des membres</CardTitle>
            <CardDescription className="text-[13px] text-muted-foreground mt-0.5">
              Combien chaque personne a chez eganyé. Cette page ne modifie rien.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-9 rounded-xl text-xs font-bold shrink-0">
            {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Actualiser
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {error && (
          <div className="p-5 flex items-start gap-2 text-danger" role="alert">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-[13px] font-bold">{error}</p>
          </div>
        )}

        {loading && !overview && (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {overview && (
          <>
            <div className="p-4 sm:p-5 border-b border-border space-y-4">
              <div>
                <p className="text-[13px] text-muted-foreground">Argent détenu pour les membres</p>
                <p className="text-2xl font-serif font-bold text-foreground tabular-nums">{money(overview.totals.heldForMembers)}</p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-x-4 gap-y-3">
                <Figure label="Portefeuilles" value={overview.totals.wallets} />
                <Figure label="Coffres d'épargne" value={overview.totals.savings} />
                <Figure label="Cagnottes des cercles" value={overview.totals.circlePots} />
                <Figure label="Retraits en cours" value={overview.totals.pendingWithdrawals} />
                <Figure label="Crédits à rembourser (non compris)" value={overview.totals.creditDue} muted />
              </div>
            </div>

            <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  aria-label="Chercher un membre"
                  placeholder="Nom ou e-mail"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-11 text-base rounded-xl bg-card border-border"
                />
              </div>
              <label className="flex items-center gap-2 text-[13px] font-bold text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyWithMoney}
                  onChange={(e) => setOnlyWithMoney(e.target.checked)}
                  className="w-5 h-5 shrink-0 accent-[#C96F4A] cursor-pointer"
                />
                Seulement ceux qui ont de l'argent
              </label>
            </div>

            {filtered.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground text-[13px] font-medium">Aucun membre trouvé.</p>
            ) : (
              <div className="divide-y divide-border">
                {filtered.slice(0, visible).map((member) => (
                  <MemberRow key={member.uid} member={member} />
                ))}
              </div>
            )}

            {filtered.length > visible && (
              <div className="p-4 border-t border-border">
                <Button variant="outline" onClick={() => setVisible((v) => v + PAGE)} className="w-full h-11 rounded-xl text-xs font-bold">
                  Voir plus ({filtered.length - visible} restants)
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
