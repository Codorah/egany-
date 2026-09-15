import React from 'react';

export type EganyeLogoVariant = 'mark' | 'full' | 'monochrome' | 'white';

interface EganyeLogoProps {
  variant?: EganyeLogoVariant;
  size?: number;
  className?: string;
  showText?: boolean;
}

/**
 * Official Eganye mark.
 *
 * A circular E monogram: the outer loop suggests the tontine rotation, the
 * three horizontal strokes form the E, and the gold dot is the shared payout.
 */
export function EganyeLogo({
  variant = 'mark',
  size = 40,
  className = '',
  showText = false,
}: EganyeLogoProps) {
  const isWhite = variant === 'white';
  const isMonochrome = variant === 'monochrome';

  const primary = isWhite || isMonochrome ? 'currentColor' : 'url(#eganyeLoop)';
  const olive = isWhite || isMonochrome ? 'currentColor' : '#718A68';
  const gold = isWhite ? '#FFE6A9' : isMonochrome ? 'currentColor' : '#C49A55';
  const paper = isWhite ? 'rgba(255,255,255,0.14)' : '#F8F0E4';
  const ring = isWhite ? 'rgba(255,255,255,0.36)' : '#EFE2D0';

  const markSvg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-label="Logo Eganye"
    >
      <defs>
        <linearGradient id="eganyeLoop" x1="10" y1="9" x2="55" y2="57" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C96F4A" />
          <stop offset="100%" stopColor="#A85638" />
        </linearGradient>
        <filter id="eganyeLogoShadow" x="-20%" y="-20%" width="140%" height="150%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#6C3A28" floodOpacity="0.14" />
        </filter>
      </defs>

      <circle cx="32" cy="32" r="29" fill={paper} />
      <circle cx="32" cy="32" r="27" stroke={ring} strokeWidth="2" />

      <g filter="url(#eganyeLogoShadow)">
        <path
          d="M47.8 13.8C42.6 9.7 35.2 8.1 28 9.6C17.2 11.9 10 21.2 10 32C10 44.7 19.8 55 32 55C39.5 55 46 51.4 50.1 45.9"
          stroke={primary}
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        <path
          d="M17.5 24.2H46.5"
          stroke={primary}
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        <path
          d="M17.5 32.8H40.5"
          stroke={olive}
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        <path
          d="M21.8 42.1H48"
          stroke={primary}
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        <circle cx="48" cy="32.8" r="7.4" fill={gold} stroke={isWhite ? '#FFFFFF' : '#FFFDFC'} strokeWidth="2.4" />
        <path
          d="M44.9 32.8h6.2"
          stroke={isWhite ? '#3E2F24' : '#FFFDFC'}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.9"
        />
      </g>
    </svg>
  );

  if (variant === 'full' || showText) {
    return (
      <div className={`inline-flex items-center gap-2.5 ${className}`}>
        {markSvg}
        <div className="flex flex-col select-none">
          <span
            className="font-black tracking-tight leading-none text-foreground"
            style={{ fontSize: Math.max(16, size * 0.52), letterSpacing: 0 }}
          >
            EGANYÉ
          </span>
          <span
            className="font-extrabold uppercase tracking-wider leading-tight text-[#C96F4A]"
            style={{ fontSize: Math.max(8, size * 0.2) }}
          >
            Tontine & Épargne
          </span>
        </div>
      </div>
    );
  }

  return markSvg;
}
