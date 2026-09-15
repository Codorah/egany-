import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EganyeIcon } from './EganyeIcon';
import { EganyeLogo } from './EganyeLogo';

/**
 * Invitation à installer Eganyé en PWA.
 *
 * Tant que l'app n'est pas sur le Play Store / App Store, l'installation via
 * le navigateur est le seul chemin vers une icône sur l'écran d'accueil.
 * Chrome/Edge/Android exposent `beforeinstallprompt` (installation en un tap) ;
 * iOS Safari ne l'implémente pas, d'où les instructions manuelles.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'eganye_pwa_prompt_dismissed_at';
const INSTALLED_KEY = 'eganye_pwa_installed';
// Un refus se respecte : on ne repropose pas avant deux semaines.
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
// Laisse l'écran se charger avant d'interrompre : une modale qui saute au
// visage à la première frame donne envie de la fermer sans la lire.
const APPEAR_DELAY_MS = 4000;

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof window === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function wasDismissedRecently(): boolean {
  try {
    if (localStorage.getItem(INSTALLED_KEY) === 'true') return true;
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < COOLDOWN_MS;
  } catch {
    // Stockage indisponible (mode privé, cookies bloqués) : on affiche, quitte
    // à le reproposer plus tard, plutôt que de masquer l'installation.
    return false;
  }
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* rien à persister */
  }
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissedRecently()) return;

    let timer: ReturnType<typeof setTimeout>;

    const onBeforeInstall = (event: Event) => {
      // Sans preventDefault, Chrome affiche sa propre mini-infobar et
      // l'événement n'est plus réutilisable au moment du clic.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      timer = setTimeout(() => setVisible(true), APPEAR_DELAY_MS);
    };

    const onInstalled = () => {
      remember(INSTALLED_KEY, 'true');
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // iOS ne déclenche jamais beforeinstallprompt : on bascule sur le mode
    // « explique le geste » au lieu de ne rien proposer du tout.
    if (isIos()) {
      setIosHint(true);
      timer = setTimeout(() => setVisible(true), APPEAR_DELAY_MS);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      clearTimeout(timer);
    };
  }, []);

  const dismiss = useCallback(() => {
    remember(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    setVisible(false);
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') {
        remember(INSTALLED_KEY, 'true');
      } else {
        remember(DISMISSED_KEY, String(Date.now()));
      }
    } catch (err) {
      console.error('[PWA] Installation impossible :', err);
    } finally {
      // L'événement n'est utilisable qu'une fois.
      setDeferred(null);
    }
  }, [deferred]);

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismiss}
            className="fixed inset-0 z-[60] bg-[#3E2F24]/45 backdrop-blur-[2px]"
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-prompt-title"
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="fixed inset-x-3 bottom-3 z-[61] mx-auto max-w-sm rounded-3xl border border-[#EFE2D0] dark:border-border bg-card p-5 shadow-soft sm:inset-x-0 sm:bottom-6"
          >
            <button
              type="button"
              onClick={dismiss}
              aria-label="Fermer"
              className="absolute right-3.5 top-3.5 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
            >
              <EganyeIcon name="close" size={16} />
            </button>

            <div className="flex items-start gap-3.5">
              <EganyeLogo size={46} />
              <div className="min-w-0 pr-6">
                <h2
                  id="install-prompt-title"
                  className="font-serif text-base font-black leading-tight text-foreground"
                >
                  Installer Eganyé sur votre téléphone
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {iosHint
                    ? 'Ouvrez le menu Partager de Safari, puis choisissez « Sur l’écran d’accueil ».'
                    : 'Accédez à vos cercles en un tap, même hors connexion, sans passer par le navigateur.'}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              {iosHint ? (
                <button
                  type="button"
                  onClick={dismiss}
                  className="btn-shine gradient-sunset h-11 flex-1 rounded-2xl text-sm font-bold text-white cursor-pointer"
                >
                  J’ai compris
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={dismiss}
                    className="h-11 rounded-2xl px-4 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                  >
                    Plus tard
                  </button>
                  <button
                    type="button"
                    onClick={install}
                    className="btn-shine gradient-sunset h-11 flex-1 rounded-2xl text-sm font-bold text-white cursor-pointer inline-flex items-center justify-center gap-2"
                  >
                    <EganyeIcon name="download" size={16} />
                    <span>Installer</span>
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
