import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { APK_DOWNLOAD_URL, PLAY_STORE_PUBLISHED } from '@/lib/links';
import { isInstalledApp, isIos, promptInstall, useCanPromptInstall } from '@/lib/pwaInstall';

/**
 * Invitation à installer Eganyé en PWA.
 *
 * Tant que l'app n'est pas sur le Play Store / App Store, l'installation via
 * le navigateur est le seul chemin vers une icône sur l'écran d'accueil.
 * Chrome/Edge/Android exposent `beforeinstallprompt` (installation en un tap) ;
 * iOS Safari ne l'implémente pas, d'où les instructions manuelles.
 */

const DISMISSED_KEY = 'eganye_pwa_prompt_dismissed_at';
const INSTALLED_KEY = 'eganye_pwa_installed';
// Un refus se respecte : on ne repropose pas avant deux semaines.
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const FIRST_SEEN_KEY = 'eganye_pwa_first_seen_at';
// Pas à la première visite : la personne vient d'arriver, elle a autre chose à faire.
const FIRST_VISIT_MS = 24 * 60 * 60 * 1000;
// Laisse l'écran se charger avant d'interrompre : une modale qui saute au
// visage à la première frame donne envie de la fermer sans la lire.
const APPEAR_DELAY_MS = 4000;

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

function isFirstVisit(): boolean {
  try {
    const raw = localStorage.getItem(FIRST_SEEN_KEY);
    if (!raw) {
      localStorage.setItem(FIRST_SEEN_KEY, String(Date.now()));
      return true;
    }
    return Date.now() - Number(raw) < FIRST_VISIT_MS;
  } catch {
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
  const { t } = useLanguage();
  const canPrompt = useCanPromptInstall();
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const reduceMotion = useReducedMotion();

  // L'événement d'installation est capté dès le chargement par pwaInstall ;
  // ici on décide seulement quand proposer la fenêtre.
  useEffect(() => {
    if (isInstalledApp() || wasDismissedRecently() || isFirstVisit()) return;
    if (!canPrompt && !isIos()) return;
    // iOS ne déclenche jamais beforeinstallprompt : on bascule sur le mode
    // « explique le geste » au lieu de ne rien proposer du tout.
    setIosHint(!canPrompt && isIos());
    const timer = setTimeout(() => setVisible(true), APPEAR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [canPrompt]);

  const dismiss = useCallback(() => {
    remember(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  }, []);

  const install = useCallback(async () => {
    setVisible(false);
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      remember(INSTALLED_KEY, 'true');
    } else if (outcome === 'dismissed') {
      remember(DISMISSED_KEY, String(Date.now()));
    }
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="dialog"
          aria-labelledby="install-prompt-title"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-30 mx-auto max-w-sm rounded-2xl bg-card p-4 shadow-elevated md:bottom-6"
        >
          <h2 id="install-prompt-title" className="text-[15px] font-bold leading-tight text-foreground">
            {t('install_title')}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {iosHint ? t('install_ios_hint') : t('install_desc')}
          </p>

          <div className="mt-3 flex items-center gap-2">
            {iosHint ? (
              <button
                type="button"
                onClick={dismiss}
                className="h-11 flex-1 rounded-xl bg-primary text-[15px] font-bold text-primary-foreground cursor-pointer"
              >
                {t('install_got_it')}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={dismiss}
                  className="h-11 rounded-xl px-4 text-[15px] font-bold text-muted-foreground cursor-pointer"
                >
                  {t('install_later')}
                </button>
                <button
                  type="button"
                  onClick={install}
                  className="h-11 flex-1 rounded-xl bg-primary text-[15px] font-bold text-primary-foreground cursor-pointer"
                >
                  {t('install_cta')}
                </button>
              </>
            )}
          </div>

          {/* Android hors Play Store : l'APK signé du site, pour qui préfère
              une vraie app à l'installation par le navigateur. */}
          {!iosHint && !PLAY_STORE_PUBLISHED && (
            <a
              href={APK_DOWNLOAD_URL}
              download="eganye.apk"
              onClick={dismiss}
              className="mt-1 flex min-h-11 items-center justify-center text-[13px] font-bold text-muted-foreground underline underline-offset-2"
            >
              {t('install_apk_link')}
            </a>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
