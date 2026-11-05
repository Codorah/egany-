import { toast } from 'sonner';

/**
 * Prévient l'utilisateur qu'une nouvelle version de l'application a été
 * déployée, puis la charge d'elle-même.
 *
 * Le service worker (public/sw.js) appelle skipWaiting() à l'installation :
 * une nouvelle version prend donc la main sans attendre. Rien à valider côté
 * utilisateur — la notification informe, elle ne demande pas la permission.
 * « Mettre à jour » recharge tout de suite ; sans geste, la page se recharge
 * seule après 5 secondes, en attendant la fin d'une saisie en cours
 * (code PIN, montant…) pour ne rien faire perdre.
 */

const RELOAD_DELAY_MS = 5000;
const RETRY_WHILE_TYPING_MS = 4000;
const CHECK_EVERY_MS = 30 * 60 * 1000;

let updateAnnounced = false;

function isTyping(): boolean {
  // Une fenêtre ouverte (confirmation de retrait, paiement en cours…) compte
  // aussi : on ne recharge pas la page au milieu d'une opération d'argent.
  if (document.querySelector('[role="dialog"], [role="alertdialog"], [data-slot="dialog-content"]')) return true;
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable === true;
}

function reloadWhenIdle() {
  if (isTyping()) {
    window.setTimeout(reloadWhenIdle, RETRY_WHILE_TYPING_MS);
    return;
  }
  window.location.reload();
}

function announceUpdate() {
  if (updateAnnounced) return;
  updateAnnounced = true;

  toast.info('Nouvelle mise à jour disponible', {
    description: 'Mise à jour en cours…',
    duration: RELOAD_DELAY_MS,
    action: {
      label: 'Mettre à jour',
      onClick: () => window.location.reload(),
    },
  });
  window.setTimeout(reloadWhenIdle, RELOAD_DELAY_MS);
}

export function watchForAppUpdates(registration: ServiceWorkerRegistration) {
  // Une version déjà en attente au moment de l'ouverture.
  if (registration.waiting && navigator.serviceWorker.controller) {
    announceUpdate();
  }

  registration.addEventListener('updatefound', () => {
    const incoming = registration.installing;
    if (!incoming) return;
    incoming.addEventListener('statechange', () => {
      // « controller » est nul à la toute première installation : ce n'est
      // pas une mise à jour, l'utilisateur a déjà la dernière version.
      if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
        announceUpdate();
      }
    });
  });

  // Le navigateur ne revérifie sw.js qu'à l'ouverture et environ toutes les
  // 24 h : une appli laissée ouverte (ou installée en PWA) resterait sur
  // l'ancienne version. On revérifie périodiquement et au retour sur l'app.
  const check = () => registration.update().catch(() => { /* hors ligne : on réessaiera */ });
  window.setInterval(check, CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}
