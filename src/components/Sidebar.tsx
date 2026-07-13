import React from 'react';
import { LayoutDashboard, CalendarDays, User, ShieldCheck, Store, Bot } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface SidebarProps {
  user?: {
    uid: string;
    displayName: string;
    role?: string;
  };
  currentView?: string;
  onNavigate?: (view: string) => void;
}

export function Sidebar({ user, currentView = 'dashboard', onNavigate }: SidebarProps) {
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
      label: t('dashboard'),
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: 'calendar',
      label: t('calendar'),
      icon: <CalendarDays className="w-5 h-5" />,
    },
    {
      id: 'marketplace',
      label: t('marketplace') || 'Services',
      icon: <Store className="w-5 h-5" />,
    },
    {
      id: 'ai-assistant',
      label: t('ai_assistant') || 'Copilote IA',
      icon: <Bot className="w-5 h-5" />,
    },
    {
      id: 'profile',
      label: t('profile'),
      icon: <User className="w-5 h-5" />,
    }
  ];

  if (user?.role === 'admin') {
    navItems.splice(4, 0, {
      id: 'admin',
      label: t('admin_panel') || 'Admin',
      icon: <ShieldCheck className="w-5 h-5" />,
    });
  }

  return (
    <div className="hidden md:flex flex-col w-64 h-screen border-r border-border bg-card fixed left-0 top-0 z-40 pt-16">
      <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
        <div className="mb-8 px-2">
          <h2 className="text-xs font-black uppercase text-muted-foreground tracking-wider mb-2">Navigation</h2>
        </div>
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 font-bold text-sm ${
                isActive 
                  ? 'bg-brand/10 text-brand' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {item.icon}
              {item.label}
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand" />
              )}
            </button>
          );
        })}
      </div>
      
      {/* Decorative background blob for sidebar */}
      <div className="absolute bottom-[-10%] left-[-20%] w-[120%] h-[30%] bg-brand/5 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
}
