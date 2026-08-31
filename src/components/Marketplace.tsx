import React, { useEffect, useState } from 'react';
import { Store, ShieldPlus, Tractor, Zap, TrendingUp, ChevronRight, CheckCircle2, AlertCircle, Loader2, Clock, XCircle, RefreshCw, PackageSearch, Wallet, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { UserProfile, MarketplaceService, MarketplaceRequest } from '@/types';
import { fetchActiveServices, fetchMyMarketplaceRequests, submitMarketplaceRequest, repayMarketplaceCredit } from '@/lib/marketplace';
import { useLanguage } from '@/contexts/LanguageContext';

interface MarketplaceProps {
  user: UserProfile;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldPlus,
  Tractor,
  Zap,
  TrendingUp,
  Store,
};

// Plafond de crédit indicatif : 2x l'épargne totale déjà versée dans les
// cercles de tontine, avec un plancher pour ne pas bloquer les nouveaux
// membres. L'admin reste libre d'ajuster le montant final à l'approbation.
const CREDIT_FLOOR = 5000;
const creditCap = (totalSaved: number) => Math.max(CREDIT_FLOOR, Math.round(totalSaved * 2));

export function Marketplace({ user }: MarketplaceProps) {
  const { t } = useLanguage();
  const statusLabels: Record<MarketplaceRequest['status'], { label: string; className: string }> = {
    pending: { label: t('status_pending'), className: 'bg-amber-500/10 text-amber-600' },
    contacted: { label: t('mkt_status_contacted'), className: 'bg-blue-500/10 text-blue-600' },
    approved: { label: t('mkt_status_approved'), className: 'bg-emerald-500/10 text-emerald-600' },
    rejected: { label: t('mkt_status_rejected'), className: 'bg-rose-500/10 text-rose-600' },
  };
  const [services, setServices] = useState<MarketplaceService[]>([]);
  const [myRequests, setMyRequests] = useState<MarketplaceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedService, setSelectedService] = useState<MarketplaceService | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  const [isRepaying, setIsRepaying] = useState(false);
  const repayIdempotencyKeyRef = React.useRef<string | null>(null);
  useEffect(() => { repayIdempotencyKeyRef.current = null; }, [repayAmount]);

  const loadData = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [svc, reqs] = await Promise.all([
        fetchActiveServices(),
        fetchMyMarketplaceRequests(user.uid),
      ]);
      setServices(svc);
      setMyRequests(reqs);
    } catch (err) {
      console.error('Marketplace loadData error:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid]);

  const requestForService = (serviceId: string) => myRequests.find((r) => r.serviceId === serviceId);
  const isEligible = (service: MarketplaceService) =>
    service.minReputationScore === undefined || user.reputationScore >= service.minReputationScore;

  const handleAction = async () => {
    if (!selectedService) return;
    let requestedAmount: number | undefined;
    if (selectedService.category === 'credit') {
      const amount = parseFloat(creditAmount);
      const cap = creditCap(user.totalSaved);
      if (!amount || amount <= 0) {
        toast.error(t('mkt_enter_amount_toast'));
        return;
      }
      if (amount > cap) {
        toast.error(`${t('mkt_amount_exceeds_cap_prefix')} ${cap.toLocaleString()} FCFA.`);
        return;
      }
      requestedAmount = amount;
    }
    setIsSubmitting(true);
    try {
      const result = await submitMarketplaceRequest({ userId: user.uid, serviceId: selectedService.id, requestedAmount });
      if (!result.success) throw new Error(result.message);
      toast.success(result.message);
      setSelectedService(null);
      setCreditAmount('');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || t('mkt_send_request_error_toast'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRepay = async () => {
    const existingRequest = selectedService ? requestForService(selectedService.id) : undefined;
    if (!existingRequest) return;
    const amount = parseFloat(repayAmount);
    const remaining = (existingRequest.approvedAmount || 0) - existingRequest.repaidAmount;
    if (!amount || amount <= 0) {
      toast.error(t('mkt_enter_repay_amount_toast'));
      return;
    }
    if (amount > remaining) {
      toast.error(`${t('mkt_amount_exceeds_remaining_prefix')} (${remaining.toLocaleString()} FCFA).`);
      return;
    }
    if (amount > user.walletBalance) {
      toast.error(t('mkt_insufficient_wallet_toast'));
      return;
    }
    setIsRepaying(true);
    try {
      if (!repayIdempotencyKeyRef.current) {
        repayIdempotencyKeyRef.current = crypto.randomUUID();
      }
      const result = await repayMarketplaceCredit({
        requestId: existingRequest.id,
        amount,
        idempotencyKey: repayIdempotencyKeyRef.current,
      });
      if (!result.success) throw new Error(result.message);
      repayIdempotencyKeyRef.current = null;
      toast.success(t('mkt_repayment_done_toast'));
      setRepayAmount('');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || t('mkt_repayment_error_toast'));
    } finally {
      setIsRepaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
        <AlertCircle className="w-8 h-8 text-danger" />
        <p className="text-sm font-bold text-foreground">{t('mkt_load_error_title')}</p>
        <p className="text-xs text-muted-foreground max-w-xs">{t('mkt_load_error_desc')}</p>
        <Button variant="outline" size="sm" onClick={loadData} className="mt-2 font-bold">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> {t('mkt_retry_cta')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="glass-card p-6 rounded-3xl shadow-soft">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-brand/10 rounded-xl">
            <Store className="w-6 h-6 text-brand" />
          </div>
          <h1 className="text-2xl font-black text-foreground">{t('marketplace')}</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          {t('mkt_header_subtitle')}
        </p>
      </div>

      {services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6 glass-card rounded-3xl shadow-soft">
          <PackageSearch className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm font-bold text-foreground">{t('mkt_no_service_title')}</p>
          <p className="text-xs text-muted-foreground max-w-xs">{t('mkt_no_service_desc')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((service) => {
            const Icon = ICONS[service.iconName] || Store;
            const existingRequest = requestForService(service.id);
            return (
              <div
                key={service.id}
                className="glass-card rounded-2xl p-5 shadow-soft hover:shadow-elevated transition-shadow flex flex-col justify-between cursor-pointer"
                onClick={() => setSelectedService(service)}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className={`p-3 rounded-2xl ${service.colorClass} shadow-xs shrink-0`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-lg leading-tight">{service.title}</h3>
                    <p className="text-xs text-brand font-semibold mt-1">{service.provider}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed line-clamp-2">
                  {service.description}
                </p>
                {existingRequest ? (
                  <div className={`w-full text-center py-2 rounded-xl text-xs font-bold ${statusLabels[existingRequest.status].className}`}>
                    {existingRequest.status === 'approved' && service.category === 'credit' && existingRequest.approvedAmount != null
                      ? existingRequest.repaidAmount >= existingRequest.approvedAmount
                        ? t('mkt_credit_repaid_label')
                        : `${t('mkt_balance_due_prefix')} ${(existingRequest.approvedAmount - existingRequest.repaidAmount).toLocaleString()} FCFA`
                      : `${t('mkt_request_prefix')} ${statusLabels[existingRequest.status].label}`}
                  </div>
                ) : (
                  <Button variant="outline" className="w-full font-bold border-brand/30 text-brand hover:bg-brand/10 h-11">
                    {t('view_details')} <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedService} onOpenChange={(open) => !open && setSelectedService(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden gap-0 [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:hover:bg-white/20">
          {selectedService && (
            <>
              <div className={`${selectedService.colorClass} p-6 pt-2 text-white`}>
                <DialogHeader>
                  {React.createElement(ICONS[selectedService.iconName] || Store, { className: 'w-8 h-8 text-white' })}
                  <DialogTitle className="text-2xl font-black mt-4 text-white">{selectedService.title}</DialogTitle>
                </DialogHeader>
                <p className="opacity-90 text-sm mt-1">{selectedService.provider}</p>
              </div>

              <div className="p-6 overflow-y-auto">
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  {selectedService.description}
                </p>

                {selectedService.requirements && selectedService.requirements.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-xs font-bold uppercase text-foreground mb-3 tracking-wider">{t('mkt_requirements_title')}</h4>
                    <ul className="space-y-2">
                      {selectedService.requirements.map((req, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(() => {
                  const existingRequest = requestForService(selectedService.id);
                  const isActiveCredit = existingRequest?.status === 'approved'
                    && selectedService.category === 'credit'
                    && existingRequest.approvedAmount != null
                    && existingRequest.repaidAmount < existingRequest.approvedAmount;

                  if (isActiveCredit && existingRequest) {
                    const remaining = (existingRequest.approvedAmount || 0) - existingRequest.repaidAmount;
                    return (
                      <div className="space-y-4">
                        <div className="bg-brand/5 border border-brand/20 rounded-2xl p-4 space-y-2.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{t('mkt_borrowed_amount_label')}</span>
                            <span className="font-bold text-foreground">{existingRequest.approvedAmount!.toLocaleString()} FCFA</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{t('mkt_already_repaid_label')}</span>
                            <span className="font-bold text-secondary">{existingRequest.repaidAmount.toLocaleString()} FCFA</span>
                          </div>
                          <div className="flex justify-between text-sm pt-2 border-t border-brand/10">
                            <span className="font-bold text-foreground">{t('mkt_remaining_balance_label')}</span>
                            <span className="font-black text-brand">{remaining.toLocaleString()} FCFA</span>
                          </div>
                          {existingRequest.repaymentDeadline && (
                            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground pt-1">
                              <CalendarClock className="w-3.5 h-3.5" />
                              {t('deadline_prefix')} {new Date(existingRequest.repaymentDeadline).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold">{t('mkt_amount_to_repay_label')}</Label>
                          <Input
                            type="number"
                            min={1}
                            max={remaining}
                            placeholder={`${t('mkt_max_amount_prefix')} ${remaining.toLocaleString()} FCFA`}
                            value={repayAmount}
                            onChange={(e) => setRepayAmount(e.target.value)}
                            className="rounded-xl h-11"
                          />
                          <p className="text-[13px] text-muted-foreground">
                            {t('mkt_wallet_balance_prefix')} {user.walletBalance.toLocaleString()} FCFA. {t('mkt_repay_multiple_times_suffix')}
                          </p>
                        </div>
                        <Button
                          className="w-full h-12 text-base font-bold rounded-xl"
                          onClick={handleRepay}
                          disabled={isRepaying}
                        >
                          <Wallet className="w-4 h-4 mr-2" />
                          {isRepaying ? t('mkt_processing_ellipsis') : t('mkt_repay_cta')}
                        </Button>
                      </div>
                    );
                  }

                  if (existingRequest) {
                    const isFullyRepaidCredit = existingRequest.status === 'approved'
                      && selectedService.category === 'credit'
                      && existingRequest.approvedAmount != null
                      && existingRequest.repaidAmount >= existingRequest.approvedAmount;
                    return (
                      <div className="bg-muted p-4 rounded-xl flex items-center gap-3 mb-2 text-sm">
                        <Clock className="w-5 h-5 text-muted-foreground shrink-0" />
                        {isFullyRepaidCredit
                          ? t('mkt_credit_fully_repaid_message')
                          : selectedService.category === 'credit' && existingRequest.requestedAmount
                          ? `${t('mkt_request_of_prefix')} ${existingRequest.requestedAmount.toLocaleString()} FCFA ${t('mkt_is_word')} ${statusLabels[existingRequest.status].label.toLowerCase()}.`
                          : `${t('mkt_already_has_request_prefix')} ${statusLabels[existingRequest.status].label.toLowerCase()} ${t('mkt_already_has_request_suffix')}`}
                      </div>
                    );
                  }

                  if (!isEligible(selectedService)) {
                    return (
                      <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-start gap-3 mb-2">
                        <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-rose-700 dark:text-rose-400 leading-relaxed">
                          {t('mkt_requires_score_prefix')} {selectedService.minReputationScore}. {t('mkt_your_score_is_suffix')} {user.reputationScore}.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <>
                      {selectedService.category === 'credit' && (
                        <div className="space-y-1.5 mb-4">
                          <Label className="text-xs font-bold">{t('mkt_desired_amount_label')}</Label>
                          <Input
                            type="number"
                            min={1}
                            max={creditCap(user.totalSaved)}
                            placeholder={`${t('mkt_up_to_prefix')} ${creditCap(user.totalSaved).toLocaleString()} FCFA`}
                            value={creditAmount}
                            onChange={(e) => setCreditAmount(e.target.value)}
                            className="rounded-xl h-11"
                          />
                          <p className="text-[13px] text-muted-foreground">
                            {t('mkt_cap_info_prefix')} ({user.totalSaved.toLocaleString()} FCFA) : {creditCap(user.totalSaved).toLocaleString()} FCFA. {t('mkt_cap_info_suffix')}
                          </p>
                        </div>
                      )}
                      <div className="bg-brand/5 border border-brand/20 p-4 rounded-xl flex items-start gap-3 mb-6">
                        <AlertCircle className="w-5 h-5 text-brand shrink-0 mt-0.5" />
                        <p className="text-xs text-brand-deep leading-relaxed">
                          {t('mkt_consent_disclaimer')}
                        </p>
                      </div>
                      <Button
                        className="w-full h-12 text-base font-bold rounded-xl"
                        onClick={handleAction}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? t('sending_label') : selectedService.actionLabel}
                      </Button>
                    </>
                  );
                })()}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
