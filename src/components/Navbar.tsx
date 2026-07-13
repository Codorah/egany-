import React from 'react';
import { UserCircle, LayoutDashboard, Users, Bell, Settings, LogOut, Shield, LifeBuoy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NotificationBell } from './NotificationBell';
import { CustomAvatar } from './CustomAvatar';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavbarProps {
  user?: {
    uid: string;
    displayName: string;
    email: string;
    photoURL?: string;
    role?: string;
  };
  onLogout?: () => void;
  onNavigate?: (view: string) => void;
}

export function Navbar({ user, onLogout, onNavigate }: NavbarProps) {
  const { t } = useLanguage();

  return (
    <nav className="border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate?.('dashboard')}>
          <img src="/logo-emblem.png" alt="eganyé" className="w-7 h-7 rounded-lg" />
          <span className="text-xl font-serif font-extrabold tracking-wide text-brand lowercase md:hidden">eganyé</span>
        </div>

        <div className="hidden md:flex flex-1" />

        <div className="flex items-center gap-4">
          {user && <NotificationBell userId={user.uid} />}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button variant="ghost" className="relative h-10 w-10 rounded-full focus-visible:ring-0">
                  <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-brand/30 flex items-center justify-center bg-muted">
                    {user.photoURL ? (
                      <CustomAvatar config={user.photoURL} size={40} />
                    ) : (
                      <div className="w-full h-full bg-chip flex items-center justify-center font-bold text-brand-deep">
                        {user.displayName.charAt(0)}
                      </div>
                    )}
                  </div>
                </Button>
              } />
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.displayName}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onNavigate?.('profile')}>
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>{t('profile')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onNavigate?.('profile')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>{t('settings')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onNavigate?.('support')}>
                  <LifeBuoy className="mr-2 h-4 w-4" />
                  <span>{t('support')}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t('logout')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button className="bg-primary text-primary-foreground font-bold hover:bg-primary/90 rounded-xl" onClick={() => onNavigate?.('dashboard')}>Se connecter</Button>
          )}
        </div>
      </div>
    </nav>
  );
}

