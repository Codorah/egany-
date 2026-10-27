import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Installation de l'app web (PWA), partagée entre la modale InstallPrompt et
 * le bouton « Installer l'application » de l'onboarding.
 *
 * Chrome ne déclenche `beforeinstallprompt` qu'une fois, souvent avant que le
 * composant intéressé soit monté : on capte l'événement dès le chargement du
 * module (importé par main.tsx) et on le garde ici. Un seul détenteur, sinon
 * deux composants appelleraient prompt() sur le même événement.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Sans preventDefault, Chrome affiche sa propre mini-infobar et
    // l'événement n'est plus réutilisable au moment du clic.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    emit();
  });
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  if (typeof window === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/** Déjà dans l'app (PWA installée ou APK) : rien à installer. */
export function isInstalledApp(): boolean {
  return installed || isStandalone() || Capacitor.isNativePlatform();
}

/**
 * Ouvre la fenêtre d'installation du navigateur. Renvoie le choix, ou null
 * si le navigateur n'en propose pas (iOS, déjà installée, navigateur non pris
 * en charge).
 */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | null> {
  const event = deferred;
  if (!event) return null;
  // L'événement n'est utilisable qu'une fois.
  deferred = null;
  emit();
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'accepted') installed = true;
    emit();
    return outcome;
  } catch (err) {
    console.error('[PWA] Installation impossible :', err);
    return null;
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** true quand le navigateur peut installer l'app en un tap. */
export function useCanPromptInstall(): boolean {
  return useSyncExternalStore(subscribe, () => deferred !== null && !installed, () => false);
}
