import React from 'react';
import { EganyeIcon, type EganyeIconName } from './EganyeIcon';
import { AmountDisplay } from './AmountDisplay';
import { StatusBadge } from './StatusBadge';

/**
 * ═══════════════════════════════════════════════════════════════
 * EGANYÉ DESIGN SYSTEM — COMPOSANTS REUTILISABLES
 * ═══════════════════════════════════════════════════════════════
 * Couleurs officielles :
 * - Terracotta: #C96F4A (accent primaire chaud)
 * - Vert Olive: #718A68 (croissance, tontine, confiance)
 * - Brun Café:  #3E2F24 (typographie principale, ancrage)
 * - Crème:      #F8F0E4 (fonds chaleureux)
 * - Beige doux: #EFE2D0 (bordures douces)
 */

/* ── 1. EganyeButton ── */
export interface EganyeButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'white';
  size?: 'sm' | 'md' | 'lg';
  icon?: EganyeIconName;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
}

export const EganyeButton = React.forwardRef<HTMLButtonElement, EganyeButtonProps>(
  ({ variant = 'primary', size = 'md', icon, iconPosition = 'left', loading, children, className = '', disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-bold tracking-tight rounded-2xl transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none';

    const sizeStyles = {
      sm: 'h-9 px-3.5 text-xs gap-1.5',
      md: 'h-11 px-5 text-sm gap-2',
      lg: 'h-13 px-6 text-base gap-2.5',
    }[size];

    const variantStyles = {
      primary: 'btn-shine gradient-sunset text-white shadow-soft',
      secondary: 'bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-soft',
      outline: 'border-2 border-[#EFE2D0] dark:border-border text-foreground hover:bg-muted/50',
      ghost: 'text-foreground hover:bg-muted/60',
      white: 'bg-white text-[#C96F4A] hover:bg-white/90 shadow-soft',
    }[variant];

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {loading ? (
          <EganyeIcon name="refresh" size={size === 'sm' ? 14 : 16} className="animate-spin" />
        ) : (
          <>
            {icon && iconPosition === 'left' && <EganyeIcon name={icon} size={size === 'sm' ? 14 : 16} />}
            {children}
            {icon && iconPosition === 'right' && <EganyeIcon name={icon} size={size === 'sm' ? 14 : 16} />}
          </>
        )}
      </button>
    );
  }
);
EganyeButton.displayName = 'EganyeButton';

/* ── 2. EganyeCard ── */
export interface EganyeCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'white' | 'cream' | 'sunset' | 'glass';
  interactive?: boolean;
}

export function EganyeCard({ variant = 'white', interactive = false, children, className = '', ...props }: EganyeCardProps) {
  const variantStyles = {
    white: 'bg-white dark:bg-card border border-[#EFE2D0] dark:border-border/80 shadow-soft text-foreground',
    cream: 'bg-[#FDFBF7] dark:bg-card border border-[#EFE2D0] dark:border-border/80 shadow-soft text-foreground',
    sunset: 'gradient-sunset-hero text-white shadow-soft relative overflow-hidden',
    glass: 'bg-card/80 backdrop-blur-md border border-border/80 shadow-soft text-foreground',
  }[variant];

  const interactiveStyles = interactive
    ? 'cursor-pointer transition-all hover:border-[#C96F4A]/40 active:scale-[0.99]'
    : '';

  return (
    <div className={`rounded-3xl p-5 ${variantStyles} ${interactiveStyles} ${className}`} {...props}>
      {children}
    </div>
  );
}

/* ── 3. EganyeHeader ── */
export interface EganyeHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EganyeHeader({ title, subtitle, action, className = '' }: EganyeHeaderProps) {
  return (
    <div className={`flex items-center justify-between gap-3 pt-1 ${className}`}>
      <div className="space-y-0.5 min-w-0 flex-1">
        <h1 className="text-2xl sm:text-3xl font-serif font-black text-foreground tracking-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-muted-foreground font-medium line-clamp-1">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ── 4. EganyeSection ── */
export interface EganyeSectionProps {
  title: string;
  actionText?: string;
  onAction?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function EganyeSection({ title, actionText, onAction, children, className = '' }: EganyeSectionProps) {
  return (
    <section className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="font-serif font-black text-base sm:text-lg text-foreground tracking-tight">
          {title}
        </h2>
        {actionText && (
          <button
            type="button"
            onClick={onAction}
            className="text-xs font-bold text-[#C96F4A] hover:opacity-80 transition-opacity flex items-center gap-0.5 cursor-pointer"
          >
            <span>{actionText}</span>
            <EganyeIcon name="chevron-right" size={13} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/* ── 5. Re-exports & Aliases for Consistency ── */
export { AmountDisplay as EganyeAmount } from './AmountDisplay';
export { StatusBadge as EganyeBadge } from './StatusBadge';
export { EganyeAvatar } from './EganyeAvatar';
export { EganyeIcon } from './EganyeIcon';
export { EganyeIllustration } from './EganyeIllustration';
export { EganyeProgress } from './EganyeProgress';
export { EmptyState as EganyeEmptyState } from './EmptyState';
export { ErrorState as EganyeErrorState } from './ErrorState';
export { SuccessState as EganyeSuccessState } from './SuccessState';
export { Skeleton as EganyeSkeleton } from './Skeleton';
export { EganyeTimeline } from './EganyeTimeline';
