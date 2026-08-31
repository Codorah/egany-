import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './contexts/LanguageContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// Service Worker PWA — production uniquement.
//
// En développement il intercepte les modules servis par Vite (avec leurs
// query strings de HMR), ce qui produit des « Failed to fetch » en boucle et,
// pire, peut resservir depuis le cache une version périmée du code juste
// modifié. On le désenregistre donc activement en dev, sinon un worker
// installé lors d'une session précédente continuerait de tourner.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('[Service Worker] Registered successfully:', reg.scope))
        .catch((err) => console.error('[Service Worker] Registration failed:', err));
    });
  } else {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => registrations.forEach((reg) => reg.unregister()))
      .catch(() => { /* rien à nettoyer */ });

    if ('caches' in window) {
      caches.keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .catch(() => { /* rien à nettoyer */ });
    }
  }
}


