import React, { useCallback, useEffect, useState } from 'react';
import { Store, ShieldPlus, Tractor, Zap, TrendingUp, ChevronRight, CheckCircle2, AlertCircle, Loader2, Clock, XCircle, RefreshCw, PackageSearch, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FlowNotice, FlowScreen } from '@/components/ui/FlowScreen';
import LegalDocumentDialog from './LegalDocumentDialog';
import { toast } from 'sonner';
import { UserProfile, MarketplaceService, MarketplaceRequest } from '@/types';
import { fetchActiveServices, fetchMyMarketplaceRequests, providerLabel, submitMarketplaceRequest } from '@/lib/marketplace';
import { CreditApplication, fetchMyCreditApplications, isOpenApplication, remainingDue } from '@/lib/credit';
import { CreditFlow } from './CreditApplicationPanel';
import { AidFlow } from './AidApplicationPanel';
import { AidApplication, fetchAidApplicationFee, fetchMyAidApplications } from '@/lib/aid';
import { useLanguage } from '@/contexts/LanguageContext';

interface MarketplaceProps {
  user: UserProfile;
  /** Ouvre directement un service à l'arrivée (choix fait dans l'onboarding). */
  initialOpen?: 'aid' | 'credit';
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldPlus,
  Tractor,
  Zap,
  TrendingUp,
  Store,
};

type OpenFlow = { kind: 'aid' } | { kind: 'credit' | 'service'; service: MarketplaceService };

export function Marketplace({ user, initialOpen }: MarketplaceProps) {
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
  // Parcours ouvert en plein écran, à la manière d'une app mobile : chaque
  // service a ses propres écrans au lieu d'une fenêtre modale.
  const [openFlow, setOpenFlow] = useState<OpenFlow | null>(null);
  const closeFlow = useCallback(() => setOpenFlow(null), []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreditTerms, setShowCreditTerms] = useState(false);
  // Le crédit vit dans credit_applications (dossier + offre + échéancier),
  // les autres services restent de simples demandes marketplace_requests.
  const [creditApps, setCreditApps] = useState<CreditApplication[]>([]);
  // Le Coup de pouce (aide gratuite) n'est pas un service partenaire : il a
  // sa propre carte, toujours en tête.
  const [aidApps, setAidApps] = useState<AidApplication[]>([]);
  const [aidFee, setAidFee] = useState(1000);
  const [showAidTerms, setShowAidTerms] = useState(false);
  const [initialHandled, setInitialHandled] = useState(false);

  // Après le premier chargement, les rechargements (après un dépôt, un
  // remboursement…) se font sans écran d'attente : l'écran ouvert reste en
  // place, avec sa confirmation.
  const loadedOnce = React.useRef(false);
  const loadData = async () => {
    const silent = loadedOnce.current;
    if (!silent) setLoading(true);
    setLoadError(false);
    try {
      const [svc, reqs, apps, aids, fee] = await Promise.all([
        fetchActiveServices(),
        fetchMyMarketplaceRequests(user.uid),
        fetchMyCreditApplications(user.uid),
        fetchMyAidApplications(user.uid),
        fetchAidApplicationFee(),
      ]);
      setServices(svc);
      setMyRequests(reqs);
      setCreditApps(apps);
      setAidApps(aids);
      setAidFee(fee);
      loadedOnce.current = true;
    } catch (err) {
      console.error('Marketplace loadData error:', err);
      if (silent) toast.error(t('mkt_load_error_title'));
      else setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid]);

  // Arrivée depuis l'onboarding : on ouvre le service choisi, une seule fois.
  useEffect(() => {
    if (loading || initialHandled || !initialOpen) return;
    setInitialHandled(true);
    if (initialOpen === 'aid') setOpenFlow({ kind: 'aid' });
    else {
      const credit = services.find((s) => s.category === 'credit');
      if (credit) setOpenFlow({ kind: 'credit', service: credit });
    }
  }, [loading, initialHandled, initialOpen, services]);

  const aidCardStatus = (): { label: string; className: string } | null => {
    if (aidApps.some((a) => a.status === 'submitted')) return { label: 'Dossier en cours d’étude', className: 'bg-warning-soft text-warning' };
    return null;
  };

  const requestForService = (serviceId: string) => myRequests.find((r) => r.serviceId === serviceId);
  const isEligible = (service: MarketplaceService) =>
    service.minReputationScore === undefined || user.reputationScore >= service.minReputationScore;

  const handleAction = async () => {
    if (openFlow?.kind !== 'service') return;
    setIsSubmitting(true);
    try {
      const result = await submitMarketplaceRequest({ userId: user.uid, serviceId: openFlow.service.id });
      if (!result.success) throw new Error(result.message);
      toast.success(result.message);
      setOpenFlow(null);
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
    if (open.status === 'submitted') return { label: 'Demande en cours d’étude', className: 'bg-warning-soft text-warning' };
    if (open.status === 'offered') return { label: 'Une offre vous attend', className: 'bg-success-soft text-secondary' };
    return { label: `Reste à rembourser : ${remainingDue(open).toLocaleString('fr-FR')} FCFA`, className: 'bg-primary/10 text-primary' };
  };

  const openService = (service: MarketplaceService) =>
    setOpenFlow(service.category === 'credit' ? { kind: 'credit', service } : { kind: 'service', service });

  const flows = (
    <>
      {openFlow?.kind === 'aid' && (
        <AidFlow
          user={user}
          applications={aidApps}
          applicationFee={aidFee}
          onChanged={loadData}
          onShowTerms={() => setShowAidTerms(true)}
          onClose={closeFlow}
        />
      )}
      {openFlow?.kind === 'credit' && (
        <CreditFlow
          user={user}
          service={openFlow.service}
          icon={ICONS[openFlow.service.iconName] || Store}
          applications={creditApps}
          onChanged={loadData}
          onShowTerms={() => setShowCreditTerms(true)}
          onClose={closeFlow}
        />
      )}
      {openFlow?.kind === 'service' && (
        <ServiceScreen
          service={openFlow.service}
          icon={ICONS[openFlow.service.iconName] || Store}
          existingRequest={requestForService(openFlow.service.id)}
          eligible={isEligible(openFlow.service)}
          reputationScore={user.reputationScore}
          statusLabels={statusLabels}
          isSubmitting={isSubmitting}
          onSubmit={handleAction}
          onClose={closeFlow}
        />
      )}
      <LegalDocumentDialog docId={showCreditTerms ? 'credit' : showAidTerms ? 'aide' : null} onClose={() => { setShowCreditTerms(false); setShowAidTerms(false); }} />
    </>
  );

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

  const aidStatus = aidCardStatus();

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h1 className="text-[26px] leading-tight font-serif font-black text-foreground tracking-tight">{t('marketplace')}</h1>
        <p className="text-[14px] text-muted-foreground font-medium mt-1">{t('mkt_header_subtitle')}</p>
      </div>

      <button
        type="button"
        onClick={() => setOpenFlow({ kind: 'aid' })}
        className="press-row w-full text-left rounded-3xl gradient-sunset text-white p-5 shadow-elevated cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Gift className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-serif font-bold leading-tight">Coup de pouce eganyé</p>
            <p className="text-[13px] opacity-90 font-medium">Aide gratuite, rien à rembourser</p>
          </div>
          <ChevronRight className="w-5 h-5 shrink-0 opacity-90" />
        </div>
        <p className="mt-3 text-[13px] leading-relaxed opacity-95">
          Besoin d'argent pour votre activité ? Dites combien, présentez-vous en vidéo : notre équipe peut vous offrir le montant.
        </p>
        <span className="mt-4 inline-flex items-center rounded-full bg-white/95 text-[#C96F4A] px-4 h-9 text-[13px] font-black">
          {aidStatus ? aidStatus.label : 'Demander un coup de pouce'}
        </span>
      </button>

      {services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6 rounded-3xl border border-border">
          <PackageSearch className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm font-bold text-foreground">{t('mkt_no_service_title')}</p>
          <p className="text-xs text-muted-foreground max-w-xs">{t('mkt_no_service_desc')}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <p className="text-[13px] font-bold text-muted-foreground px-1">Autres services</p>
          <div className="rounded-3xl border border-border bg-card divide-y divide-border overflow-hidden">
            {services.map((service) => {
              const Icon = ICONS[service.iconName] || Store;
              const existingRequest = service.category === 'credit' ? undefined : requestForService(service.id);
              const status = service.category === 'credit'
                ? creditCardStatus()
                : existingRequest
                  ? { label: `${t('mkt_request_prefix')} ${statusLabels[existingRequest.status].label}`, className: statusLabels[existingRequest.status].className }
                  : null;
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => openService(service)}
                  className="press-row w-full flex items-center gap-3 p-4 text-left cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  <div className={`w-12 h-12 rounded-2xl ${service.colorClass} flex items-center justify-center shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold text-foreground leading-tight truncate">{service.title}</p>
                    <p className="text-[13px] text-muted-foreground truncate">{providerLabel(service)}</p>
                    {status && (
                      <span className={`mt-1.5 inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${status.className}`}>{status.label}</span>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {flows}
    </div>
  );
}

/** Fiche plein écran d'un service partenaire (assurance, équipement…). */
function ServiceScreen({ service, icon: Icon, existingRequest, eligible, reputationScore, statusLabels, isSubmitting, onSubmit, onClose }: {
  service: MarketplaceService;
  icon: React.ComponentType<{ className?: string }>;
  existingRequest?: MarketplaceRequest;
  eligible: boolean;
  reputationScore: number;
  statusLabels: Record<MarketplaceRequest['status'], { label: string; className: string }>;
  isSubmitting: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  return (
    <FlowScreen
      onBack={onClose}
      title={service.title}
      hero={
        <div className={`${service.colorClass} px-5 py-7 text-white`}>
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
            <Icon className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-[26px] leading-tight font-serif font-bold">{service.title}</h1>
          <p className="mt-1.5 text-[14px] opacity-90 font-medium">{providerLabel(service)}</p>
        </div>
      }
      footer={
        existingRequest || !eligible ? (
          <Button variant="outline" className="w-full h-13 text-base font-bold rounded-2xl" onClick={onClose}>Fermer</Button>
        ) : (
          <Button className="btn-shine w-full h-13 text-base font-bold rounded-2xl" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('sending_label')}</> : service.actionLabel}
          </Button>
        )
      }
    >
      <p className="text-[15px] text-foreground leading-relaxed">{service.description}</p>

      {service.requirements && service.requirements.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">{t('mkt_requirements_title')}</p>
          {service.requirements.map((req, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-sm text-foreground">
              <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
              {req}
            </div>
          ))}
        </div>
      )}

      {existingRequest ? (
        <FlowNotice icon={<Clock className="w-5 h-5 text-muted-foreground" />}>
          {`${t('mkt_already_has_request_prefix')} ${statusLabels[existingRequest.status].label.toLowerCase()} ${t('mkt_already_has_request_suffix')}`}
        </FlowNotice>
      ) : !eligible ? (
        <FlowNotice tone="danger" icon={<XCircle className="w-5 h-5 text-danger" />}>
          {t('mkt_requires_score_prefix')} {service.minReputationScore}. {t('mkt_your_score_is_suffix')} {reputationScore}.
        </FlowNotice>
      ) : (
        <FlowNotice tone="brand" icon={<AlertCircle className="w-5 h-5 text-brand" />}>
          {t('mkt_consent_disclaimer')}
        </FlowNotice>
      )}
    </FlowScreen>
  );
}
