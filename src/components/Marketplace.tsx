import React, { useEffect, useState } from 'react';
import { Store, ShieldPlus, Tractor, Zap, TrendingUp, ChevronRight, CheckCircle2, AlertCircle, Loader2, Clock, XCircle, RefreshCw, PackageSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { UserProfile, MarketplaceService, MarketplaceRequest } from '@/types';
import { fetchActiveServices, fetchMyMarketplaceRequests, submitMarketplaceRequest } from '@/lib/marketplace';

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

const statusLabels: Record<MarketplaceRequest['status'], { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'bg-amber-500/10 text-amber-600' },
  contacted: { label: 'Contacté', className: 'bg-blue-500/10 text-blue-600' },
  approved: { label: 'Approuvé', className: 'bg-emerald-500/10 text-emerald-600' },
  rejected: { label: 'Refusé', className: 'bg-rose-500/10 text-rose-600' },
};

export function Marketplace({ user }: MarketplaceProps) {
  const [services, setServices] = useState<MarketplaceService[]>([]);
  const [myRequests, setMyRequests] = useState<MarketplaceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedService, setSelectedService] = useState<MarketplaceService | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setIsSubmitting(true);
    try {
      const result = await submitMarketplaceRequest({ userId: user.uid, serviceId: selectedService.id });
      if (!result.success) throw new Error(result.message);
      toast.success(result.message);
      setSelectedService(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'envoi de la demande.");
    } finally {
      setIsSubmitting(false);
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
        <p className="text-sm font-bold text-foreground">Impossible de charger le Marketplace</p>
        <p className="text-xs text-muted-foreground max-w-xs">Vérifiez votre connexion et réessayez.</p>
        <Button variant="outline" size="sm" onClick={loadData} className="mt-2 font-bold">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Réessayer
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
          <h1 className="text-2xl font-black text-foreground">Services Annexes</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Profitez de votre score de réputation pour accéder à des services financiers exclusifs au Togo et en Afrique de l'Ouest.
        </p>
      </div>

      {services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6 glass-card rounded-3xl shadow-soft">
          <PackageSearch className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm font-bold text-foreground">Aucun service disponible pour le moment</p>
          <p className="text-xs text-muted-foreground max-w-xs">Revenez bientôt : de nouveaux partenaires seront ajoutés régulièrement.</p>
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
                    Demande : {statusLabels[existingRequest.status].label}
                  </div>
                ) : (
                  <Button variant="outline" className="w-full font-bold border-brand/30 text-brand hover:bg-brand/10 h-11">
                    Voir les détails <ChevronRight className="w-4 h-4 ml-1" />
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
                    <h4 className="text-xs font-bold uppercase text-foreground mb-3 tracking-wider">Pré-requis</h4>
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

                {requestForService(selectedService.id) ? (
                  <div className="bg-muted p-4 rounded-xl flex items-center gap-3 mb-2 text-sm">
                    <Clock className="w-5 h-5 text-muted-foreground shrink-0" />
                    Vous avez déjà une demande {statusLabels[requestForService(selectedService.id)!.status].label.toLowerCase()} pour ce service.
                  </div>
                ) : !isEligible(selectedService) ? (
                  <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-start gap-3 mb-2">
                    <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-700 dark:text-rose-400 leading-relaxed">
                      Ce service nécessite un score de réputation d'au moins {selectedService.minReputationScore}. Le vôtre est actuellement {user.reputationScore}.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="bg-brand/5 border border-brand/20 p-4 rounded-xl flex items-start gap-3 mb-6">
                      <AlertCircle className="w-5 h-5 text-brand shrink-0 mt-0.5" />
                      <p className="text-xs text-brand-deep leading-relaxed">
                        En soumettant cette demande, vous autorisez notre partenaire à consulter votre score de réputation eganyé pour la traiter.
                      </p>
                    </div>
                    <Button
                      className="w-full h-12 text-base font-bold rounded-xl"
                      onClick={handleAction}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Envoi en cours...' : selectedService.actionLabel}
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
