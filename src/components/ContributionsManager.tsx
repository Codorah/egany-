import React, { useEffect, useState } from 'react';
import { supabase, createChannel } from '@/lib/supabase';
import { mapContributionRow, mapPayoutRow, mapProfileRow } from '@/lib/mappers';
import { executeFinancialTransaction } from '@/lib/ledger';
import { Group, UserProfile, Contribution, Payout } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, CheckCircle2, Clock, AlertCircle, Plus, FileText, Check, X, Search, Wallet, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from './ui/StatusBadge';
import { MemberCard } from './ui/MemberCard';
import { Skeleton } from './ui/Skeleton';
import { useLanguage } from '@/contexts/LanguageContext';

interface ContributionsManagerProps {
  group: Group;
  user: UserProfile;
  onBack: () => void;
}

export function ContributionsManager({ group, user, onBack }: ContributionsManagerProps) {
  const { t } = useLanguage();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  // Une opération financière (déclarer/valider/rejeter un paiement) par
  // clé "action-cibleId" à la fois : un double-tap sur mobile réseau lent
  // ne doit jamais créer deux fois la même écriture comptable.
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());

  const isManager = user.uid === group.creatorId || user.role === 'admin';

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
      const { data, error } = await supabase.from('profiles').select('*').in('id', group.members);
      if (error) {
        console.error("Error fetching members:", error);
        return;
      }
      setMembers((data ?? []).map(mapProfileRow));
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

  const handleUpdateStatus = async (contributionId: string, newStatus: 'paid' | 'pending' | 'late' | 'pending_approval') => {
    const key = `status-${contributionId}`;
    if (busyKeys.has(key)) return;
    setBusy(key, true);
    try {
      const { error } = await supabase.from('contributions').update({ status: newStatus }).eq('id', contributionId);
      if (error) throw error;
      toast.success(t('status_updated'));
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error(t('status_update_error'));
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
      const { error } = await supabase.from('contributions').insert({
        group_id: group.id,
        user_id: userId,
        user_name: userName,
        user_email: userEmail || '',
        amount: group.contributionAmount,
        status: 'pending',
        date: new Date().toISOString(),
        period: formatPeriod(new Date())
      });
      if (error) throw error;
      toast.success(`${t('contribution_call_created_for')} ${userName}`);
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
      const { data: inserted, error } = await supabase.from('contributions').insert({
        group_id: group.id,
        user_id: userId,
        user_name: userName,
        user_email: userEmail || '',
        amount: group.contributionAmount,
        status: 'paid',
        date: new Date().toISOString(),
        period: formatPeriod(new Date())
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
        description: `Cotisation enregistrée manuellement (espèces) - ${group.name} (${formatPeriod(new Date())})`,
        actionType: 'contribution_payment',
        debitAccount: `external_cash:${userId}`,
        creditAccount: `tontine_group:${group.id}`,
      });
      if (!ledgerResult.success) {
        console.error('Ledger entry failed for manual payment:', ledgerResult.message);
      }

      toast.success(`${t('payment_registered_for')} ${userName}`);
    } catch (error) {
      console.error("Error registering payment:", error);
      toast.error(t('error_registering_payment'));
    } finally {
      setBusy(key, false);
    }
  };

  const formatPeriod = (date: Date) => {
    const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <StatusBadge tone="success" label={t('status_paid')} />;
      case 'pending':
        return <StatusBadge tone="info" label={t('status_pending')} />;
      case 'late':
        return <StatusBadge tone="danger" label={t('status_late')} />;
      case 'pending_approval':
        return <StatusBadge tone="info" label={t('status_verifying')} pulse />;
      default:
        return <StatusBadge tone="neutral" label={status} />;
    }
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
      <div className="space-y-4 sm:space-y-5 pb-20">
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
        <div className="glass-card rounded-3xl shadow-soft border border-border/70 p-4 sm:p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-1.5">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5 pb-20">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="rounded-xl shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-foreground truncate">
              {isManager ? t('contributions_management') : t('my_contributions_title')}
            </h1>
            <p className="text-[13px] text-muted-foreground font-medium truncate">
              {group.name} • {group.contributionAmount.toLocaleString()} {group.currency}
            </p>
          </div>
        </div>
        {isManager && (
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={handleExportExcel}
              className="rounded-xl gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">{t('export_excel')}</span>
            </Button>
            <Button
              variant="outline"
              onClick={handleExportPDF}
              className="rounded-xl gap-1.5 border-danger/20 text-danger hover:bg-danger-soft cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">{t('export_pdf')}</span>
            </Button>
          </div>
        )}
      </div>

      {isManager && (
        <div className="glass-card rounded-3xl p-4 shadow-soft border border-border/70">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground mb-3">
            <Wallet className="w-4 h-4 text-primary" />
            {t('circle_accounting')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-success-soft border border-secondary/20">
              <p className="text-[11px] font-bold uppercase tracking-wide text-secondary">{t('total_collected_in')}</p>
              <p className="text-lg font-serif font-black text-secondary mt-0.5">{totalCollected.toLocaleString()} {group.currency}</p>
            </div>
            <div className="p-3 rounded-2xl bg-brand/10 border border-brand/20">
              <p className="text-[11px] font-bold uppercase tracking-wide text-brand">{t('total_distributed_out')}</p>
              <p className="text-lg font-serif font-black text-brand mt-0.5">{totalDistributed.toLocaleString()} {group.currency}</p>
            </div>
            <div className="p-3 rounded-2xl bg-muted border border-border">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t('available_funds')}</p>
              <p className="text-lg font-serif font-black text-foreground mt-0.5">{availableFunds.toLocaleString()} {group.currency}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`glass-card rounded-3xl shadow-soft border border-border/70 overflow-hidden ${isManager ? "lg:col-span-2" : "lg:col-span-3"}`}>
          <div className="p-4 sm:p-5 pb-3 space-y-1">
            <h2 className="text-base font-serif font-black text-foreground">{isManager ? t('payment_history') : t('my_payments')}</h2>
            <p className="text-[13px] text-muted-foreground">
              {isManager ? t('contributions_list_desc') : t('my_contributions_desc')}
            </p>
            {isManager && (
              <div className="relative pt-2 max-w-xs">
                <Search className="absolute left-2.5 top-4.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder={t('search_member')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9 text-xs rounded-xl"
                />
              </div>
            )}
          </div>
          <div className="px-2 sm:px-3 pb-3">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/70">
                  <TableHead className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground">{t('member')}</TableHead>
                  <TableHead className="hidden sm:table-cell text-[11px] uppercase tracking-wide font-bold text-muted-foreground">Email</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground">{t('period')}</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground">{t('amount')}</TableHead>
                  <TableHead className="hidden sm:table-cell text-[11px] uppercase tracking-wide font-bold text-muted-foreground">{t('penalty')}</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground">{t('status')}</TableHead>
                  {isManager && <TableHead className="text-right text-[11px] uppercase tracking-wide font-bold text-muted-foreground">{t('actions')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContributions.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={isManager ? 7 : 6} className="text-center py-10">
                      <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-xs font-medium">{t('no_contribution_found')}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContributions.map((c) => {
                    const statusKey = `status-${c.id}`;
                    const statusBusy = busyKeys.has(statusKey);
                    return (
                      <TableRow key={c.id} className="border-border/70">
                        <TableCell className="font-bold text-foreground">{c.userName || t('member')}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{c.userEmail || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{c.period}</TableCell>
                        <TableCell className="font-semibold">{c.amount.toLocaleString()} {group.currency}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {c.penaltyApplied ? (
                            <StatusBadge
                              tone={c.penaltyStatus === 'paid' ? 'success' : 'danger'}
                              label={`${c.penaltyApplied.toLocaleString()} ${group.currency} ${c.penaltyStatus === 'paid' ? t('penalty_paid_short') : t('penalty_due_short')}`}
                            />
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(c.status)}</TableCell>
                        {isManager && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {c.status === 'pending_approval' && (
                                <div className="flex gap-1 mr-2">
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    disabled={statusBusy}
                                    className="h-8 w-8 rounded-xl text-secondary border-secondary/20 hover:bg-success-soft cursor-pointer disabled:opacity-60"
                                    onClick={() => handleUpdateStatus(c.id, 'paid')}
                                    title={t('approve_payment')}
                                  >
                                    {statusBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    disabled={statusBusy}
                                    className="h-8 w-8 rounded-xl text-danger border-danger/20 hover:bg-danger-soft cursor-pointer disabled:opacity-60"
                                    onClick={() => handleUpdateStatus(c.id, 'pending')}
                                    title={t('reject_proof')}
                                  >
                                    {statusBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                  </Button>
                                </div>
                              )}
                              <Select
                                value={c.status}
                                disabled={statusBusy}
                                onValueChange={(val: any) => handleUpdateStatus(c.id, val)}
                              >
                                <SelectTrigger className="w-[130px] h-8 rounded-xl">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="paid">{t('status_paid')}</SelectItem>
                                  <SelectItem value="pending">{t('status_pending')}</SelectItem>
                                  <SelectItem value="late">{t('status_late')}</SelectItem>
                                  <SelectItem value="pending_approval">{t('status_verification_short')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                        )}
                        {!isManager && (
                          <TableCell className="text-right">
                            {(c.status === 'pending' || c.status === 'late') && (
                              <DeclarePaymentDialog
                                contribution={c}
                                onSubmit={(ref) => handleSubmitProof(c.id, ref)}
                              />
                            )}
                            {c.status === 'pending_approval' && (
                              <span className="text-xs text-muted-foreground italic">
                                {t('ref_label')} {c.proofOfPayment?.reference}
                              </span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {isManager && (
          <div className="glass-card rounded-3xl shadow-soft border border-border/70 p-4 sm:p-5 space-y-3">
            <div>
              <h2 className="text-base font-serif font-black text-foreground">{t('circle_members')}</h2>
              <p className="text-[13px] text-muted-foreground">{t('init_contribution_desc')}</p>
            </div>
            <div className="space-y-2">
              {members.map((member) => {
                const creating = busyKeys.has(`create-${member.uid}`);
                const paying = busyKeys.has(`pay-${member.uid}`);
                return (
                  <MemberCard
                    key={member.uid}
                    avatarUrl={member.photoURL}
                    name={member.displayName}
                    subtitle={`${t('score_label')} ${member.reputationScore}/100`}
                    trailing={
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={creating}
                        className="h-7 text-[12px] px-2 rounded-lg gap-1 cursor-pointer disabled:opacity-60"
                        onClick={() => handleCreateContribution(member.uid, member.displayName, member.email)}
                      >
                        {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        {t('call_contribution')}
                      </Button>
                      <Button
                        size="sm"
                        disabled={paying}
                        className="btn-shine h-7 text-[12px] px-2 rounded-lg gap-1 bg-secondary hover:bg-secondary/90 cursor-pointer disabled:opacity-60"
                        onClick={() => handleRegisterPayment(member.uid, member.displayName, member.email)}
                      >
                        {paying ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        {t('pay')}
                      </Button>
                    </div>
                    }
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DeclarePaymentDialog({
  contribution,
  onSubmit
}: {
  contribution: Contribution,
  onSubmit: (reference: string) => void
}) {
  const { t } = useLanguage();
  const [reference, setReference] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={
        <Button size="sm" variant="outline" className="h-8 rounded-xl gap-1.5 cursor-pointer">
          <CheckCircle2 className="w-4 h-4" />
          {t('declare')}
        </Button>
      } />
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-serif">{t('declare_payment')}</DialogTitle>
          <DialogDescription>
            {t('declare_payment_desc')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reference">{t('transaction_reference')}</Label>
            <Input
              id="reference"
              placeholder={t('reference_placeholder')}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="rounded-xl"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" className="rounded-xl cursor-pointer" onClick={() => setIsOpen(false)}>{t('cancel')}</Button>
            <Button type="submit" disabled={isSubmitting} className="btn-shine rounded-xl gap-1.5 cursor-pointer disabled:opacity-60">
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t('send_proof')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
