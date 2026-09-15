import React from 'react';
import { EganyeLogo } from './EganyeLogo';
import { EganyeMascot } from './EganyeMascot';

interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
  withMascot?: boolean;
}

/**
 * Écran de chargement officiel Eganyé
 * Affiche soit le nouveau logo officiel avec pulsation douce,
 * soit la mascotte Ganyé en pleine action de lévitation monétaire.
 */
export function LoadingScreen({
  message = 'Chargement de vos finances...',
  fullScreen = true,
  withMascot = false,
}: LoadingScreenProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 ${
        fullScreen ? 'h-screen w-screen bg-background' : 'py-12'
      }`}
    >
      {withMascot ? (
        <EganyeMascot variant="loading" size={90} />
      ) : (
        <div className="animate-logo-appear relative">
          <EganyeLogo size={60} />
          {/* Anneau d'aura lumineuse */}
          <div className="absolute -inset-2 rounded-full border border-[#C96F4A]/25 animate-ping" />
        </div>
      )}

      {/* Indicateur de chargement en 3 points chauds */}
      <div className="flex items-center gap-1.5 pt-1">
        <div className="w-2 h-2 rounded-full bg-[#C96F4A] animate-pulse" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-[#E5A93C] animate-pulse" style={{ animationDelay: '200ms' }} />
        <div className="w-2 h-2 rounded-full bg-[#718A68] animate-pulse" style={{ animationDelay: '400ms' }} />
      </div>

      {message && (
        <p className="text-xs font-semibold text-muted-foreground animate-fade-in-up">
          {message}
        </p>
      )}
    </div>
  );
}
