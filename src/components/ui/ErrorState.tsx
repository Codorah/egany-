import React from 'react';
import { Button } from '@/components/ui/button';
import { EganyeIllustration, type EganyeIllustrationName } from './EganyeIllustration';
import { BrandVisual } from './BrandVisual';
import { EganyeIcon } from './EganyeIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  variant?: 'error' | 'offline' | 'server' | 'maintenance';
  fullScreen?: boolean;
  illustration?: EganyeIllustrationName;
}

/**
 * EganyeErrorState — Branded error display with illustrations.
 * All text is translated. Never shows raw technical errors to users.
 */
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel,
  variant = 'error',
  fullScreen = false,
  illustration,
}: ErrorStateProps) {
  const { t } = useLanguage();

  const config: Record<string, { ill: EganyeIllustrationName; title: string; desc: string }> = {
    error: {
      ill: 'server-error',
      title: t('error_title') || 'Un problème est survenu',
      desc: t('error_desc') || "Cette page n'a pas pu se charger. Réessayez dans un instant.",
    },
    offline: {
      ill: 'offline',
      title: t('offline_title') || 'Pas de connexion',
      desc: t('offline_desc') || 'Vérifiez votre connexion internet, puis réessayez.',
    },
    server: {
      ill: 'server-error',
      title: t('server_error_title') || 'Erreur serveur',
      desc: t('server_error_desc') || 'Nos serveurs rencontrent un problème. Réessayez dans un instant.',
    },
    maintenance: {
      ill: 'maintenance',
      title: t('maintenance_title') || 'Maintenance en cours',
      desc: t('maintenance_desc') || 'eganyé est temporairement indisponible. Revenez dans quelques instants.',
    },
  };

  const c = config[variant] || config.error;
  const illustrationName = illustration || c.ill;
  // Un appelant qui impose une illustration précise garde la main ; sinon on
  // sert le rendu de marque, plus incarné qu'un pictogramme sur un écran qui
  // annonce déjà une mauvaise nouvelle.
  const useBrandVisual = !illustration;
  const resolvedTitle = title || c.title;
  const resolvedDescription = description || c.desc;
  const resolvedRetryLabel = retryLabel || t('retry') || 'Réessayer';

  return (
    <div
      role="alert"
      className={
        (fullScreen ? 'h-screen w-screen' : 'w-full py-14') +
        ' flex flex-col items-center justify-center text-center px-6 gap-5 bg-background'
      }
    >
      {useBrandVisual ? (
        <BrandVisual name={variant === 'offline' ? 'error' : 'failed'} height={190} alt="" />
      ) : (
        <EganyeIllustration name={illustrationName} width={140} />
      )}

      <div className="space-y-1.5 max-w-xs">
        <h2 className="text-lg font-serif font-black text-foreground">{resolvedTitle}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{resolvedDescription}</p>
      </div>

      {onRetry && (
        <Button
          onClick={onRetry}
          className="btn-shine gradient-sunset text-white font-bold rounded-2xl h-12 px-6 flex items-center gap-2 cursor-pointer"
        >
          <EganyeIcon name="refresh" size={16} />
          {resolvedRetryLabel}
        </Button>
      )}
    </div>
  );
}
