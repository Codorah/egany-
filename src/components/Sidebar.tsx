import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { EganyeIcon, type EganyeIconName } from '@/components/ui/EganyeIcon';

interface SidebarProps {
  user?: {
    uid: string;
    displayName: string;
    role?: string;
  };
  currentView?: string;
  onNavigate?: (view: string) => void;
}

interface Item {
  id: string;
  label: string;
  icon: EganyeIconName;
}

export function Sidebar({ user, currentView = 'dashboard', onNavigate }: SidebarProps) {
  const { t } = useLanguage();

  if (!user) return null;

  const primaryItems: Item[] = [
    { id: 'dashboard', label: t('nav_home'), icon: 'home' },
    { id: 'my-circles', label: t('nav_circles'), icon: 'circle' },
    { id: 'ai-assistant', label: t('nav_assistant'), icon: 'sparkle' },
    { id: 'my-bank', label: t('my_bank'), icon: 'vault' },
    { id: 'profile', label: t('profile'), icon: 'profile' },
  ];

  const secondaryItems: Item[] = [
    { id: 'activity', label: t('nav_activity'), icon: 'bell' },
    { id: 'calendar', label: t('calendar'), icon: 'calendar-finance' },
    { id: 'marketplace', label: t('marketplace'), icon: 'investment' },
  ];

  if (user.role === 'admin') {
    secondaryItems.push({ id: 'admin', label: t('admin_panel'), icon: 'shield' });
  }

  const isActive = (id: string) => {
    if (id === 'my-circles') return ['my-circles', 'search-groups', 'group-details', 'cotiser', 'contributions', 'join'].includes(currentView);
    if (id === 'my-bank') return ['my-bank', 'wallet-savings', 'wallet-recharge', 'wallet-withdraw'].includes(currentView);
    return currentView === id;
  };

  const renderItem = (item: Item) => {
    const active = isActive(item.id);
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onNavigate?.(item.id)}
        aria-current={active ? 'page' : undefined}
        className={`w-full h-11 flex items-center gap-3 px-3 rounded-xl transition-colors duration-150 font-semibold text-sm cursor-pointer ${
          active ? 'bg-muted text-primary-ink font-bold' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        <EganyeIcon name={item.icon} size={20} />
        {item.label}
      </button>
    );
  };

  return (
    <div className="hidden md:flex flex-col w-64 h-screen border-r border-border bg-card fixed left-0 top-0 z-40 pt-16">
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {primaryItems.map(renderItem)}
        <div className="pt-3 mt-3 border-t border-border space-y-1">
          {secondaryItems.map(renderItem)}
        </div>
      </div>
    </div>
  );
}
