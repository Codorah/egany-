import React, { useEffect, useState } from 'react';
import { supabase, createChannel } from '@/lib/supabase';
import { mapContributionRow, mapPayoutRow, mapProfileRow } from '@/lib/mappers';
import { executeFinancialTransaction } from '@/lib/ledger';
import { Group, UserProfile, Contribution, Payout } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, CheckCircle2, Clock, AlertCircle, Plus, FileText, Check, X, Search, Wallet, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  const isManager = user.uid === group.creatorId || user.role === 'admin';

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
    try {
      const { error } = await supabase.from('contributions').update({ status: newStatus }).eq('id', contributionId);
      if (error) throw error;
      toast.success(t('status_updated'));
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error(t('status_update_error'));
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
    }
  };

  const handleCreateContribution = async (userId: string, userName: string, userEmail?: string) => {
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
    }
  };

  const handleRegisterPayment = async (userId: string, userName: string, userEmail?: string) => {
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
    }
  };

  const formatPeriod = (date: Date) => {
    const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-success-soft text-secondary hover:bg-success-soft border-secondary/20">{t('status_paid')}</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-brand border-brand/20 bg-brand/10">{t('status_pending')}</Badge>;
      case 'late':
        return <Badge variant="destructive">{t('status_late')}</Badge>;
      case 'pending_approval':
        return <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/10 border-blue-500/20 animate-pulse">{t('status_verifying')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isManager ? t('contributions_management') : t('my_contributions_title')}
            </h1>
            <p className="text-muted-foreground">{group.name} • {group.contributionAmount.toLocaleString()} {group.currency}</p>
          </div>
        </div>
        {isManager && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportExcel} className="gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">{t('export_excel')}</span>
            </Button>
            <Button variant="outline" onClick={handleExportPDF} className="gap-2 border-red-200 text-red-600 hover:bg-red-50">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Export PDF</span>
            </Button>
          </div>
        )}
      </div>

      {isManager && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="w-4 h-4" />
              {t('circle_accounting')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3 rounded-xl bg-success-soft border border-secondary/20">
              <p className="text-[13px] font-bold uppercase text-secondary">{t('total_collected_in')}</p>
              <p className="text-lg font-bold text-secondary">{totalCollected.toLocaleString()} {group.currency}</p>
            </div>
            <div className="p-3 rounded-xl bg-brand/10 border border-brand/20">
              <p className="text-[13px] font-bold uppercase text-brand">{t('total_distributed_out')}</p>
              <p className="text-lg font-bold text-brand">{totalDistributed.toLocaleString()} {group.currency}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted border border-border">
              <p className="text-[13px] font-bold uppercase text-muted-foreground">{t('available_funds')}</p>
              <p className="text-lg font-bold">{availableFunds.toLocaleString()} {group.currency}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className={isManager ? "lg:col-span-2" : "lg:col-span-3"}>
          <CardHeader>
            <CardTitle>{isManager ? t('payment_history') : t('my_payments')}</CardTitle>
            <CardDescription>
              {isManager
                ? t('contributions_list_desc')
                : t('my_contributions_desc')}
            </CardDescription>
            {isManager && (
              <div className="relative pt-2 max-w-xs">
                <Search className="absolute left-2.5 top-4.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder={t('search_member')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('member')}</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>{t('period')}</TableHead>
                  <TableHead>{t('amount')}</TableHead>
                  <TableHead>{t('penalty')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  {isManager && <TableHead className="text-right">{t('actions')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContributions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isManager ? 6 : 5} className="text-center py-8 text-muted-foreground">
                      {t('no_contribution_found')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContributions.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.userName || t('member')}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.userEmail || '-'}</TableCell>
                      <TableCell>{c.period}</TableCell>
                      <TableCell>{c.amount.toLocaleString()} {group.currency}</TableCell>
                      <TableCell>
                        {c.penaltyApplied ? (
                          <Badge variant={c.penaltyStatus === 'paid' ? 'secondary' : 'destructive'} className="text-[13px]">
                            {c.penaltyApplied.toLocaleString()} {group.currency} {c.penaltyStatus === 'paid' ? t('penalty_paid_short') : t('penalty_due_short')}
                          </Badge>
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
                                  className="h-8 w-8 text-secondary border-secondary/20 hover:bg-success-soft"
                                  onClick={() => handleUpdateStatus(c.id, 'paid')}
                                  title={t('approve_payment')}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="outline" 
                                  className="h-8 w-8 text-danger border-danger/20 hover:bg-danger-soft"
                                  onClick={() => handleUpdateStatus(c.id, 'pending')}
                                  title={t('reject_proof')}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                            <Select 
                              value={c.status} 
                              onValueChange={(val: any) => handleUpdateStatus(c.id, val)}
                            >
                              <SelectTrigger className="w-[130px] h-8">
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
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {isManager && (
          <Card>
            <CardHeader>
              <CardTitle>{t('circle_members')}</CardTitle>
              <CardDescription>{t('init_contribution_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {members.map((member) => (
                <div key={member.uid} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {member.displayName.charAt(0)}
                    </div>
                    <div className="text-sm">
                      <p className="font-medium">{member.displayName}</p>
                      <p className="text-xs text-muted-foreground">{t('score_label')} {member.reputationScore}/100</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-7 text-[13px] px-2"
                      onClick={() => handleCreateContribution(member.uid, member.displayName, member.email)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {t('call_contribution')}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="default" 
                      className="h-7 text-[13px] px-2 bg-secondary hover:bg-secondary/90"
                      onClick={() => handleRegisterPayment(member.uid, member.displayName, member.email)}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {t('pay')}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference.trim()) {
      toast.error(t('enter_reference_error'));
      return;
    }
    onSubmit(reference.trim());
    setIsOpen(false);
    setReference('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={
        <Button size="sm" variant="outline" className="h-8 gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {t('declare')}
        </Button>
      } />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('declare_payment')}</DialogTitle>
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
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>{t('cancel')}</Button>
            <Button type="submit">{t('send_proof')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
