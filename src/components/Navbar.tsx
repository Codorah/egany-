import React from 'react';
import { UserCircle, LayoutDashboard, Users, Bell, Settings, LogOut, Shield } from 'lucide-react';
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
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate?.('dashboard')}>
          <div className="bg-[#2BB673] p-2 rounded-lg text-white">
            <Users className="w-5 h-5" />
          </div>
          <span className="text-xl font-serif font-extrabold tracking-wide text-[#4B2E05] lowercase">eganyé</span>
        </div>

        <div className="hidden md:flex items-center gap-6">
          <Button variant="ghost" className="flex items-center gap-2 font-bold" onClick={() => onNavigate?.('dashboard')}>
            <LayoutDashboard className="w-4 h-4" />
            {t('dashboard')}
          </Button>
          <Button variant="ghost" className="flex items-center gap-2 font-bold" onClick={() => onNavigate?.('dashboard')}>
            <Users className="w-4 h-4" />
            {t('active_circles')}
          </Button>
          {user && user.role === 'admin' && (
            <Button variant="ghost" className="flex items-center gap-2 text-amber-600 font-bold" onClick={() => onNavigate?.('admin')}>
              <Shield className="w-4 h-4" />
              {t('admin_panel')}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user && <NotificationBell userId={user.uid} />}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button variant="ghost" className="relative h-10 w-10 rounded-full focus-visible:ring-0">
                  <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-amber-500/30 flex items-center justify-center bg-slate-50">
                    {user.photoURL ? (
                      <CustomAvatar config={user.photoURL} size={40} />
                    ) : (
                      <div className="w-full h-full bg-amber-100 flex items-center justify-center font-bold text-amber-700">
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
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t('logout')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button className="bg-amber-500 text-slate-950 font-bold hover:bg-amber-600 rounded-xl" onClick={() => onNavigate?.('dashboard')}>Se connecter</Button>
          )}
        </div>
      </div>
    </nav>
  );
}

