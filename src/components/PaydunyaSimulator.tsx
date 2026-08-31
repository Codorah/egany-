import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight, ShieldCheck, Smartphone, CheckCircle2 } from 'lucide-react';
import { PAYDUNYA_COUNTRIES, getOperatorsForCountry, findCountryForOperator } from '@/lib/paydunyaMethods';

interface PaydunyaSimulatorProps {
  amount: number;
  userId: string;
  userName: string;
  userEmail: string;
  /** Pré-sélectionnés depuis la carte Recharger de Profile.tsx, le cas échéant. */
  initialOperator?: string;
  initialPhone?: string;
  onSuccess: (amount: number) => void;
  onCancel: () => void;
}

export function PaydunyaSimulator({ amount, userId, userName, userEmail, initialOperator, initialPhone, onSuccess, onCancel }: PaydunyaSimulatorProps) {
  const initialCountry = (initialOperator && findCountryForOperator(initialOperator)) || PAYDUNYA_COUNTRIES[0].code;
  const [country, setCountry] = useState(initialCountry);
  const [paymentMethod, setPaymentMethod] = useState(
    initialOperator || getOperatorsForCountry(initialCountry)[0].value
  );
  const selectedCountry = PAYDUNYA_COUNTRIES.find((c) => c.code === country) ?? PAYDUNYA_COUNTRIES[0];
  const availableMethods = getOperatorsForCountry(country);
  const handleCountryChange = (nextCountry: string) => {
    setCountry(nextCountry);
    setPaymentMethod(getOperatorsForCountry(nextCountry)[0].value);
  };
  const [phoneNumber, setPhoneNumber] = useState(initialPhone || '');
  const [step, setStep] = useState<'details' | 'processing' | 'pin_sent' | 'success'>('details');

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      return;
    }

    setStep('processing');

    // Simulate payment processing steps
    setTimeout(() => {
      setStep('pin_sent');
    }, 2000);
  };

  const handleConfirmPin = () => {
    setStep('processing');
    setTimeout(() => {
      setStep('success');
    }, 1500);
  };

  const handleCompleteRedirect = () => {
    onSuccess(amount);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-center gap-2 mb-6 text-white">
          <div className="bg-brand text-primary-foreground p-1.5 rounded-lg font-bold text-lg">P</div>
          <span className="text-xl font-black tracking-widest text-brand">PAYDUNYA</span>
          <Badge className="bg-brand/20 text-brand border-brand/30 text-[13px] ml-1">SANDBOX SIMULATOR</Badge>
        </div>

        <Card className="border-slate-800 bg-slate-950 text-white shadow-2xl">
          <CardHeader className="border-b border-slate-800">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg text-slate-200 font-bold">Paiement Sécurisé</CardTitle>
                <CardDescription className="text-slate-400 text-xs mt-0.5">Tontine Connect Wallet Top-up</CardDescription>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block font-medium">Montant</span>
                <span className="text-lg font-black text-brand">{amount.toLocaleString()} FCFA</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {step === 'details' && (
              <form onSubmit={handlePayment} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-slate-300 font-medium">Pays</Label>
                  <div role="group" aria-label="Pays" className="flex flex-wrap gap-2">
                    {PAYDUNYA_COUNTRIES.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => handleCountryChange(c.code)}
                        className={`px-3.5 h-9 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                          country === c.code
                            ? 'bg-brand text-primary-foreground border-brand'
                            : 'bg-slate-900/40 text-slate-300 border-slate-800 hover:bg-slate-900/80 hover:border-slate-700'
                        }`}
                      >
                        <span className="mr-1.5">{c.flag}</span>{c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-slate-300 font-medium">Moyen de Paiement</Label>
                  <div className="space-y-2.5">
                    {availableMethods.map((method) => {
                      const isActive = paymentMethod === method.value;
                      return (
                        <button
                          key={method.value}
                          type="button"
                          onClick={() => setPaymentMethod(method.value)}
                          className={`w-full flex items-center gap-3.5 rounded-2xl border-2 py-3.5 px-4 text-left transition-colors cursor-pointer ${
                            isActive
                              ? 'border-brand bg-brand/10'
                              : 'border-slate-800 bg-slate-900/40 hover:bg-slate-900/80 hover:border-slate-700'
                          }`}
                        >
                          <span
                            className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                              isActive ? 'bg-brand/20 text-brand' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            <Smartphone className="w-5 h-5" />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className={`block text-sm font-bold truncate ${isActive ? 'text-white' : 'text-slate-200'}`}>
                              {method.label}
                            </span>
                            <span className="block text-[13px] text-slate-500">Validation via PIN</span>
                          </span>
                          <span
                            className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              isActive ? 'border-brand' : 'border-slate-700'
                            }`}
                          >
                            {isActive && <span className="w-2.5 h-2.5 rounded-full bg-brand" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                  <Label htmlFor="phone" className="text-slate-300 font-medium">
                    Numéro de Téléphone
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500 text-sm font-medium">{selectedCountry.dialCode}</span>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="77 123 45 67"
                      className="pl-14 bg-slate-900 border-slate-800 text-white focus-visible:ring-primary placeholder:text-slate-600"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required
                    />
                  </div>
                  <p className="text-[13px] text-slate-500">Un code de validation ou une confirmation USSD sera requis.</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="w-1/2 text-slate-400 hover:text-white hover:bg-slate-900/50" 
                    onClick={onCancel}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    className="w-1/2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                  >
                    Payer {amount.toLocaleString()} FCFA
                  </Button>
                </div>
              </form>
            )}

            {step === 'processing' && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-brand" />
                <div className="text-center space-y-1">
                  <p className="font-bold text-slate-200">Traitement de la transaction...</p>
                  <p className="text-xs text-slate-500">Sécurisé par chiffrement SSL de Paydunya.</p>
                </div>
              </div>
            )}

            {step === 'pin_sent' && (
              <div className="space-y-5 py-4 animate-in fade-in duration-300">
                <div className="flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center text-brand">
                    <Smartphone className="w-6 h-6 animate-bounce" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-lg text-slate-200">PIN Requis</p>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      Une demande de débit a été envoyée sur le numéro de téléphone. Veuillez confirmer sur votre appareil mobile.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-500 uppercase font-semibold">Tutoriel Sandbox</p>
                  <p className="text-xs text-slate-300 mt-1">
                    Puisque vous êtes en mode Simulation Sandbox, cliquez simplement sur le bouton ci-dessous pour simuler l'approbation Mobile Money.
                  </p>
                </div>

                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                  onClick={handleConfirmPin}
                >
                  Confirmer le Paiement USSD/PIN
                </Button>
              </div>
            )}

            {step === 'success' && (
              <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 rounded-full bg-success-soft flex items-center justify-center text-secondary">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-100">Paiement Réussi !</h3>
                  <p className="text-sm text-slate-400 max-w-xs mx-auto">
                    Votre paiement de <span className="text-brand font-bold">{amount.toLocaleString()} FCFA</span> a été validé avec succès par le wallet Paydunya.
                  </p>
                </div>

                <Button 
                  className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold"
                  onClick={handleCompleteRedirect}
                >
                  Retourner à Tontine Connect
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>

          <CardFooter className="border-t border-slate-800/60 py-4 flex justify-between items-center text-[13px] text-slate-500">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>PCI-DSS Compliant</span>
            </div>
            <span>Marchand ID: TONTINE-CONNECT</span>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
