import React from 'react';
import { UserCircle, Settings, LogOut, LifeBuoy, Sun, Moon, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    walletBalance?: number;
  };
  onLogout?: () => void;
  onNavigate?: (view: string) => void;
}

export function Navbar({ user, onLogout, onNavigate }: NavbarProps) {
  const { t } = useLanguage();
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('eganye_theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      localStorage.setItem('eganye_theme', 'dark');
      setIsDark(true);
    }
  };

  return (
    <nav className="glass-nav sticky top-0 z-50 transition-all duration-300 border-b border-border/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand logo & title */}
        <div 
          className="flex items-center gap-2.5 cursor-pointer group select-none" 
          onClick={() => onNavigate?.('dashboard')}
        >
          <div className="w-9 h-9 rounded-xl gradient-sunset p-0.5 shadow-xs transition-transform duration-300 group-hover:scale-105 flex items-center justify-center">
            <div className="w-full h-full bg-background rounded-[10px] flex items-center justify-center">
              <span className="font-serif font-black text-lg text-primary">e</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-serif font-black tracking-tight text-foreground lowercase leading-none">
              eganyé
            </span>
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none mt-0.5">
              Tontine & Épargne
            </span>
          </div>
        </div>

        {/* Action Items */}
        <div className="flex items-center gap-3">
          {/* Quick theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Notifications */}
          {user && <NotificationBell userId={user.uid} />}

          {/* User Profile Dropdown */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button variant="ghost" className="relative h-10 w-10 rounded-full focus-visible:ring-0 p-0 overflow-hidden ring-2 ring-primary/20 hover:ring-primary/40 transition-all">
                  <div className="h-full w-full rounded-full overflow-hidden flex items-center justify-center bg-muted">
                    <CustomAvatar photoURL={user.photoURL} name={user.displayName} size={40} />
                  </div>
                </Button>
              } />
              <DropdownMenuContent className="w-60 rounded-2xl p-2 shadow-elevated border-border/80" align="end">
                <DropdownMenuLabel className="font-normal p-2 bg-muted/30 rounded-xl mb-1">
                  <div className="flex flex-col space-y-0.5">
                    <p className="text-sm font-bold text-foreground">{user.displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    {user.role === 'admin' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                        <Sparkles className="w-3 h-3" /> Administrateur
                      </span>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem onClick={() => onNavigate?.('profile')} className="rounded-xl cursor-pointer">
                  <UserCircle className="mr-2 h-4 w-4 text-primary" />
                  <span className="font-medium">{t('profile')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onNavigate?.('profile')} className="rounded-xl cursor-pointer">
                  <Settings className="mr-2 h-4 w-4 text-primary" />
                  <span className="font-medium">{t('settings')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onNavigate?.('support')} className="rounded-xl cursor-pointer">
                  <LifeBuoy className="mr-2 h-4 w-4 text-primary" />
                  <span className="font-medium">{t('support')}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem onClick={onLogout} className="rounded-xl cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span className="font-semibold">{t('logout')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button className="gradient-sunset text-white font-bold rounded-xl shadow-xs hover:opacity-95" onClick={() => onNavigate?.('dashboard')}>
              Se connecter
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
