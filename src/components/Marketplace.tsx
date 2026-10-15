import React, { useEffect, useState } from 'react';
import { Store, ShieldPlus, Tractor, Zap, TrendingUp, ChevronRight, CheckCircle2, AlertCircle, Loader2, Clock, XCircle, RefreshCw, PackageSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import LegalDocumentDialog from './LegalDocumentDialog';
import { toast } from 'sonner';
import { UserProfile, MarketplaceService, MarketplaceRequest } from '@/types';
import { fetchActiveServices, fetchMyMarketplaceRequests, submitMarketplaceRequest } from '@/lib/marketplace';
import { CreditApplication, fetchCreditApplicationFee, fetchMyCreditApplications, isOpenApplication, remainingDue } from '@/lib/credit';
import { CreditApplicationPanel } from './CreditApplicationPanel';
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

export function Marketplace({ user }: MarketplaceProps) {
  const { t } = useLanguage();
  const statusLabels: Record<MarketplaceRequest['status'], { label: string; className: string }> = {
    pending: { label: t('status_pending'), className: 'bg-warning-soft text-warning' },
    contacted: { label: t('mkt_status_contacted'), className: 'bg-primary/10 text-primary' },
    approved: { label: t('mkt_status_approved'), className: 'bg-success-soft text-secondary' },
    rejected: { label: t('mkt_status_rejected'), className: 'bg-danger-soft text-danger' },
  };
  const [services, setServices] = useState<MarketplaceService[]>([]);
  const [myRequests, setMyRequests] = useState<MarketplaceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedService, setSelectedService] = useState<MarketplaceService | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreditTerms, setShowCreditTerms] = useState(false);
  // Le crédit vit dans credit_applications (dossier + offre + échéancier),
  // les autres services restent de simples demandes marketplace_requests.
  const [creditApps, setCreditApps] = useState<CreditApplication[]>([]);
  const [applicationFee, setApplicationFee] = useState(1000);

  const loadData = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [svc, reqs, apps, fee] = await Promise.all([
        fetchActiveServices(),
        fetchMyMarketplaceRequests(user.uid),
        fetchMyCreditApplications(user.uid),
        fetchCreditApplicationFee(),
      ]);
      setServices(svc);
      setMyRequests(reqs);
      setCreditApps(apps);
      setApplicationFee(fee);
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
    setIsSubmitting(true);
    try {
      const result = await submitMarketplaceRequest({ userId: user.uid, serviceId: selectedService.id });
      if (!result.success) throw new Error(result.message);
      toast.success(result.message);
      setSelectedService(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || t('mkt_send_request_error_toast'));
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Libellé de la carte d'un service de crédit selon l'état du dossier. */
  const creditCardStatus = (): { label: string; className: string } | null => {
    const open = creditApps.find(isOpenApplication);
    if (!open) return null;
    if (open.status === 'submitted') return { label: 'Dossier en cours d’étude', className: 'bg-warning-soft text-warning' };
    if (open.status === 'offered') return { label: 'Une offre vous attend', className: 'bg-success-soft text-secondary' };
    return { label: `Reste à rembourser : ${remainingDue(open).toLocaleString('fr-FR')} FCFA`, className: 'bg-primary/10 text-primary' };
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
          <h1 className="text-2xl font-serif font-black text-foreground">{t('marketplace')}</h1>
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
            const existingRequest = service.category === 'credit' ? undefined : requestForService(service.id);
            const creditStatus = service.category === 'credit' ? creditCardStatus() : null;
            return (
              <div
                key={service.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedService(service)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedService(service);
                  }
                }}
                className="press-row glass-card rounded-2xl p-5 shadow-soft hover:shadow-elevated transition-shadow flex flex-col justify-between cursor-pointer"
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
                {creditStatus ? (
                  <div className={`w-full text-center py-2 rounded-xl text-xs font-bold ${creditStatus.className}`}>
                    {creditStatus.label}
                  </div>
                ) : existingRequest ? (
                  <div className={`w-full text-center py-2 rounded-xl text-xs font-bold ${statusLabels[existingRequest.status].className}`}>
                    {`${t('mkt_request_prefix')} ${statusLabels[existingRequest.status].label}`}
                  </div>
                ) : (
                  <span className="w-full flex items-center justify-center gap-1 font-bold border border-brand/30 text-brand rounded-xl h-11 text-sm">
                    {t('view_details')} <ChevronRight className="w-4 h-4" />
                  </span>
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

                {selectedService.category === 'credit' ? (
                  <CreditApplicationPanel
                    user={user}
                    service={selectedService}
                    applications={creditApps}
                    applicationFee={applicationFee}
                    onChanged={loadData}
                    onShowTerms={() => setShowCreditTerms(true)}
                  />
                ) : (() => {
                  const existingRequest = requestForService(selectedService.id);

                  if (existingRequest) {
                    return (
                      <div className="bg-muted p-4 rounded-xl flex items-center gap-3 mb-2 text-sm">
                        <Clock className="w-5 h-5 text-muted-foreground shrink-0" />
                        {`${t('mkt_already_has_request_prefix')} ${statusLabels[existingRequest.status].label.toLowerCase()} ${t('mkt_already_has_request_suffix')}`}
                      </div>
                    );
                  }

                  if (!isEligible(selectedService)) {
                    return (
                      <div className="bg-danger-soft border border-danger/20 p-4 rounded-xl flex items-start gap-3 mb-2">
                        <XCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
                        <p className="text-xs text-danger leading-relaxed">
                          {t('mkt_requires_score_prefix')} {selectedService.minReputationScore}. {t('mkt_your_score_is_suffix')} {user.reputationScore}.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <>
                      <div className="bg-brand/5 border border-brand/20 p-4 rounded-xl flex items-start gap-3 mb-6">
                        <AlertCircle className="w-5 h-5 text-brand shrink-0 mt-0.5" />
                        <p className="text-xs text-brand-deep leading-relaxed">
                          {t('mkt_consent_disclaimer')}
                        </p>
                      </div>
                      <Button
                        className="btn-shine w-full h-12 text-base font-bold rounded-xl"
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
      <LegalDocumentDialog docId={showCreditTerms ? 'credit' : null} onClose={() => setShowCreditTerms(false)} />
    </div>
  );
}
