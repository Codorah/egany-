import React, { useEffect, useState } from 'react';
import { Check, Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBiometrics } from '@/hooks/useBiometrics';
import { useLanguage } from '@/contexts/LanguageContext';

interface BiometricPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  username?: string;
  /** Compte à verrouiller par l'empreinte sur cet appareil. */
  userId?: string;
  mode?: 'register' | 'authenticate';
}

export function BiometricPrompt({
  isOpen,
  onClose,
  onSuccess,
  username,
  userId,
  mode = 'register'
}: BiometricPromptProps) {
  const { t } = useLanguage();
  const displayName = username || t('biom_default_username');
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
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
      ? await registerBiometrics(displayName, userId)
      : { success: await authenticate(), message: '' };

    if (result.success) {
      setScanState('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } else {
      setErrorMessage(result.message || t('biom_error_verification_failed'));
      setScanState('error');
    }
  };

  if (!isOpen) return null;

  const busy = scanState === 'scanning' || scanState === 'success';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="biometric-title"
        className="w-full max-w-sm bg-card rounded-2xl p-6 text-center"
      >
        <h3 id="biometric-title" className="text-lg font-bold text-foreground leading-tight">
          {mode === 'register' ? t('biom_register_title') : t('biom_auth_title')}
        </h3>
        <p className="mt-1.5 text-[15px] text-muted-foreground leading-relaxed">
          {mode === 'register'
            ? `${t('biom_register_desc_prefix')} ${displayName}.`
            : t('biom_auth_desc')}
        </p>

        <div
          className={`mx-auto mt-6 w-20 h-20 rounded-full flex items-center justify-center transition-colors duration-200 ${
            scanState === 'success'
              ? 'bg-secondary text-secondary-foreground'
              : scanState === 'error'
              ? 'bg-danger-soft text-danger'
              : 'bg-muted text-foreground'
          }`}
        >
          {scanState === 'success' ? <Check className="w-9 h-9" /> : <Fingerprint className="w-10 h-10" />}
        </div>

        <p
          aria-live="polite"
          className={`mt-3 min-h-5 text-[13px] font-bold ${
            scanState === 'error' ? 'text-danger' : scanState === 'success' ? 'text-secondary' : 'text-muted-foreground'
          }`}
        >
          {scanState === 'scanning' && t('biom_scanning')}
          {scanState === 'success' && t('biom_success')}
          {scanState === 'error' && (errorMessage || t('biom_error_generic'))}
          {scanState === 'idle' && t('biom_idle_cta')}
        </p>

        <div className="mt-5 flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 h-12 rounded-xl border-border text-foreground font-bold text-[15px] cursor-pointer"
          >
            {t('biom_skip')}
          </Button>
          <Button
            onClick={handleStartScan}
            disabled={busy}
            className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-[15px] cursor-pointer"
          >
            {t('biom_start')}
          </Button>
        </div>
      </div>
    </div>
  );
}
