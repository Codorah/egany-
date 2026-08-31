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
  onNavigate?: (view: string) => void;
  onLogout?: () => void;
}

export function Layout({ children, user, view, onNavigate, onLogout }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col pt-[env(safe-area-inset-top)] md:pl-64">
      {user && <Sidebar user={user} currentView={view} onNavigate={onNavigate} />}
      
      <div className="flex-1 flex flex-col w-full min-w-0">
        <Navbar user={user} onNavigate={onNavigate} onLogout={onLogout} />

        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-4 md:px-8 md:py-8 pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:pb-8 overflow-x-hidden">
          {children}
        </main>
      </div>

      {user && <BottomNav user={user} currentView={view} onNavigate={onNavigate} />}
    </div>
  );
}
