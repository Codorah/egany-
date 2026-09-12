import React from 'react';
import { Home, Users, Bell, Landmark, User } from 'lucide-react';
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
 * Navigation principale — 5 onglets plats, conformément à la refonte
 * eganyé : Accueil | Cercle | Activités | Ma Banque | Profil. Pas de bouton
 * central : « Cotiser » reste accessible depuis la carte « À faire
 * aujourd'hui » de l'Accueil et depuis chaque fiche de cercle, plutôt que
 * de squatter un onglet qui ne sait de toute façon pas pour quel cercle on
 * veut payer.
 */
export function BottomNav({ user, currentView = 'dashboard', onNavigate, isSimulated = false }: BottomNavProps) {
  const { t } = useLanguage();

  if (!user) return null;

  const handleNav = (view: string) => onNavigate?.(view);

  const isActive = (id: string) => {
    if (id === 'dashboard') return currentView === 'dashboard';
    if (id === 'my-circles') {
      return ['my-circles', 'search-groups', 'group-details', 'cotiser', 'contributions'].includes(currentView);
    }
    if (id === 'activity') return currentView === 'activity';
    if (id === 'my-bank') {
      return ['my-bank', 'wallet-savings', 'wallet-recharge', 'wallet-withdraw'].includes(currentView);
    }
    if (id === 'profile') return currentView === 'profile';
    return false;
  };

  const items = [
    { id: 'dashboard', label: t('nav_home'), icon: Home },
    { id: 'my-circles', label: t('nav_circles'), icon: Users },
    { id: 'activity', label: t('nav_activity'), icon: Bell },
    { id: 'my-bank', label: t('my_bank'), icon: Landmark },
    { id: 'profile', label: t('profile'), icon: User },
  ];

  const containerClasses = isSimulated
    ? 'sticky bottom-0 left-0 right-0 z-40'
    : 'fixed bottom-0 left-0 right-0 z-40 md:hidden';

  const renderTab = (item: { id: string; label: string; icon: typeof Home }) => {
    const Icon = item.icon;
    const active = isActive(item.id);
    return (
      <button
        key={item.id}
        onClick={() => handleNav(item.id)}
        aria-current={active ? 'page' : undefined}
        className="flex flex-col items-center justify-center flex-1 gap-1.5 cursor-pointer select-none"
      >
        <Icon
          className={`w-[22px] h-[22px] transition-colors duration-200 ${
            active ? 'text-primary' : 'text-muted-foreground'
          }`}
          strokeWidth={active ? 2.4 : 1.9}
        />
        <span
          className={`text-[13px] leading-none tracking-tight transition-colors duration-200 ${
            active ? 'text-primary font-extrabold' : 'text-muted-foreground font-semibold'
          }`}
        >
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <div className={containerClasses}>
      <div className="h-[76px] pt-3 pb-[env(safe-area-inset-bottom)] bg-card/95 backdrop-blur-2xl border-t-[1.5px] border-border flex items-start px-2">
        {items.map(renderTab)}
      </div>
    </div>
  );
}
