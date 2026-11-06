import React, { useEffect, useState } from 'react';
import { supabase, createChannel } from '@/lib/supabase';
import { fetchMemberProfiles } from '@/lib/members';
import { mapContributionRow, mapPayoutRow } from '@/lib/mappers';
import { executeFinancialTransaction } from '@/lib/ledger';
import { Group, UserProfile, Contribution, Payout } from '@/types';
import { Button } from '@/components/ui/button';
import { Check, ChevronRight, Download, FileSpreadsheet, FileText, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from './ui/StatusBadge';
import { MemberCard } from './ui/MemberCard';
import { ScreenBar } from './ui/ScreenBar';
import { Skeleton } from './ui/Skeleton';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';

interface ContributionsManagerProps {
  group: Group;
  user: UserProfile;
  onBack: () => void;
  /** Affiché dans la fiche du cercle : pas de second en-tête ni de caisse en double. */
  embedded?: boolean;
  onNavigateToVerification?: () => void;
  /** Arrivée par « Cotiser » : ouvre tout de suite la déclaration de la cotisation due. */
  autoDeclare?: boolean;
}

export function ContributionsManager({ group, user, onBack, onNavigateToVerification, embedded = false, autoDeclare = false }: ContributionsManagerProps) {
  const { t } = useLanguage();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showKycPrompt, setShowKycPrompt] = useState(false);
  const [actionsFor, setActionsFor] = useState<UserProfile | null>(null);
  // Une opération financière (déclarer/valider/rejeter un paiement) par
  // clé "action-cibleId" à la fois : un double-tap sur mobile réseau lent
  // ne doit jamais créer deux fois la même écriture comptable.
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());

  const isManager = user.uid === group.creatorId || user.role === 'admin';

  useBackHandler(
    React.useCallback(() => {
      setActionsFor(null);
      return true;
    }, []),
    actionsFor !== null
  );

  const setBusy = (key: string, val: boolean) => {
    setBusyKeys((prev) => {
      const next = new Set(prev);
      if (val) next.add(key); else next.delete(key);
      return next;
    });
  };

  useEffect(() => {
    const fetchMembers = async () => {
      if (!isManager || group.members.length === 0) return;
      setMembers(await fetchMemberProfiles(group.members));
    };

    fetchMembers();

    const fetchContributions = async () => {
      let queryBuilder = supabase.from('contributions').select('*').eq('group_id', group.id);
      if (!isManager) queryBuilder = queryBuilder.eq('user_id', user.uid);
      const { data, error } = await queryBuilder.order('date', { ascending: false });
      if (error) {
        console.error("Error fetching contributions:", error);
        setLoading(false);
        return;
      }
      setContributions((data ?? []).map(mapContributionRow));
      setLoading(false);
    };

    fetchContributions();

    const channel = createChannel(`contributions-${group.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contributions', filter: `group_id=eq.${group.id}` },
        () => fetchContributions()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [group.id, group.members, isManager, user.uid]);

  useEffect(() => {
    if (!isManager) return;

    const fetchPayouts = async () => {
      const { data, error } = await supabase.from('payouts').select('*').eq('group_id', group.id);
      if (error) {
        console.error("Error fetching payouts:", error);
        return;
      }
      setPayouts((data ?? []).map(mapPayoutRow));
    };

    fetchPayouts();

    const channel = createChannel(`payouts-${group.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payouts', filter: `group_id=eq.${group.id}` }, () => fetchPayouts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [group.id, isManager]);

  const handleUpdateStatus = async (contribution: Contribution, newStatus: 'paid' | 'pending' | 'late' | 'pending_approval') => {
    const key = `status-${contribution.id}`;
    if (busyKeys.has(key)) return;
    setBusy(key, true);
    try {
      if (newStatus === 'paid' && contribution.status !== 'paid') {
        // Valider un paiement reçu hors de l'app, c'est de l'argent entre les mains de
        // l'organisateur : il doit entrer au grand livre, seule source du pot depuis la
        // migration 0038. Sans cette écriture, le serveur refuserait la distribution.
        const penalty = contribution.penaltyStatus === 'pending' ? contribution.penaltyApplied || 0 : 0;
        const ledger = await executeFinancialTransaction({
          idempotencyKey: `manual_cash_${contribution.id}`,
          userId: contribution.userId,
          amount: contribution.amount + penalty,
          currency: group.currency || 'FCFA',
          description: `Cotisation validée (hors application) - ${group.name} (${contribution.period || ''})`,
          actionType: 'contribution_payment',
          debitAccount: `external_cash:${contribution.userId}`,
          creditAccount: `tontine_group:${group.id}`,
          metadata: { contributionId: contribution.id, groupId: group.id },
        });
        if (!ledger.success) throw new Error(ledger.message);
      }
      const { error } = await supabase.from('contributions').update({ status: newStatus }).eq('id', contribution.id);
      if (error) throw error;
      toast.success(t('status_updated'));
      setActionsFor(null);
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error(error?.message || t('status_update_error'));
    } finally {
      setBusy(key, false);
    }
  };

  const handleSubmitProof = async (contributionId: string, reference: string) => {
    try {
      const { error } = await supabase.from('contributions').update({
        status: 'pending_approval',
        proof_reference: reference,
        proof_submitted_at: new Date().toISOString()
      }).eq('id', contributionId);
      if (error) throw error;
      toast.success(t('proof_submitted'));
    } catch (error) {
      console.error("Error submitting proof:", error);
      toast.error(t('error_submitting'));
      throw error;
    }
  };

  const handleCreateContribution = async (userId: string, userName: string, userEmail?: string) => {
    const key = `create-${userId}`;
    if (busyKeys.has(key)) return;
    setBusy(key, true);
    try {
      const period = formatPeriod(new Date());
      const existing = await findPeriodContribution(userId, period);
      if (existing) {
        toast.info(`${userName} a déjà une cotisation pour ${period}.`);
        return;
      }
      const { error } = await supabase.from('contributions').insert({
        group_id: group.id,
        user_id: userId,
        user_name: userName,
        user_email: userEmail || '',
        amount: group.contributionAmount,
        status: 'pending',
        date: new Date().toISOString(),
        period
      });
      if (error) throw error;
      toast.success(`${t('contribution_call_created_for')} ${userName}`);
      setActionsFor(null);
    } catch (error) {
      console.error("Error creating contribution:", error);
      toast.error(t('error_creating'));
    } finally {
      setBusy(key, false);
    }
  };

  const handleRegisterPayment = async (userId: string, userName: string, userEmail?: string) => {
    const key = `pay-${userId}`;
    if (busyKeys.has(key)) return;
    setBusy(key, true);
    try {
      const period = formatPeriod(new Date());
      // Une seule cotisation par membre et par mois (migration 0020) : si
      // l'appel du mois existe déjà (en attente ou en retard), c'est LUI
      // qu'on solde — en créer un second affichait le membre « en retard »
      // alors qu'il venait de payer.
      const existing = await findPeriodContribution(userId, period);
      if (existing?.status === 'paid') {
        toast.info(`La cotisation de ${userName} pour ${period} est déjà payée.`);
        return;
      }
      const { data: inserted, error } = existing
        ? await supabase.from('contributions')
            .update({ status: 'paid', date: new Date().toISOString(), payment_method: 'cash' })
            .eq('id', existing.id)
            .select().single()
        : await supabase.from('contributions').insert({
            group_id: group.id,
            user_id: userId,
            user_name: userName,
            user_email: userEmail || '',
            amount: group.contributionAmount,
            status: 'paid',
            date: new Date().toISOString(),
            period
          }).select().single();
      if (error) throw error;

      // Paiement déclaré en espèces par le gestionnaire — l'argent ne vient
      // jamais du portefeuille in-app du membre (debitAccount != user_wallet:*
      // pour ne pas déclencher la déduction de solde côté RPC), mais doit
      // quand même apparaître dans le registre comptable double-entrée pour
      // que la réconciliation admin le voie.
      const ledgerResult = await executeFinancialTransaction({
        idempotencyKey: `manual_cash_${inserted.id}`,
        userId,
        amount: group.contributionAmount,
        currency: group.currency || 'FCFA',
        description: `Cotisation enregistrée manuellement (espèces) - ${group.name} (${period})`,
        actionType: 'contribution_payment',
        debitAccount: `external_cash:${userId}`,
        creditAccount: `tontine_group:${group.id}`,
        // Depuis la migration 0025, une écriture en espèces doit désigner la
        // cotisation qu'elle solde : le serveur vérifie qu'elle est bien de
        // ce membre, dans ce cercle, et que le montant la couvre.
        metadata: { contributionId: inserted.id, groupId: group.id },
      });
      if (!ledgerResult.success) {
        console.error('Ledger entry failed for manual payment:', ledgerResult.message);
        // Écriture comptable refusée : on annule le « payé » pour que la caisse
        // et le registre restent d'accord, et on le dit au gestionnaire.
        if (existing) {
          await supabase.from('contributions').update({ status: existing.status }).eq('id', existing.id);
        } else {
          await supabase.from('contributions').delete().eq('id', inserted.id);
        }
        toast.error(`Paiement non enregistré : ${ledgerResult.message || 'réessayez dans un instant.'}`);
        return;
      }

      toast.success(`${t('payment_registered_for')} ${userName}`);
      setActionsFor(null);
    } catch (error) {
      console.error("Error registering payment:", error);
      toast.error(t('error_registering_payment'));
    } finally {
      setBusy(key, false);
    }
  };

  const findPeriodContribution = async (userId: string, period: string) => {
    const { data } = await supabase
      .from('contributions')
      .select('id, status')
      .eq('group_id', group.id)
      .eq('user_id', userId)
      .eq('period', period)
      .maybeSingle();
    return data as { id: string; status: string } | null;
  };

  const formatPeriod = (date: Date) => {
    const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'paid': return t('status_paid');
      case 'pending': return t('status_pending');
      case 'late': return t('status_late');
      case 'pending_approval': return t('status_verifying');
      default: return status;
    }
  };

  const getStatusBadge = (status: string) => {
    const tone = status === 'paid' ? 'success' : status === 'late' ? 'danger' : status === 'pending_approval' ? 'warning' : 'neutral';
    return <StatusBadge tone={tone} label={statusLabel(status)} />;
  };

  const filteredContributions = searchTerm
    ? contributions.filter((c) => (c.userName || '').toLowerCase().includes(searchTerm.toLowerCase()))
    : contributions;

  const totalCollected = contributions.filter((c) => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0);
  const totalDistributed = payouts.reduce((sum, p) => sum + p.amount, 0);
  const availableFunds = totalCollected - totalDistributed;

  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const rows = filteredContributions.map((c) => ({
      [t('member')]: c.userName || t('member'),
      Email: c.userEmail || '',
      [t('period')]: c.period || '',
      [`${t('amount')} (${group.currency})`]: c.amount,
      [`${t('penalty')} (${group.currency})`]: c.penaltyApplied || 0,
      [t('penalty_status_col')]: c.penaltyStatus === 'paid' ? t('status_paid') : c.penaltyApplied ? t('due') : '-',
      [t('status')]: c.status,
      [t('date')]: c.date ? new Date(c.date).toLocaleDateString('fr-FR') : ''
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, t('contributions_management'));
    XLSX.writeFile(workbook, `cotisations_${group.name.replace(/\s+/g, '_')}.xlsx`);
    toast.success(t('excel_generated'));
  };

  const handleExportPDF = async () => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF();
    doc.text(`Rapport des cotisations - ${group.name}`, 14, 15);

    const tableColumn = [t('member'), "Email", t('period'), `${t('amount')} (${group.currency})`, t('status'), t('date')];
    const tableRows: any[] = [];

    filteredContributions.forEach(c => {
      const rowData = [
        c.userName || '',
        c.userEmail || '',
        c.period || '',
        c.amount,
        c.status === 'paid' ? 'Payé' : c.status === 'pending' ? 'En attente' : c.status,
        c.date ? new Date(c.date).toLocaleDateString('fr-FR') : ''
      ];
      tableRows.push(rowData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
    });

    doc.save(`cotisations_${group.name.replace(/\s+/g, '_')}.pdf`);
    toast.success("Rapport PDF généré !");
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}
      </div>
    );
  }

  const unpaidStatuses = ['pending', 'late', 'pending_approval'];
  const myDue = contributions
    .filter((c) => c.userId === user.uid && (c.status === 'pending' || c.status === 'late'))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const myInReview = contributions.filter((c) => c.userId === user.uid && c.status === 'pending_approval');
  const toValidate = contributions.filter((c) => c.status === 'pending_approval');
  const currentPeriod = formatPeriod(new Date());

  // Par membre : le plus ancien impayé, sinon la cotisation du mois.
  const lineOf = (uid: string) => {
    const mine = contributions.filter((c) => c.userId === uid);
    const unpaid = mine
      .filter((c) => unpaidStatuses.includes(c.status))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return unpaid[0] ?? mine.find((c) => c.period === currentPeriod) ?? null;
  };

  const selectedLine = actionsFor ? lineOf(actionsFor.uid) : null;
  const selectedBusy = !!actionsFor && (
    busyKeys.has(`create-${actionsFor.uid}`)
    || busyKeys.has(`pay-${actionsFor.uid}`)
    || (selectedLine ? busyKeys.has(`status-${selectedLine.id}`) : false)
  );

  const myPayments = (
    <section className="space-y-2">
      <h2 className="px-1 text-sm font-bold text-foreground">{isManager ? t('cir_my_contribution') : t('my_payments')}</h2>
      {myDue.length === 0 && myInReview.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card px-4 py-3.5 text-sm text-muted-foreground">{t('cir_nothing_to_pay')}</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {[...myDue, ...myInReview].map((c, index) => (
            <li key={c.id} className="space-y-2.5 px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-bold tabular-nums text-foreground">
                    {(c.amount + (c.penaltyStatus === 'pending' ? c.penaltyApplied || 0 : 0)).toLocaleString()} {group.currency}
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    {c.period}
                    {c.penaltyStatus === 'pending' && c.penaltyApplied ? ` · ${t('penalty')} ${c.penaltyApplied.toLocaleString()} ${group.currency} ${t('penalty_due_short')}` : ''}
                  </p>
                </div>
                {getStatusBadge(c.status)}
              </div>
              {c.status === 'pending_approval' ? (
                <p className="text-[13px] text-muted-foreground">{t('ref_label')} {c.proofOfPayment?.reference}</p>
              ) : (
                <>
                  <p className="text-[13px] text-muted-foreground">{t('cir_auto_debit')}</p>
                  <DeclarePaymentDialog
                    contribution={c}
                    onSubmit={(ref) => handleSubmitProof(c.id, ref)}
                    isKycVerified={(user.kycLevel ?? 1) >= 2}
                    onKycRequired={() => setShowKycPrompt(true)}
                    autoOpen={autoDeclare && index === 0}
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="space-y-5 pb-20">
      {!embedded && (
        <ScreenBar title={group.name} onBack={onBack} />
      )}

      {isManager && !embedded && (
        <dl className="divide-y divide-border rounded-2xl border border-border bg-card">
          {[
            [t('total_collected_in'), totalCollected],
            [t('total_distributed_out'), totalDistributed],
            [t('available_funds'), availableFunds],
          ].map(([label, value]) => (
            <div key={label as string} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-bold tabular-nums text-foreground">{(value as number).toLocaleString()} {group.currency}</dd>
            </div>
          ))}
        </dl>
      )}

      {myPayments}

      {isManager && toValidate.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-bold text-foreground">{t('cir_to_validate')} ({toValidate.length})</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {toValidate.map((c) => {
              const busy = busyKeys.has(`status-${c.id}`);
              return (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">{c.userName || t('member')}</p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {c.amount.toLocaleString()} {group.currency} · {t('ref_label')} {c.proofOfPayment?.reference}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleUpdateStatus(c, 'pending')}
                    className="h-11 shrink-0 cursor-pointer rounded-xl px-3 text-[13px] font-bold text-muted-foreground transition-colors duration-150 hover:bg-muted disabled:opacity-50"
                  >
                    {t('reject_proof')}
                  </button>
                  <Button disabled={busy} onClick={() => handleUpdateStatus(c, 'paid')} className="h-11 shrink-0 cursor-pointer gap-1.5 rounded-xl font-bold">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {t('cir_validate')}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {isManager && members.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="text-sm font-bold text-foreground">{t('circle_members')}</h2>
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <button type="button" className="flex h-11 cursor-pointer items-center gap-1.5 rounded-xl px-2 text-[13px] font-bold text-muted-foreground transition-colors duration-150 hover:bg-muted">
                  <Download className="h-4 w-4" />
                  {t('cir_export')}
                </button>
              } />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportExcel} className="min-h-11 cursor-pointer gap-2">
                  <FileSpreadsheet className="h-4 w-4" /> {t('export_excel')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF} className="min-h-11 cursor-pointer gap-2">
                  <FileText className="h-4 w-4" /> {t('export_pdf')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="divide-y divide-border rounded-2xl border border-border bg-card">
            {members.map((member) => {
              const line = lineOf(member.uid);
              return (
                <button
                  key={member.uid}
                  type="button"
                  onClick={() => setActionsFor(member)}
                  className="block w-full cursor-pointer text-left transition-colors duration-150 first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/50 active:bg-muted"
                >
                  <MemberCard
                    avatarUrl={member.photoURL}
                    name={member.displayName}
                    subtitle={line ? `${line.period} · ${line.amount.toLocaleString()} ${group.currency}` : t('cir_not_called')}
                    trailing={
                      <>
                        {line && getStatusBadge(line.status)}
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </>
                    }
                  />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {isManager && contributions.length > 0 && (
        <details className="group/history">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-1 text-sm font-bold text-foreground">
            {t('cir_history')} ({contributions.length})
            <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-open/history:rotate-90" />
          </summary>
          <div className="space-y-2 pt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('search_member')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 rounded-xl pl-9 text-base"
                aria-label={t('search_member')}
                autoComplete="off"
              />
            </div>
            {filteredContributions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('no_contribution_found')}</p>
            ) : (
              <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                {filteredContributions.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{c.userName || t('member')}</p>
                      <p className="text-[13px] text-muted-foreground">
                        {c.period} · {c.amount.toLocaleString()} {group.currency}
                        {c.penaltyApplied ? ` · ${t('penalty')} ${c.penaltyApplied.toLocaleString()} ${c.penaltyStatus === 'paid' ? t('penalty_paid_short') : t('penalty_due_short')}` : ''}
                      </p>
                    </div>
                    {getStatusBadge(c.status)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      )}

      {!isManager && contributions.some((c) => c.status === 'paid') && (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-bold text-foreground">{t('cir_history')}</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {contributions.filter((c) => c.status === 'paid').map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="text-foreground">{c.period}</span>
                <span className="font-bold tabular-nums text-foreground">{c.amount.toLocaleString()} {group.currency}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Actions sur un membre : une seule ligne par membre, le reste ici. */}
      <Dialog open={actionsFor !== null} onOpenChange={(open) => { if (!open) setActionsFor(null); }}>
        <DialogContent className="gap-3">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{actionsFor?.displayName}</DialogTitle>
            <DialogDescription>
              {selectedLine
                ? `${selectedLine.period} · ${selectedLine.amount.toLocaleString()} ${group.currency} · ${statusLabel(selectedLine.status)}`
                : t('cir_not_called')}
            </DialogDescription>
          </DialogHeader>
          {actionsFor && (
            <div className="divide-y divide-border rounded-2xl border border-border">
              {selectedLine?.status === 'pending_approval' && (
                <SheetRow disabled={selectedBusy} onClick={() => handleUpdateStatus(selectedLine, 'paid')} label={t('cir_validate')} />
              )}
              {selectedLine?.status === 'pending_approval' && (
                <SheetRow disabled={selectedBusy} onClick={() => handleUpdateStatus(selectedLine, 'pending')} label={t('reject_proof')} />
              )}
              {!contributions.some((c) => c.userId === actionsFor.uid && c.period === currentPeriod) && (
                <SheetRow disabled={selectedBusy} onClick={() => handleCreateContribution(actionsFor.uid, actionsFor.displayName, actionsFor.email)} label={`${t('cir_call_action')} (${currentPeriod})`} />
              )}
              {contributions.find((c) => c.userId === actionsFor.uid && c.period === currentPeriod)?.status !== 'paid' && (
                <SheetRow disabled={selectedBusy} onClick={() => handleRegisterPayment(actionsFor.uid, actionsFor.displayName, actionsFor.email)} label={`${t('cir_cash_action')} (${currentPeriod})`} />
              )}
              {selectedLine && selectedLine.status !== 'late' && selectedLine.status !== 'paid' && (
                <SheetRow disabled={selectedBusy} onClick={() => handleUpdateStatus(selectedLine, 'late')} label={`${t('cir_set_status')} : ${t('status_late')}`} />
              )}
              {selectedLine && selectedLine.status !== 'pending' && (
                <SheetRow disabled={selectedBusy} onClick={() => handleUpdateStatus(selectedLine, 'pending')} label={`${t('cir_set_status')} : ${t('status_pending')}`} />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialogue de vérification d'identité juste-à-temps */}
      <Dialog open={showKycPrompt} onOpenChange={setShowKycPrompt}>
        <DialogContent className="gap-3">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Vérification d'identité requise</DialogTitle>
            <DialogDescription className="leading-relaxed">
              Confirmez votre identité pour que votre cotisation de {group.contributionAmount.toLocaleString()} {group.currency} soit validée : carte d'identité, passeport ou carte d'électeur.
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={() => {
              setShowKycPrompt(false);
              onNavigateToVerification?.();
            }}
            className="h-12 w-full cursor-pointer rounded-xl font-bold"
          >
            Vérifier mon identité
          </Button>
          <Button variant="ghost" onClick={() => setShowKycPrompt(false)} className="h-11 w-full cursor-pointer rounded-xl font-bold text-muted-foreground">
            Plus tard
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SheetRow({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-12 w-full cursor-pointer items-center px-4 text-left text-sm font-bold text-foreground transition-colors duration-150 first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/50 disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function DeclarePaymentDialog({
  contribution,
  onSubmit,
  isKycVerified = true,
  onKycRequired,
  autoOpen = false,
}: {
  contribution: Contribution;
  onSubmit: (reference: string) => void;
  isKycVerified?: boolean;
  onKycRequired?: () => void;
  autoOpen?: boolean;
}) {
  const { t } = useLanguage();
  const [reference, setReference] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useBackHandler(
    React.useCallback(() => {
      setIsOpen(false);
      return true;
    }, []),
    isOpen
  );

  // « Cotiser » amène directement ici. La vérification d'identité reste exigée.
  const autoOpened = React.useRef(false);
  useEffect(() => {
    if (!autoOpen || autoOpened.current) return;
    autoOpened.current = true;
    if (isKycVerified) setIsOpen(true);
    else onKycRequired?.();
  }, [autoOpen, isKycVerified, onKycRequired]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference.trim() || isSubmitting) {
      if (!reference.trim()) toast.error(t('enter_reference_error'));
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(reference.trim());
      setIsOpen(false);
      setReference('');
    } catch {
      // L'erreur est déjà notifiée par le parent (toast) ; on laisse le
      // dialogue ouvert pour que la personne puisse corriger et renvoyer.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <Button
      onClick={() => {
        if (!isKycVerified) {
          onKycRequired?.();
          return;
        }
        setIsOpen(true);
      }}
      className="h-12 w-full cursor-pointer rounded-xl font-bold"
    >
      {t('declare')}
    </Button>
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{t('declare_payment')}</DialogTitle>
          <DialogDescription>
            {t('declare_payment_desc')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reference">{t('transaction_reference')}</Label>
            <Input
              id="reference"
              placeholder={t('reference_placeholder')}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="h-12 rounded-xl text-base"
              autoComplete="off"
              autoFocus
            />
          </div>
          <Button type="submit" disabled={isSubmitting} className="h-12 w-full cursor-pointer gap-2 rounded-xl font-bold disabled:opacity-60">
            {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
            {t('send_proof')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
