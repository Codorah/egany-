import React from 'react';
import { motion } from 'motion/react';
import { LayoutGrid, Users, Wallet, User } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface BottomNavProps {
  user?: {
    uid: string;
    displayName: string;
    role?: string;
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
      icon: <LayoutGrid className="w-5 h-5" />,
    },
    {
      id: 'my-circles',
      label: 'Mes Cercles',
      icon: <Users className="w-5 h-5" />,
    },
    {
      id: 'wallet-savings',
      label: 'Mon Épargne',
      icon: <Wallet className="w-5 h-5" />,
    },
    {
      id: 'profile',
      label: 'Profil',
      icon: <User className="w-5 h-5" />,
    }
  ];

  const containerClasses = isSimulated
    ? "sticky bottom-0 left-0 right-0 h-16 bg-card/95 backdrop-blur-md flex justify-around items-center px-4 z-40 border-t border-border/80"
    : "fixed bottom-0 left-0 right-0 h-16 bg-card/95 backdrop-blur-md flex justify-around items-center px-4 z-40 border-t border-border/80 md:hidden";

  return (
    <div className={containerClasses}>
      {navItems.map((item) => {
        const isActive = currentView === item.id || 
          (item.id === 'my-circles' && (currentView === 'search-groups' || currentView === 'group-details' || currentView === 'contributions'));
        return (
          <button
            key={item.id}
            onClick={() => handleNav(item.id)}
            className="flex flex-col items-center justify-center flex-1 h-full relative cursor-pointer group py-1 transition-transform active:scale-95"
          >
            <div className={`p-1.5 rounded-2xl transition-all duration-300 relative flex items-center justify-center ${
              isActive
                ? 'text-primary bg-primary/15 font-bold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}>
              {item.icon}
              {isActive && (
                <motion.div
                  layoutId="activeNavTabIndicator"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-1 rounded-full bg-primary glow-orange"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </div>
            <span className={`text-[10px] mt-0.5 tracking-tight transition-all duration-200 ${
              isActive
                ? 'text-primary font-black'
                : 'text-muted-foreground font-semibold'
            }`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
