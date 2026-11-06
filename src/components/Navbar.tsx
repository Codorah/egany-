import React from 'react';
import { Button } from '@/components/ui/button';
import { NotificationBell } from './NotificationBell';
import { CustomAvatar } from './CustomAvatar';
import { EganyeLogo } from '@/components/ui/EganyeLogo';
import { EganyeIcon } from '@/components/ui/EganyeIcon';
import { useNotifications } from '@/hooks/useNotifications';
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
  /** Titre de l'écran. */
  title?: string;
  /** Présent : affiche le retour. Absent : l'écran est un onglet racine. */
  onBack?: () => void;
  /** Le logo n'apparaît que sur l'accueil (sur ordinateur, il reste partout). */
  showLogo?: boolean;
  view?: string;
  onLogout?: () => void;
  onNavigate?: (view: string) => void;
}

// Wolof et Bambara masqués tant que leurs traductions ne sont pas prêtes
// (voir LanguageSwitcher.tsx) — la sélection retomberait sinon en français
// sur la quasi-totalité de l'appli sans aucun indice pour l'utilisateur.
const LANGUAGE_LABELS: { code: LanguageCode; label: string }[] = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'ee', label: 'Éwé' },
  { code: 'kbp', label: 'Kabiyè' },
];

/**
 * La barre unique de chaque écran : retour, titre, action, cloche.
 * Un écran peut y placer son action avec <TopBarAction>.
 */
export function Navbar({ user, title, onBack, showLogo, view, onLogout, onNavigate }: NavbarProps) {
  const { t, language, setLanguage } = useLanguage();
  const [isDark, setIsDark] = React.useState(false);
  const { unreadCount } = useNotifications(user?.uid);

  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    document.documentElement.classList.remove(isDark ? 'dark' : 'light');
    document.documentElement.classList.add(next);
    localStorage.setItem('eganye_theme', next);
    setIsDark(!isDark);
  };

  const iconButton = 'w-11 h-11 rounded-xl flex items-center justify-center text-foreground transition-colors duration-150 hover:bg-muted cursor-pointer shrink-0';

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border">
      <div className="h-14 px-2 md:px-6 flex items-center gap-1">
        {onBack && (
          <button type="button" onClick={onBack} className={iconButton} aria-label={t('gd_back')}>
            <EganyeIcon name="chevron-left" size={22} />
          </button>
        )}

        {showLogo && <EganyeLogo size={30} className="shrink-0 ml-2 mr-1.5" />}
        {!showLogo && <EganyeLogo size={30} className="hidden md:block shrink-0 mr-2" />}

        <h1 className={`flex-1 min-w-0 truncate text-lg font-bold text-foreground ${!onBack && !showLogo ? 'pl-2 md:pl-0' : ''}`}>
          {title}
        </h1>

        {/* Point d'accroche de l'action propre à l'écran (voir TopBarAction). */}
        <div id="top-bar-action" className="flex items-center shrink-0" />

        {/* Sur téléphone, le thème se règle depuis l'onglet Profil. */}
        {view === 'profile' && (
          <button
            type="button"
            onClick={toggleTheme}
            className={`${iconButton} md:hidden`}
            aria-label={isDark ? t('nav_theme_light') : t('nav_theme_dark')}
          >
            <EganyeIcon name={isDark ? 'sun' : 'moon'} size={20} />
          </button>
        )}

        {/* Langue et thème, ordinateur uniquement. */}
        <div className="hidden md:flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <button type="button" className={iconButton} aria-label={t('nav_switch_lang')}>
                <EganyeIcon name="language" size={20} />
              </button>
            } />
            <DropdownMenuContent className="w-44 rounded-2xl p-2 border-border" align="end">
              {LANGUAGE_LABELS.map(({ code, label }) => (
                <DropdownMenuItem
                  key={code}
                  onClick={() => setLanguage(code)}
                  className="rounded-xl cursor-pointer flex items-center justify-between"
                >
                  <span className={language === code ? 'text-primary-ink font-bold' : 'font-medium'}>{label}</span>
                  {language === code && <EganyeIcon name="check" size={14} className="text-primary-ink" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={toggleTheme}
            className={iconButton}
            aria-label={isDark ? t('nav_theme_light') : t('nav_theme_dark')}
          >
            <EganyeIcon name={isDark ? 'sun' : 'moon'} size={20} />
          </button>
        </div>

        {user && (
          <>
            {/* Téléphone : la cloche ouvre l'activité. */}
            <button
              type="button"
              onClick={() => onNavigate?.('activity')}
              className={`${iconButton} relative md:hidden`}
              aria-label={t('dash_notifications_aria')}
            >
              <EganyeIcon name="bell" size={22} />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 min-w-4 h-4 px-1 rounded-full bg-danger text-white text-[11px] font-bold leading-4 text-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Ordinateur : aperçu et menu du compte. */}
            <div className="hidden md:flex items-center gap-1">
              <NotificationBell userId={user.uid} />
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="ghost" className="h-11 w-11 rounded-full p-0 overflow-hidden" aria-label={t('profile')}>
                    <CustomAvatar photoURL={user.photoURL} name={user.displayName} size={36} />
                  </Button>
                } />
                <DropdownMenuContent className="w-64 rounded-2xl p-2 border-border" align="end">
                  <DropdownMenuLabel className="font-normal p-2.5 mb-1">
                    <p className="text-sm font-bold text-foreground">{user.displayName}</p>
                    <p className="text-[13px] text-muted-foreground truncate">{user.email}</p>
                    {user.role === 'admin' && (
                      <p className="text-[13px] font-bold text-secondary mt-1">{t('nav_admin_badge')}</p>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="my-1" />
                  {user.role === 'admin' && (
                    <DropdownMenuItem onClick={() => onNavigate?.('admin')} className="rounded-xl cursor-pointer">
                      <EganyeIcon name="shield" size={16} className="mr-2 text-muted-foreground" />
                      <span className="font-bold">{t('admin_panel')}</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onNavigate?.('profile')} className="rounded-xl cursor-pointer">
                    <EganyeIcon name="settings" size={16} className="mr-2 text-muted-foreground" />
                    <span className="font-medium">{t('profile')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onNavigate?.('support')} className="rounded-xl cursor-pointer">
                    <EganyeIcon name="support" size={16} className="mr-2 text-muted-foreground" />
                    <span className="font-medium">{t('support')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1" />
                  <DropdownMenuItem onClick={onLogout} className="rounded-xl cursor-pointer text-destructive focus:text-destructive">
                    <EganyeIcon name="logout" size={16} className="mr-2" />
                    <span className="font-semibold">{t('logout')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
