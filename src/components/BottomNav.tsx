import React from 'react';
import { motion } from 'motion/react';
import { EganyeIcon, type EganyeIconName } from '@/components/ui/EganyeIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface BottomNavProps {
  user?: {
    uid: string;
    displayName: string;
    role?: string;
    photoURL?: string;
  };
  currentView?: string;
  onNavigate?: (view: string) => void;
  isSimulated?: boolean;
}

/**
 * Navigation principale mobile Eganyé — Style Fintech Haute Couture.
 * Dispose d'un orbe dynamique animé (spring physics) qui glisse et enveloppe
 * l'onglet actif avec un dégradé chaleureux Terracotta / Or Solaire.
 * 5 piliers : Accueil | Cercle | Activités | Ma Banque | Profil
 */
export function BottomNav({
  user,
  currentView = 'dashboard',
  onNavigate,
  isSimulated = false,
}: BottomNavProps) {
  const { t } = useLanguage();

  if (!user) return null;

  const handleNav = (view: string) => {
    // Micro-haptic tactile feedback si disponible
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate?.(10);
      } catch {
        // Safe fallback
      }
    }
    onNavigate?.(view);
  };

  const isActive = (id: string) => {
    if (id === 'dashboard') return currentView === 'dashboard';
    if (id === 'my-circles') {
      return ['my-circles', 'search-groups', 'group-details', 'cotiser', 'contributions'].includes(currentView);
    }
    if (id === 'activity') return currentView === 'activity';
    if (id === 'my-bank') {
      return ['my-bank', 'wallet-savings', 'wallet-recharge', 'wallet-withdraw'].includes(currentView);
    }
    if (id === 'profile') return currentView === 'profile';
    return false;
  };

  const items: { id: string; label: string; icon: EganyeIconName }[] = [
    { id: 'dashboard', label: t('nav_home') || 'Accueil', icon: 'home' },
    { id: 'my-circles', label: t('nav_circles') || 'Cercle', icon: 'circle' },
    { id: 'activity', label: t('nav_activity') || 'Activités', icon: 'activity' },
    { id: 'my-bank', label: t('my_bank') || 'Ma Banque', icon: 'bank' },
    { id: 'profile', label: t('profile') || 'Profil', icon: 'profile' },
  ];

  const containerClasses = isSimulated
    ? 'sticky bottom-0 left-0 right-0 z-40'
    : 'fixed bottom-0 left-0 right-0 z-40 md:hidden';

  return (
    <nav
      className={containerClasses}
      role="navigation"
      aria-label="Navigation principale"
    >
      <div className="relative pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] px-3 bg-white/92 dark:bg-[#1C140F]/92 backdrop-blur-2xl border-t border-[#EFE2D0] dark:border-border/80 shadow-[0_-4px_24px_rgba(45,31,23,0.06)]">
        <div className="max-w-md mx-auto flex items-center justify-around relative">
          {items.map((item) => {
            const active = isActive(item.id);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                aria-current={active ? 'page' : undefined}
                className="relative flex-1 flex flex-col items-center justify-center py-1.5 px-1 cursor-pointer select-none group"
              >
                {/* ── ORBE ANIMÉ ACTIF (GLISSE AVEC SPRING PHYSICS) ── */}
                {active && (
                  <motion.div
                    layoutId="bottom-nav-active-pill"
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 32,
                    }}
                    className="absolute -top-1 w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#C96F4A] via-[#D95B30] to-[#E5A93C] shadow-[0_6px_20px_rgba(201,111,74,0.45)] z-0"
                  >
                    {/* Halo d'aura interne */}
                    <div className="absolute inset-0 rounded-2xl bg-white/15 animate-pulse" />
                  </motion.div>
                )}

                {/* ── ICÔNE AVEC REBOND TACTILE ── */}
                <div className="relative z-10 flex items-center justify-center w-9 h-9">
                  <motion.div
                    animate={{
                      scale: active ? 1.15 : 1,
                      y: active ? -2 : 0,
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="flex items-center justify-center"
                  >
                    <EganyeIcon
                      name={item.icon}
                      size={20}
                      className={`transition-colors duration-200 ${
                        active
                          ? 'text-white drop-shadow-xs'
                          : 'text-muted-foreground group-hover:text-[#C96F4A]'
                      }`}
                    />
                  </motion.div>
                </div>

                {/* ── LIBELLÉ TEXTUEL ── */}
                <motion.span
                  animate={{
                    opacity: active ? 1 : 0.8,
                    scale: active ? 1.05 : 0.95,
                  }}
                  className={`relative z-10 text-[10px] sm:text-[11px] font-sans tracking-tight mt-0.5 leading-none transition-colors duration-200 ${
                    active
                      ? 'font-black text-[#C96F4A] dark:text-[#E5A93C]'
                      : 'font-bold text-muted-foreground group-hover:text-foreground'
                  }`}
                >
                  {item.label}
                </motion.span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
