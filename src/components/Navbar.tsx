import React from 'react';
import { UserCircle, Settings, LogOut, LifeBuoy, Sun, Moon, Sparkles, Languages, Check, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationBell } from './NotificationBell';
import { CustomAvatar } from './CustomAvatar';
import { useLanguage, LanguageCode } from '@/contexts/LanguageContext';
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

const LANGUAGE_LABELS: { code: LanguageCode; label: string }[] = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'ee', label: 'Éwé' },
  { code: 'kbp', label: 'Kabiyè' },
];

export function Navbar({ user, onLogout, onNavigate }: NavbarProps) {
  const { t, language, setLanguage } = useLanguage();
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
    <nav className="glass-nav sticky top-0 z-40 transition-all duration-300 border-b border-border/50 backdrop-blur-xl bg-background/80">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand logo & title */}
        <div 
          className="flex items-center gap-2 cursor-pointer group select-none" 
          onClick={() => onNavigate?.('dashboard')}
        >
          <img
            src="/icons/icon-128.png"
            alt="eganyé"
            className="w-8 h-8 rounded-xl shadow-xs shrink-0 transition-transform duration-300 group-hover:scale-105"
          />
          <div className="flex flex-col">
            <span className="text-lg font-serif font-black tracking-tight text-foreground lowercase leading-none">
              eganyé
            </span>
            <span className="text-[12px] font-bold text-brand uppercase tracking-wider leading-none mt-0.5 hidden sm:block">
              {t('nav_tagline')}
            </span>
          </div>
        </div>

        {/* Action Items */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Language switcher (desktop only) */}
          <div className="hidden md:block">
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <button
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  title={t('nav_switch_lang')}
                >
                  <Languages className="w-4 h-4" />
                </button>
              } />
              <DropdownMenuContent className="w-44 rounded-2xl p-2 shadow-elevated border-border/80" align="end">
                {LANGUAGE_LABELS.map(({ code, label }) => (
                  <DropdownMenuItem
                    key={code}
                    onClick={() => setLanguage(code)}
                    className="rounded-xl cursor-pointer flex items-center justify-between"
                  >
                    <span className={`font-medium ${language === code ? 'text-primary font-bold' : ''}`}>{label}</span>
                    {language === code && <Check className="w-3.5 h-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Quick theme toggle (desktop only) */}
          <button
            onClick={toggleTheme}
            className="hidden md:flex p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title={isDark ? t('nav_theme_light') : t('nav_theme_dark')}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Notifications */}
          {user && <NotificationBell userId={user.uid} />}

          {/* User Profile Dropdown */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button variant="ghost" className="relative h-9 w-9 rounded-full focus-visible:ring-0 p-0 overflow-hidden ring-2 ring-primary/20 hover:ring-primary/50 transition-all">
                  <div className="h-full w-full rounded-full overflow-hidden flex items-center justify-center bg-muted">
                    <CustomAvatar photoURL={user.photoURL} name={user.displayName} size={36} />
                  </div>
                </Button>
              } />
              <DropdownMenuContent className="w-64 rounded-2xl p-2 shadow-elevated border-border/80" align="end">
                <DropdownMenuLabel className="font-normal p-2.5 bg-muted/40 rounded-xl mb-1">
                  <div className="flex flex-col space-y-0.5">
                    <p className="text-sm font-bold text-foreground">{user.displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    {user.role === 'admin' && (
                      <span className="inline-flex items-center gap-1 text-[13px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                        <Sparkles className="w-3 h-3" /> {t('nav_admin_badge')}
                      </span>
                    )}
                  </div>
                </DropdownMenuLabel>
                
                {/* Mobile-only theme & lang toggles — le sélecteur de langue
                    complet est desktop-only, donc sans ces boutons une
                    utilisatrice sur téléphone ne peut plus changer de langue
                    après l'inscription (constat de l'audit UX). */}
                <div className="md:hidden py-1 border-b border-border/60 mb-1 space-y-0.5">
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between px-2.5 py-2.5 rounded-lg text-sm font-semibold text-foreground hover:bg-muted"
                  >
                    <span className="flex items-center gap-2">
                      {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
                      <span>{isDark ? t('nav_theme_light') : t('nav_theme_dark')}</span>
                    </span>
                  </button>

                  <div className="px-2.5 pt-1.5 pb-1">
                    <span className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
                      <Languages className="w-3.5 h-3.5" />
                      {t('prof_language_label')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 px-1 pb-1">
                    {LANGUAGE_LABELS.map(({ code, label }) => (
                      <button
                        key={code}
                        onClick={() => setLanguage(code)}
                        className={`flex items-center justify-center gap-1.5 h-11 rounded-lg text-sm font-bold transition-colors ${
                          language === code
                            ? 'bg-primary text-primary-foreground'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        {label}
                        {language === code && <Check className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                </div>

                <DropdownMenuSeparator className="my-1" />
                {(user.role === 'admin' || user.email === 'codorah@hotmail.com') && (
                  <DropdownMenuItem onClick={() => onNavigate?.('admin')} className="rounded-xl cursor-pointer">
                    <ShieldCheck className="mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-bold">{t('admin_panel') || 'Administration'}</span>
                  </DropdownMenuItem>
                )}
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
            <Button className="gradient-sunset text-white font-bold rounded-xl shadow-xs hover:opacity-95 text-xs h-9 px-3" onClick={() => onNavigate?.('dashboard')}>
              {t('nav_login')}
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
