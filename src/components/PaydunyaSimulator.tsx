import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight, ShieldCheck, CreditCard, Smartphone, CheckCircle2 } from 'lucide-react';

interface PaydunyaSimulatorProps {
  amount: number;
  userId: string;
  userName: string;
  userEmail: string;
  onSuccess: (amount: number) => void;
  onCancel: () => void;
}

export function PaydunyaSimulator({ amount, userId, userName, userEmail, onSuccess, onCancel }: PaydunyaSimulatorProps) {
  const [paymentMethod, setPaymentMethod] = useState<'wave' | 'orange' | 'mtn' | 'card'>('wave');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [step, setStep] = useState<'details' | 'processing' | 'pin_sent' | 'success'>('details');

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentMethod !== 'card' && !phoneNumber.trim()) {
      return;
    }
    
    setStep('processing');
    
    // Simulate payment processing steps
    setTimeout(() => {
      if (paymentMethod === 'card') {
        setStep('success');
      } else {
        setStep('pin_sent');
      }
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
          <Badge className="bg-brand/20 text-brand border-brand/30 text-[10px] ml-1">SANDBOX SIMULATOR</Badge>
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
                <div className="space-y-3">
                  <Label className="text-slate-300 font-medium">Moyen de Paiement</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('wave')}
                      className={`flex flex-col items-center justify-between rounded-xl border-2 p-3 hover:bg-slate-900/80 hover:text-slate-100 cursor-pointer ${
                        paymentMethod === 'wave'
                          ? 'border-brand bg-brand/10 text-brand'
                          : 'border-slate-800 bg-slate-900/40 text-slate-400'
                      }`}
                    >
                      <Smartphone className={`w-5 h-5 mb-1 ${paymentMethod === 'wave' ? 'text-brand' : 'text-slate-400'}`} />
                      <span className="text-sm font-bold text-slate-200">Wave</span>
                      <span className="text-[10px] text-slate-500">Sans frais</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('orange')}
                      className={`flex flex-col items-center justify-between rounded-xl border-2 p-3 hover:bg-slate-900/80 hover:text-slate-100 cursor-pointer ${
                        paymentMethod === 'orange'
                          ? 'border-brand bg-brand/10 text-brand'
                          : 'border-slate-800 bg-slate-900/40 text-slate-400'
                      }`}
                    >
                      <Smartphone className={`w-5 h-5 mb-1 ${paymentMethod === 'orange' ? 'text-brand' : 'text-slate-400'}`} />
                      <span className="text-sm font-bold text-slate-200">Orange Money</span>
                      <span className="text-[10px] text-slate-500">Validation via PIN</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('mtn')}
                      className={`flex flex-col items-center justify-between rounded-xl border-2 p-3 hover:bg-slate-900/80 hover:text-slate-100 cursor-pointer ${
                        paymentMethod === 'mtn'
                          ? 'border-brand bg-brand/10 text-brand'
                          : 'border-slate-800 bg-slate-900/40 text-slate-400'
                      }`}
                    >
                      <Smartphone className={`w-5 h-5 mb-1 ${paymentMethod === 'mtn' ? 'text-brand' : 'text-slate-400'}`} />
                      <span className="text-sm font-bold text-slate-200">MTN MoMo</span>
                      <span className="text-[10px] text-slate-500">Notification Push</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`flex flex-col items-center justify-between rounded-xl border-2 p-3 hover:bg-slate-900/80 hover:text-slate-100 cursor-pointer ${
                        paymentMethod === 'card'
                          ? 'border-brand bg-brand/10 text-brand'
                          : 'border-slate-800 bg-slate-900/40 text-slate-400'
                      }`}
                    >
                      <CreditCard className={`w-5 h-5 mb-1 ${paymentMethod === 'card' ? 'text-brand' : 'text-slate-400'}`} />
                      <span className="text-sm font-bold text-slate-200">Carte Bancaire</span>
                      <span className="text-[10px] text-slate-500">Visa / Mastercard</span>
                    </button>
                  </div>
                </div>

                {paymentMethod !== 'card' ? (
                  <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                    <Label htmlFor="phone" className="text-slate-300 font-medium">
                      Numéro de Téléphone {paymentMethod.toUpperCase()}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-500 text-sm font-medium">+221</span>
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
                    <p className="text-[10px] text-slate-500">Un code de validation ou une confirmation USSD sera requis.</p>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="space-y-2">
                      <Label htmlFor="cardNo" className="text-slate-300 font-medium">Numéro de carte</Label>
                      <Input
                        id="cardNo"
                        placeholder="4000 1234 5678 9010"
                        className="bg-slate-900 border-slate-800 text-white focus-visible:ring-primary placeholder:text-slate-600"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="expiry" className="text-slate-300 font-medium">Expiration</Label>
                        <Input
                          id="expiry"
                          placeholder="MM/AA"
                          className="bg-slate-900 border-slate-800 text-white focus-visible:ring-primary placeholder:text-slate-600"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cvv" className="text-slate-300 font-medium">CVC / CVV</Label>
                        <Input
                          id="cvv"
                          placeholder="123"
                          type="password"
                          maxLength={3}
                          className="bg-slate-900 border-slate-800 text-white focus-visible:ring-primary placeholder:text-slate-600"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

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

          <CardFooter className="border-t border-slate-800/60 py-4 flex justify-between items-center text-[10px] text-slate-500">
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
