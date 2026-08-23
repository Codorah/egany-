import React from 'react';
import { motion } from 'motion/react';
import { LayoutGrid, Users, Wallet, Landmark } from 'lucide-react';
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

export function BottomNav({ user, currentView = 'dashboard', onNavigate, isSimulated = false }: BottomNavProps) {
  const { t } = useLanguage();

  if (!user) return null;

  const handleNav = (view: string) => {
    if (onNavigate) {
      onNavigate(view);
    }
  };

  // Le Profil reste accessible via le menu du Navbar (avatar en haut) — ce
  // slot met en avant Ma Banque, la fonctionnalité la plus demandée.
  const navItems = [
    {
      id: 'dashboard',
      label: t('nav_home'),
      icon: LayoutGrid,
    },
    {
      id: 'my-circles',
      label: t('nav_circles'),
      icon: Users,
    },
    {
      id: 'wallet-savings',
      label: t('nav_savings'),
      icon: Wallet,
    },
    {
      id: 'my-bank',
      label: t('my_bank'),
      icon: Landmark,
    }
  ];

  const containerClasses = isSimulated
    ? "sticky bottom-0 left-0 right-0 h-[calc(60px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] glass-nav flex justify-around items-center px-2 z-40"
    : "fixed bottom-0 left-0 right-0 h-[calc(60px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] glass-nav flex justify-around items-center px-2 z-40 md:hidden";

  return (
    <div className={containerClasses}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.id || 
          (item.id === 'my-circles' && (currentView === 'search-groups' || currentView === 'group-details' || currentView === 'contributions'));
        return (
          <button
            key={item.id}
            onClick={() => handleNav(item.id)}
            className="flex flex-col items-center justify-center flex-1 h-full relative cursor-pointer py-1.5"
          >
            <div className={`relative flex items-center justify-center transition-colors duration-200 ${
              isActive ? 'text-primary' : 'text-muted-foreground'
            }`}>
              <Icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.2 : 1.8} />
            </div>
            <span className={`text-[9px] mt-1 tracking-tight transition-colors duration-200 ${
              isActive
                ? 'text-primary font-bold'
                : 'text-muted-foreground font-medium'
            }`}>
              {item.label}
            </span>
            {isActive && (
              <motion.div
                layoutId="activeNavDot"
                className="absolute bottom-1.5 w-1 h-1 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
