import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Fingerprint, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CustomAvatar } from './CustomAvatar';
import { supabase } from '@/lib/supabase';
import { getBiometricsUserId, isAppLockEnabledFor, useBiometrics } from '@/hooks/useBiometrics';

/** Au-delà de ce temps en arrière-plan, on redemande l'empreinte au retour. */
const RELOCK_AFTER_MS = 60_000;

/**
 * Verrouillage de l'app quand la connexion biométrique est activée.
 *
 * Activer l'interrupteur enregistrait l'empreinte, mais rien ne la demandait
 * ensuite : l'app s'ouvrait directement. Désormais, à l'ouverture et au
 * retour après une minute en arrière-plan, un écran opaque recouvre tout
 * jusqu'à l'empreinte, ou le mot de passe du compte en secours (capteur
 * indisponible, app Android sans module biométrique, empreinte refusée).
 *
 * L'écran se superpose au lieu de démonter l'app : on retrouve la page où
 * l'on était une fois déverrouillé.
 */
export function AppLock({
  userId,
  displayName,
  photoURL,
  onLogout,
}: {
  userId: string;
  displayName: string;
  photoURL?: string;
  onLogout: () => void;
}) {
  const { isEnrolled, authenticate } = useBiometrics();
  const enabled = isEnrolled && isAppLockEnabledFor(userId);
  const [locked, setLocked] = useState(() => enabled);
  const [mode, setMode] = useState<'biometric' | 'password'>('biometric');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const hiddenAt = useRef<number | null>(null);
  const autoTried = useRef(false);

  // Empreinte enregistrée avant qu'on mémorise le compte : on l'attribue au
  // compte connecté sur cet appareil, sinon le verrou ne s'activerait jamais.
  useEffect(() => {
    if (isEnrolled && !getBiometricsUserId()) {
      try {
        localStorage.setItem('eganye_biometrics_user_id', userId);
        setLocked(true);
      } catch {
        /* stockage indisponible : pas de verrou possible */
      }
    }
  }, [isEnrolled, userId]);

  // Désactivé depuis le profil : on lève le verrou.
  useEffect(() => {
    if (!enabled) setLocked(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS) {
        hiddenAt.current = null;
        autoTried.current = false;
        setMode('biometric');
        setPassword('');
        setLocked(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled]);

  const unlockWithBiometrics = useCallback(async () => {
    setBusy(true);
    const ok = await authenticate();
    setBusy(false);
    if (ok) {
      setLocked(false);
    } else {
      // Pas d'impasse : le mot de passe prend le relais.
      setMode('password');
    }
  }, [authenticate]);

  // Propose l'empreinte tout de suite ; si le navigateur exige un geste,
  // l'échec bascule simplement sur le bouton.
  useEffect(() => {
    if (locked && mode === 'biometric' && !autoTried.current) {
      autoTried.current = true;
      unlockWithBiometrics();
    }
  }, [locked, mode, unlockWithBiometrics]);

  const unlockWithPassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!password) return;
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user.email;
      if (!email) throw new Error('no-email');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setPassword('');
      setLocked(false);
    } catch {
      toast.error('Mot de passe incorrect.');
    } finally {
      setBusy(false);
    }
  };

  if (!locked) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Application verrouillée"
      className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="w-full max-w-sm flex flex-col items-center text-center gap-6">
        <CustomAvatar photoURL={photoURL} name={displayName} size={80} />
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-bold text-foreground">Bonjour {displayName}</h1>
          <p className="text-[15px] text-muted-foreground">
            {mode === 'biometric' ? 'Déverrouillez eganyé avec votre empreinte.' : 'Entrez votre mot de passe pour continuer.'}
          </p>
        </div>

        {mode === 'biometric' ? (
          <div className="w-full space-y-3">
            <button
              type="button"
              onClick={unlockWithBiometrics}
              disabled={busy}
              aria-label="Déverrouiller avec l'empreinte"
              className="mx-auto w-24 h-24 rounded-full bg-muted text-foreground flex items-center justify-center cursor-pointer disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-9 h-9 animate-spin" /> : <Fingerprint className="w-12 h-12" />}
            </button>
            <button
              type="button"
              onClick={() => setMode('password')}
              className="w-full min-h-11 text-[15px] font-bold text-primary-ink cursor-pointer"
            >
              Utiliser mon mot de passe
            </button>
          </div>
        ) : (
          <form onSubmit={unlockWithPassword} className="w-full space-y-3">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                autoFocus
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl bg-card pr-12 text-base"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={busy || !password}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold"
            >
              {busy ? 'Vérification…' : 'Déverrouiller'}
            </Button>
            <button
              type="button"
              onClick={() => {
                setMode('biometric');
                unlockWithBiometrics();
              }}
              className="w-full min-h-11 text-[15px] font-bold text-primary-ink cursor-pointer"
            >
              Utiliser mon empreinte
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={onLogout}
          className="min-h-11 inline-flex items-center text-[13px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
        >
          Ce n'est pas moi : me déconnecter
        </button>
      </div>
    </div>
  );
}
