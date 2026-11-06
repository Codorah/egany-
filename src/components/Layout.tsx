import React from 'react';
import { Navbar } from './Navbar';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  user?: {
    uid: string;
    displayName: string;
    email: string;
    photoURL?: string;
    role?: string;
  };
  view?: string;
  /** Titre de l'écran, affiché dans la barre du haut. */
  title?: string;
  /** Présent : la barre affiche le retour. */
  onBack?: () => void;
  showLogo?: boolean;
  /** L'écran a sa propre barre sur téléphone : pas de seconde barre. */
  hideBarOnMobile?: boolean;
  onNavigate?: (view: string) => void;
  onLogout?: () => void;
}

export function Layout({ children, user, view, title, onBack, showLogo, hideBarOnMobile, onNavigate, onLogout }: LayoutProps) {
  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col pt-[env(safe-area-inset-top)] md:pl-64">
      {user && <Sidebar user={user} currentView={view} onNavigate={onNavigate} />}
      
      <div className="flex-1 flex flex-col w-full min-w-0">
        <div className={hideBarOnMobile ? 'hidden md:block' : ''}>
          <Navbar user={user} title={title} onBack={onBack} showLogo={showLogo} view={view} onNavigate={onNavigate} onLogout={onLogout} />
        </div>

        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-4 md:px-8 md:py-8 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8 overflow-x-hidden">
          {children}
        </main>
      </div>

      {user && <BottomNav user={user} currentView={view} onNavigate={onNavigate} />}
    </div>
  );
}
