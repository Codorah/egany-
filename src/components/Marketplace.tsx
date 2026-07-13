import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Store, ShieldPlus, Tractor, Zap, TrendingUp, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Service {
  id: string;
  title: string;
  description: string;
  provider: string;
  icon: React.ReactNode;
  category: 'assurance' | 'credit' | 'equipement';
  color: string;
  requirements?: string[];
  actionLabel: string;
}

export function Marketplace() {
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const services: Service[] = [
    {
      id: 'assurance-sante',
      title: 'Assurance Santé Tontine',
      description: 'Couverture médicale de base pour vous et votre famille. Payez mensuellement avec le solde de votre portefeuille.',
      provider: 'Partenaire INAM / Assurances',
      icon: <ShieldPlus className="w-8 h-8 text-white" />,
      category: 'assurance',
      color: 'bg-blue-500',
      requirements: ['Score de réputation B minimum', 'Solde wallet: 2000 FCFA/mois'],
      actionLabel: 'Souscrire à l\'assurance'
    },
    {
      id: 'credit-agricole',
      title: 'Micro-crédit Agricole',
      description: 'Financez vos semences et intrants pour la saison. Remboursement adossé à vos rentrées de tontine.',
      provider: 'Fonds d\'Appui Agricole',
      icon: <Tractor className="w-8 h-8 text-white" />,
      category: 'credit',
      color: 'bg-green-600',
      requirements: ['Score de réputation A ou S', 'Avoir terminé 1 cycle de tontine'],
      actionLabel: 'Demander le crédit'
    },
    {
      id: 'kit-solaire',
      title: 'Kit Solaire PAYGO',
      description: 'Équipez-vous en panneaux solaires. Le paiement fractionné est prélevé automatiquement sur vos tours de tontine.',
      provider: 'EnergieTogo / Bboxx',
      icon: <Zap className="w-8 h-8 text-white" />,
      category: 'equipement',
      color: 'bg-amber-500',
      requirements: ['Validation du gestionnaire du groupe'],
      actionLabel: 'Commander le kit'
    },
    {
      id: 'epargne-retraite',
      title: 'Épargne Retraite',
      description: 'Convertissez une partie de vos gains de tontine en une épargne retraite bloquée à fort rendement (7%/an).',
      provider: 'Caisse de Retraite',
      icon: <TrendingUp className="w-8 h-8 text-white" />,
      category: 'assurance',
      color: 'bg-purple-500',
      actionLabel: 'Ouvrir un compte retraite'
    }
  ];

  const handleAction = async () => {
    setIsSubmitting(true);
    // Simulate API call for subscription
    await new Promise(r => setTimeout(r, 1500));
    setIsSubmitting(false);
    toast.success(`Demande pour "${selectedService?.title}" envoyée avec succès ! Notre partenaire vous contactera sous 24h.`);
    setSelectedService(null);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map(service => (
          <div 
            key={service.id} 
            className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-shadow flex flex-col justify-between cursor-pointer"
            onClick={() => setSelectedService(service)}
          >
            <div className="flex items-start gap-4 mb-4">
              <div className={`p-3 rounded-2xl ${service.color} shadow-sm shrink-0`}>
                {service.icon}
              </div>
              <div>
                <h3 className="font-bold text-foreground text-lg leading-tight">{service.title}</h3>
                <p className="text-xs text-brand font-semibold mt-1">{service.provider}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed line-clamp-2">
              {service.description}
            </p>
            <Button variant="outline" className="w-full font-bold border-brand/30 text-brand hover:bg-brand/10">
              Voir les détails <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {selectedService && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card w-full max-w-md rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className={`${selectedService.color} p-6 text-white relative`}>
                <button 
                  onClick={() => setSelectedService(null)}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/40 transition-colors"
                >
                  ✕
                </button>
                {selectedService.icon}
                <h2 className="text-2xl font-black mt-4">{selectedService.title}</h2>
                <p className="opacity-90 text-sm mt-1">{selectedService.provider}</p>
              </div>

              <div className="p-6 overflow-y-auto">
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  {selectedService.description}
                </p>

                {selectedService.requirements && (
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

                <div className="bg-brand/5 border border-brand/20 p-4 rounded-xl flex items-start gap-3 mb-6">
                  <AlertCircle className="w-5 h-5 text-brand shrink-0 mt-0.5" />
                  <p className="text-xs text-brand-deep leading-relaxed">
                    En souscrivant, vous autorisez notre partenaire à consulter votre score de réputation égané pour valider votre demande.
                  </p>
                </div>

                <Button 
                  className="w-full h-12 text-base font-bold rounded-xl"
                  onClick={handleAction}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Traitement en cours..." : selectedService.actionLabel}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
