import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Fingerprint,
  ScanFace,
  ShieldCheck,
  Lock,
  X,
  Check,
  Smartphone,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBiometrics } from '@/hooks/useBiometrics';

interface BiometricPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  username?: string;
  mode?: 'register' | 'authenticate';
}

export function BiometricPrompt({
  isOpen,
  onClose,
  onSuccess,
  username = "Utilisateur",
  mode = 'register'
}: BiometricPromptProps) {
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [authType, setAuthType] = useState<'fingerprint' | 'faceid'>('fingerprint');
  const { registerBiometrics, authenticate } = useBiometrics();

  useEffect(() => {
    if (isOpen) {
      setScanState('idle');
      setErrorMessage('');
      handleStartScan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleStartScan = async () => {
    setScanState('scanning');

    const result = mode === 'register'
      ? await registerBiometrics(username)
      : { success: await authenticate(), message: '' };

    if (result.success) {
      setScanState('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } else {
      setErrorMessage(result.message || "Échec de la vérification biométrique.");
      setScanState('error');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">

        {/* Animated Card Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-sm bg-card rounded-3xl border border-border shadow-2xl p-6 relative overflow-hidden"
        >
          {/* Subtle gold decoration */}
          <div className="absolute top-[-10%] left-[-10%] w-24 h-24 bg-brand/5 rounded-full blur-xl pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-10%] w-24 h-24 bg-secondary/5 rounded-full blur-xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-muted hover:bg-border text-muted-foreground transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="text-center space-y-6 pt-2">

            {/* Logo/Icon Header */}
            <div className="flex justify-center gap-1.5 items-center text-brand">
              <Lock className="w-4 h-4 text-secondary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Sécurité Biométrique eganyé
              </span>
            </div>

            {/* Main Descriptive text */}
            <div className="space-y-1">
              <h3 className="text-lg font-black text-foreground leading-tight">
                {mode === 'register' ? 'Associer votre Biométrie' : 'Connexion Sécurisée'}
              </h3>
              <p className="text-xs text-muted-foreground px-4 leading-relaxed">
                {mode === 'register'
                  ? `Activez l'accès ultra-rapide par empreinte ou reconnaissance faciale pour votre compte ${username}.`
                  : `Posez votre doigt ou regardez l'appareil pour déverrouiller votre coffre eganyé.`
                }
              </p>
            </div>

            {/* Toggle choice between fingerprint & Face ID */}
            <div className="flex justify-center gap-2 bg-muted p-1 rounded-2xl w-fit mx-auto">
              <button
                type="button"
                onClick={() => {
                  setAuthType('fingerprint');
                  if (scanState === 'idle') handleStartScan();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  authType === 'fingerprint'
                    ? 'bg-secondary text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Fingerprint className="w-3.5 h-3.5" />
                Empreinte
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthType('faceid');
                  if (scanState === 'idle') handleStartScan();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  authType === 'faceid'
                    ? 'bg-secondary text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ScanFace className="w-3.5 h-3.5" />
                Face ID
              </button>
            </div>

            {/* Central Animated Biometric Scanner Zone */}
            <div className="relative flex flex-col items-center justify-center py-6 h-40">

              {/* Outer Pulsing ripples */}
              <AnimatePresence>
                {scanState === 'scanning' && (
                  <>
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0.5 }}
                      animate={{ scale: 1.4, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ repeat: Infinity, duration: 1.8, ease: "easeOut" }}
                      className="absolute w-24 h-24 rounded-full border border-secondary/30"
                    />
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0.5 }}
                      animate={{ scale: 1.7, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ repeat: Infinity, duration: 1.8, ease: "easeOut", delay: 0.6 }}
                      className="absolute w-24 h-24 rounded-full border border-brand/20"
                    />
                  </>
                )}
              </AnimatePresence>

              {/* Central Circle Shield or sensor button */}
              <button
                type="button"
                onClick={handleStartScan}
                disabled={scanState === 'scanning' || scanState === 'success'}
                className={`w-24 h-24 rounded-full flex items-center justify-center border-3 relative shadow-lg transition-all cursor-pointer focus:outline-none ${
                  scanState === 'scanning'
                    ? 'border-secondary bg-secondary/5'
                    : scanState === 'success'
                    ? 'border-secondary bg-secondary'
                    : scanState === 'error'
                    ? 'border-danger bg-danger-soft'
                    : 'border-eganye-gold bg-card hover:scale-105'
                }`}
              >
                {/* Horizontal scanner light bar sliding down the icon */}
                {scanState === 'scanning' && (
                  <motion.div
                    initial={{ top: '15%' }}
                    animate={{ top: '80%' }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut", repeatType: "reverse" }}
                    className="absolute left-1/2 -translate-x-1/2 w-[60%] h-0.5 bg-secondary shadow-[0_0_10px_var(--secondary)] rounded-full z-10"
                  />
                )}

                {/* Main sensor icon */}
                <AnimatePresence mode="wait">
                  {scanState === 'success' ? (
                    <motion.div
                      key="success-icon"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-white"
                    >
                      <Check className="w-10 h-10 stroke-[3]" />
                    </motion.div>
                  ) : authType === 'fingerprint' ? (
                    <motion.div
                      key="fingerprint-icon"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className={
                        scanState === 'scanning'
                          ? 'text-secondary'
                          : scanState === 'error'
                          ? 'text-danger'
                          : 'text-foreground'
                      }
                    >
                      <Fingerprint className="w-12 h-12" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="faceid-icon"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className={
                        scanState === 'scanning'
                          ? 'text-secondary'
                          : scanState === 'error'
                          ? 'text-danger'
                          : 'text-foreground'
                      }
                    >
                      <ScanFace className="w-12 h-12" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>

              {/* Scanning details / feedback text */}
              <div className="absolute bottom-[-15px] left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className={`text-[11px] font-black tracking-wide uppercase transition-colors duration-300 ${
                  scanState === 'scanning'
                    ? 'text-secondary animate-pulse'
                    : scanState === 'success'
                    ? 'text-secondary'
                    : scanState === 'error'
                    ? 'text-danger'
                    : 'text-muted-foreground'
                }`}>
                  {scanState === 'scanning' && 'Lecture biométrique...'}
                  {scanState === 'success' && 'Vérification réussie !'}
                  {scanState === 'error' && (errorMessage || 'Échec, réessayez.')}
                  {scanState === 'idle' && 'Cliquez pour commencer'}
                </span>
              </div>

            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 rounded-2xl h-10 border-border text-foreground font-bold text-xs cursor-pointer"
              >
                Passer
              </Button>
              <Button
                onClick={handleStartScan}
                disabled={scanState === 'scanning' || scanState === 'success'}
                className="flex-1 bg-secondary hover:bg-secondary/90 text-white font-bold rounded-2xl h-10 text-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" />
                Démarrer
              </Button>
            </div>

            {/* Footnote */}
            <p className="text-[9px] text-muted-foreground italic max-w-xs mx-auto leading-normal">
              Sécurisé par l'API biométrique standard de votre appareil (WebAuthn / Capacitor Biometrics).
            </p>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
