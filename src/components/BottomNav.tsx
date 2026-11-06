import React from 'react';
import { EganyeIcon, type EganyeIconName } from '@/components/ui/EganyeIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface BottomNavProps {
  user?: {
    uid: string;
    displayName: string;
    role?: string;
    photoURL?: string;
  };
  currentView?: string;
  onNavigate?: (view: string) => void;
  isSimulated?: boolean;
}

/**
 * Navigation principale mobile : Accueil, Cercles, Assistant, Épargne, Profil.
 * L'onglet actif se reconnaît à sa couleur, rien ne bouge. L'activité s'ouvre
 * depuis la cloche de la barre du haut.
 */
export function BottomNav({
  user,
  currentView = 'dashboard',
  onNavigate,
  isSimulated = false,
}: BottomNavProps) {
  const { t } = useLanguage();

  if (!user) return null;

  const isActive = (id: string) => {
    if (id === 'my-circles') {
      return ['my-circles', 'search-groups', 'group-details', 'cotiser', 'contributions', 'join'].includes(currentView);
    }
    if (id === 'my-bank') {
      return ['my-bank', 'wallet-savings', 'wallet-recharge', 'wallet-withdraw'].includes(currentView);
    }
    return currentView === id;
  };

  const items: { id: string; label: string; icon: EganyeIconName }[] = [
    { id: 'dashboard', label: t('nav_home'), icon: 'home' },
    { id: 'my-circles', label: t('nav_circles'), icon: 'circle' },
    { id: 'ai-assistant', label: t('nav_assistant'), icon: 'sparkle' },
    { id: 'my-bank', label: t('nav_savings'), icon: 'vault' },
    { id: 'profile', label: t('nav_profile_short'), icon: 'profile' },
  ];

  const containerClasses = isSimulated
    ? 'sticky bottom-0 left-0 right-0 z-40'
    : 'fixed bottom-0 left-0 right-0 z-40 md:hidden';

  return (
    <nav className={containerClasses} aria-label="Navigation principale">
      <div className="bg-card border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto flex items-stretch">
          {items.map((item) => {
            const active = isActive(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate?.(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex-1 min-w-0 h-14 flex flex-col items-center justify-center gap-0.5 cursor-pointer select-none transition-colors duration-150 ${
                  active ? 'text-primary-ink' : 'text-muted-foreground'
                }`}
              >
                <EganyeIcon name={item.icon} size={22} />
                <span className={`text-[13px] leading-tight truncate max-w-full px-0.5 ${active ? 'font-bold' : 'font-semibold'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
