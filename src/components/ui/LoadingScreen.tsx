import React from 'react';

interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
}

/**
 * Branded loading indicator. Renders a static logo inside an animated ring
 * instead of spinning the logo image itself — the illustration has baked-in
 * shading/perspective that breaks visually when rotated.
 */
export function LoadingScreen({ message = 'Chargement…', fullScreen = true }: LoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        (fullScreen
          ? 'h-screen w-screen'
          : 'w-full py-16') +
        ' flex flex-col items-center justify-center bg-background px-6 gap-5'
      }
    >
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg
          className="absolute inset-0 w-full h-full motion-safe:animate-spin"
          style={{ animationDuration: '1.1s' }}
          viewBox="0 0 64 64"
          fill="none"
        >
          <circle cx="32" cy="32" r="27" stroke="currentColor" strokeWidth="5" className="text-border" />
          <path d="M32 5a27 27 0 0 1 27 27" stroke="url(#loadingScreenGradient)" strokeWidth="5" strokeLinecap="round" />
          <defs>
            <linearGradient id="loadingScreenGradient" x1="5" y1="5" x2="59" y2="59">
              <stop offset="0%" stopColor="#C15B2A" />
              <stop offset="100%" stopColor="#A44A1F" />
            </linearGradient>
          </defs>
        </svg>
        <img src="/logo-mark.png" alt="" className="w-8 h-8 object-contain" />
      </div>
      <p className="text-sm font-bold text-muted-foreground tracking-wide">{message}</p>
    </div>
  );
}
