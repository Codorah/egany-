import React from 'react';
import { motion } from 'motion/react';
import { LayoutDashboard, Users, User, ShieldCheck, PlusCircle, CalendarDays } from 'lucide-react';
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

  // Nav items configuration
  const navItems = [
    {
      id: 'dashboard',
      label: t('dashboard'),
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: 'calendar',
      label: t('calendar'),
      icon: <CalendarDays className="w-5 h-5" />,
    },
    {
      id: 'profile',
      label: t('profile'),
      icon: <User className="w-5 h-5" />,
    }
  ];

  // If user is admin, add admin tab
  if (user?.role === 'admin') {
    navItems.splice(1, 0, {
      id: 'admin',
      label: 'Admin',
      icon: <ShieldCheck className="w-5 h-5" />,
    });
  }

  // Position classes depending on simulated phone vs real mobile viewport
  const containerClasses = isSimulated
    ? "sticky bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex justify-around items-center px-4 z-40 shadow-[0_-4px_12px_rgba(75,46,5,0.06)]"
    : "fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex justify-around items-center px-4 z-40 shadow-[0_-4px_12px_rgba(75,46,5,0.06)] md:hidden";

  return (
    <div className={containerClasses}>
      {navItems.map((item) => {
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => handleNav(item.id)}
            className="flex flex-col items-center justify-center flex-1 h-full relative group cursor-pointer"
          >
            <div className={`p-1 rounded-xl transition-all duration-300 relative ${
              isActive
                ? 'text-brand scale-110'
                : 'text-ink-soft hover:text-brand'
            }`}>
              {item.icon}
              {isActive && (
                <motion.div
                  layoutId="activeBottomNavIndicator"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-brand"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </div>
            <span className={`text-[9px] font-bold mt-1 transition-all duration-300 ${
              isActive
                ? 'text-brand font-black'
                : 'text-ink-soft font-medium'
            }`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
