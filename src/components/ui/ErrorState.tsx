import React from 'react';
import { AlertTriangle, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  variant?: 'error' | 'offline';
  fullScreen?: boolean;
}

/**
 * Reusable error state for failed screens/data fetches. Always shows a
 * plain-language message — callers should log err.message to console.error,
 * never pass it through as `description` (see UX audit: raw Supabase/network
 * errors are unreadable for non-technical users).
 */
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = 'Réessayer',
  variant = 'error',
  fullScreen = false,
}: ErrorStateProps) {
  const isOffline = variant === 'offline';
  const Icon = isOffline ? WifiOff : AlertTriangle;
  const resolvedTitle = title || (isOffline ? 'Pas de connexion' : 'Un problème est survenu');
  const resolvedDescription =
    description ||
    (isOffline
      ? 'Vérifiez votre connexion internet, puis réessayez.'
      : "Cette page n'a pas pu se charger. Réessayez dans un instant.");

  return (
    <div
      role="alert"
      className={
        (fullScreen ? 'h-screen w-screen' : 'w-full py-14') +
        ' flex flex-col items-center justify-center text-center px-6 gap-4 bg-background'
      }
    >
      <div className="p-4 rounded-3xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
        <Icon className="w-8 h-8" />
      </div>
      <div className="space-y-1.5 max-w-xs">
        <h2 className="text-lg font-serif font-black text-foreground">{resolvedTitle}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{resolvedDescription}</p>
      </div>
      {onRetry && (
        <Button
          onClick={onRetry}
          className="gradient-sunset text-white font-bold rounded-2xl h-12 px-6 flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
