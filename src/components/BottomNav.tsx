import React from 'react';
import { Home, Users, Plus, Bell, User } from 'lucide-react';
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
 * Navigation principale — 5 onglets, conformément à la charte eganyé.
 *
 * « Cotiser » est traité à part : c'est l'action que l'application veut
 * provoquer, elle occupe donc un bouton orange surélevé au centre plutôt
 * qu'un onglet ordinaire. Les quatre autres sont des destinations.
 */
export function BottomNav({ user, currentView = 'dashboard', onNavigate, isSimulated = false }: BottomNavProps) {
  const { t } = useLanguage();

  if (!user) return null;

  const handleNav = (view: string) => onNavigate?.(view);

  const isActive = (id: string) => {
    if (id === 'dashboard') return currentView === 'dashboard';
    if (id === 'my-circles') {
      return ['my-circles', 'search-groups', 'group-details'].includes(currentView);
    }
    if (id === 'activity') return currentView === 'activity';
    if (id === 'profile') {
      return ['profile', 'wallet-savings', 'wallet-recharge', 'wallet-withdraw', 'my-bank'].includes(currentView);
    }
    return false;
  };

  const sideItems = [
    { id: 'dashboard', label: t('nav_home'), icon: Home },
    { id: 'my-circles', label: t('nav_circles'), icon: Users },
  ];

  const rightItems = [
    { id: 'activity', label: t('nav_activity'), icon: Bell },
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
        className="flex flex-col items-center justify-center flex-1 gap-1.5 cursor-pointer select-none active:scale-90 transition-transform"
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
      <div className="h-[84px] pt-3 pb-[env(safe-area-inset-bottom)] bg-card/95 backdrop-blur-2xl border-t-[1.5px] border-border flex items-start px-2">
        {sideItems.map(renderTab)}

        {/* Action centrale — surélevée hors de la barre */}
        <div className="flex-1 flex flex-col items-center">
          <button
            onClick={() => handleNav('cotiser')}
            className="-mt-8 w-16 h-16 rounded-full gradient-sunset text-white flex items-center justify-center shadow-[0_10px_24px_-8px_var(--brand-deep)] ring-4 ring-card cursor-pointer active:scale-90 transition-transform"
          >
            <Plus className="w-7 h-7" strokeWidth={2.6} />
          </button>
          <span
            className={`text-[13px] leading-none tracking-tight mt-1.5 transition-colors duration-200 ${
              currentView === 'cotiser' || currentView === 'contributions'
                ? 'text-primary font-extrabold'
                : 'text-muted-foreground font-semibold'
            }`}
          >
            {t('nav_contribute')}
          </span>
        </div>

        {rightItems.map(renderTab)}
      </div>
    </div>
  );
}
