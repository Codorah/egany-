import React from 'react';
import { motion } from 'motion/react';
import { LayoutGrid, Users, Wallet, User } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { CustomAvatar } from './CustomAvatar';

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

  const navItems = [
    {
      id: 'dashboard',
      label: 'Accueil',
      icon: LayoutGrid,
    },
    {
      id: 'my-circles',
      label: 'Cercles',
      icon: Users,
    },
    {
      id: 'wallet-savings',
      label: 'Épargne',
      icon: Wallet,
    },
    {
      id: 'profile',
      label: 'Profil',
      icon: User,
    }
  ];

  const containerClasses = isSimulated
    ? "sticky bottom-0 left-0 right-0 h-[60px] glass-nav flex justify-around items-center px-2 z-40"
    : "fixed bottom-0 left-0 right-0 h-[60px] glass-nav flex justify-around items-center px-2 z-40 md:hidden";

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
              {item.id === 'profile' ? (
                <div className={`rounded-full transition-all ${isActive ? 'ring-2 ring-primary' : 'ring-1 ring-border'}`}>
                  <CustomAvatar photoURL={user.photoURL} name={user.displayName} size={22} />
                </div>
              ) : (
                <Icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.2 : 1.8} />
              )}
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
