import React from 'react';

/**
 * Visuels de marque 3D (rendus livrés dans public/brand-visuals).
 *
 * Distinct d'EganyeMascot, qui reste le système SVG léger pour les petits
 * emplacements inline : ceux-ci sont des rendus photoréalistes réservés aux
 * moments pleine page — connexion, inscription, chargement, erreur, succès.
 *
 * Les fichiers servis sont les versions recadrées et réencodées par
 * scripts/optimize-brand-visuals.mjs (les originaux pèsent ~12x plus lourd
 * et sont surtout composés de transparent).
 */

export type BrandVisualName =
  | 'welcome'
  | 'signup'
  | 'tablet'
  | 'error'
  | 'success'
  | 'failed'
  | 'logo-coin';

const FILES: Record<BrandVisualName, string> = {
  welcome: 'mascot-welcome',
  signup: 'mascot-signup',
  tablet: 'mascot-tablet',
  error: 'mascot-error',
  success: 'mascot-success',
  failed: 'mascot-failed',
  'logo-coin': 'logo-coin',
};

/**
 * Ces deux rendus ont un panneau clair incrusté par le moteur 3D : présentés
 * nus sur le fond crème, on voit un rectangle. Une carte blanche arrondie le
 * fait disparaître au lieu d'essayer de le détourer — ce qui mangerait la
 * chemise blanche du personnage.
 */
const NEEDS_CARD = new Set<BrandVisualName>(['success', 'failed']);

interface BrandVisualProps {
  name: BrandVisualName;
  /** Hauteur d'affichage en px. Les sources sont volontairement modestes. */
  height?: number;
  className?: string;
  alt?: string;
}

export function BrandVisual({ name, height = 180, className = '', alt = '' }: BrandVisualProps) {
  const image = (
    <img
      src={`/brand-visuals/${FILES[name]}.webp`}
      alt={alt}
      height={height}
      style={{ height }}
      className="block w-auto select-none object-contain"
      draggable={false}
      loading="lazy"
    />
  );

  if (NEEDS_CARD.has(name)) {
    return (
      <div className={`overflow-hidden rounded-3xl bg-white ${className}`}>{image}</div>
    );
  }

  return <div className={className}>{image}</div>;
}
