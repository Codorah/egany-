import React from 'react';

export type EganyeLogoVariant = 'mark' | 'full' | 'monochrome' | 'white';

interface EganyeLogoProps {
  variant?: EganyeLogoVariant;
  size?: number;
  className?: string;
  showText?: boolean;
}

/**
 * Logo officiel Eganyé : la pièce.
 *
 * Deux fichiers pour une seule identité, parce qu'un rendu portant le mot
 * « eganyé » écrit à l'intérieur ne tient pas la petite taille — vérifié :
 * illisible à 16 px, limite à 32 px, net à partir de 48 px. En dessous du
 * seuil on sert la même pièce réduite à un « e », dessinée avec les couleurs
 * prélevées dans le rendu, plutôt qu'un logo qui part en bouillie.
 */
const FULL_COIN_MIN_SIZE = 48;

export function EganyeLogo({
  variant = 'mark',
  size = 40,
  className = '',
  showText = false,
}: EganyeLogoProps) {
  const src =
    size >= FULL_COIN_MIN_SIZE
      ? '/brand-visuals/logo-coin.webp'
      : '/brand-visuals/coin-mark.svg';

  const mark = (
    <img
      src={src}
      alt="Logo Eganyé"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`shrink-0 select-none object-contain ${className}`}
      draggable={false}
    />
  );

  if (variant === 'full' || showText) {
    return (
      <div className={`inline-flex items-center gap-2.5 ${className}`}>
        {mark}
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

  return mark;
}
