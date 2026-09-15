import React from 'react';

export type EganyeLogoVariant = 'mark' | 'full' | 'monochrome' | 'white';

interface EganyeLogoProps {
  variant?: EganyeLogoVariant;
  size?: number;
  className?: string;
  showText?: boolean;
}

/**
 * Logo officiel de marque EGANYÉ
 * Symbolique :
 * 1. Monogramme "E" géométrique, fluide et moderne.
 * 2. Deux boucles entrelacées formant la circulation infinie de la tontine (l'argent qui tourne).
 * 3. Médaillon d'or solaire central symbolisant la prospérité et la pièce de monnaie africaine.
 */
export function EganyeLogo({
  variant = 'mark',
  size = 40,
  className = '',
  showText = false,
}: EganyeLogoProps) {
  const isWhite = variant === 'white';
  const isMonochrome = variant === 'monochrome';

  // Palette officielle
  const terracottaStart = isWhite ? '#FFFFFF' : isMonochrome ? 'currentColor' : '#C96F4A';
  const terracottaEnd = isWhite ? '#F0E6DD' : isMonochrome ? 'currentColor' : '#AB5837';
  const goldAccent = isWhite ? '#FFE29A' : isMonochrome ? 'currentColor' : '#E5A93C';

  const markSvg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-label="Logo Eganyé"
    >
      <defs>
        {/* Dégradé Terracotta Signature */}
        <linearGradient id="eganyeTerracotta" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={terracottaStart} />
          <stop offset="100%" stopColor={terracottaEnd} />
        </linearGradient>

        {/* Dégradé Or Solaire de Prospérité */}
        <linearGradient id="eganyeGold" x1="28" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F7C96E" />
          <stop offset="100%" stopColor={goldAccent} />
        </linearGradient>

        {/* Ombre portée douce */}
        <filter id="eganyeShadow" x="0" y="0" width="64" height="64" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#2D1F17" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* 1. Base : Dos courbé du E majuscule & boucle supérieure (Tontine Flow 1) */}
      <path
        d="M48 14C44 10 37 8 28 8C16 8 8 18 8 32C8 46 16 56 28 56C37 56 44 54 48 50"
        stroke="url(#eganyeTerracotta)"
        strokeWidth="6.5"
        strokeLinecap="round"
        filter="url(#eganyeShadow)"
      />

      {/* 2. Barre centrale dynamique du E fusionnée avec la circulation monétaire */}
      <path
        d="M12 32H38C44.6274 32 50 26.6274 50 20C50 13.3726 44.6274 8 38 8"
        stroke="url(#eganyeTerracotta)"
        strokeWidth="5.5"
        strokeLinecap="round"
      />

      {/* 3. Boucle inférieure complétant le circuit infini d'épargne mutuelle */}
      <path
        d="M26 32H40C46.6274 32 52 37.3726 52 44C52 50.6274 46.6274 56 40 56C34 56 30 52 28 48"
        stroke="url(#eganyeTerracotta)"
        strokeWidth="5.5"
        strokeLinecap="round"
      />

      {/* 4. Médaillon / Pièce d'or centrale étincelante (Eganyé = Mon Argent) */}
      <circle
        cx="35"
        cy="32"
        r="6.5"
        fill="url(#eganyeGold)"
        stroke={isWhite ? '#FFFFFF' : '#FFFDF9'}
        strokeWidth="2"
      />

      {/* Étincelle de prospérité au cœur de la pièce */}
      <circle cx="36.5" cy="30.5" r="1.8" fill="#FFFFFF" />
    </svg>
  );

  if (variant === 'full' || showText) {
    return (
      <div className={`inline-flex items-center gap-2.5 ${className}`}>
        {markSvg}
        <div className="flex flex-col select-none">
          <span
            className="font-serif font-black tracking-tight leading-none text-foreground"
            style={{ fontSize: Math.max(16, size * 0.52) }}
          >
            EGANYÉ
          </span>
          <span
            className="text-[9px] uppercase tracking-widest font-extrabold text-[#C96F4A] leading-tight"
            style={{ fontSize: Math.max(8, size * 0.22) }}
          >
            Tontine & Épargne
          </span>
        </div>
      </div>
    );
  }

  return markSvg;
}
