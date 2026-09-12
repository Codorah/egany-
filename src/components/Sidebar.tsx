import React from 'react';
import { LayoutDashboard, Users, Bell, Landmark, User, CalendarDays, Store, Bot, ShieldCheck } from 'lucide-react';
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

  const primaryItems = [
    { id: 'dashboard', label: t('nav_home'), icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'my-circles', label: t('nav_circles'), icon: <Users className="w-5 h-5" /> },
    { id: 'activity', label: t('nav_activity'), icon: <Bell className="w-5 h-5" /> },
    { id: 'my-bank', label: t('my_bank'), icon: <Landmark className="w-5 h-5" /> },
    { id: 'profile', label: t('profile'), icon: <User className="w-5 h-5" /> },
  ];

  const secondaryItems = [
    { id: 'calendar', label: t('calendar'), icon: <CalendarDays className="w-5 h-5" /> },
    { id: 'marketplace', label: t('marketplace'), icon: <Store className="w-5 h-5" /> },
    { id: 'ai-assistant', label: t('ai_assistant'), icon: <Bot className="w-5 h-5" /> },
  ];

  if (user?.role === 'admin') {
    secondaryItems.push({ id: 'admin', label: t('admin_panel'), icon: <ShieldCheck className="w-5 h-5" /> });
  }

  const isActive = (id: string) => {
    if (id === 'my-circles') return ['my-circles', 'search-groups', 'group-details', 'cotiser', 'contributions'].includes(currentView);
    if (id === 'my-bank') return ['my-bank', 'wallet-savings', 'wallet-recharge', 'wallet-withdraw'].includes(currentView);
    return currentView === id;
  };

  const renderItem = (item: { id: string; label: string; icon: React.ReactNode }) => {
    const active = isActive(item.id);
    return (
      <button
        key={item.id}
        onClick={() => handleNav(item.id)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 font-bold text-sm cursor-pointer ${
          active
            ? 'bg-brand/10 text-brand'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        {item.icon}
        {item.label}
        {active && (
          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand" />
        )}
      </button>
    );
  };

  return (
    <div className="hidden md:flex flex-col w-64 h-screen border-r border-border bg-card fixed left-0 top-0 z-40 pt-16">
      <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
        {primaryItems.map(renderItem)}

        <div className="pt-4 mt-3 border-t border-border/70 space-y-1">
          {secondaryItems.map(renderItem)}
        </div>
      </div>

      {/* Decorative background blob for sidebar */}
      <div className="absolute bottom-[-10%] left-[-20%] w-[120%] h-[30%] bg-brand/5 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
}
