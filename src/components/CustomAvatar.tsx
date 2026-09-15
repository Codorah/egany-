import React from 'react';
import { isEganyeAvatarId, getEganyeAvatarUrl } from './ui/EganyeAvatar';

export type AvatarConfig = string;

interface CustomAvatarProps {
  photoURL?: string | null;
  name?: string;
  className?: string;
  size?: number;
}

// Palettes de dégradés fintech chaudes et élégantes basées sur la charte Eganyé
const MONOGRAM_PALETTES = [
  { from: '#C96F4A', to: '#E5A93C', text: '#FFFFFF', border: '#B85C36' }, // Terracotta & Or
  { from: '#718A68', to: '#4F6C46', text: '#FFFFFF', border: '#3E5736' }, // Sauge & Forêt
  { from: '#D48B28', to: '#F0C05A', text: '#2D1F17', border: '#B57218' }, // Ocre Solaire
  { from: '#3D5072', to: '#6B82A8', text: '#FFFFFF', border: '#2C3B55' }, // Sahel Indigo
  { from: '#C25953', to: '#E07A5F', text: '#FFFFFF', border: '#A6413B' }, // Corail Épicé
  { from: '#2D1F17', to: '#694D3B', text: '#F8F0E4', border: '#1C130D' }, // Café Espresso
];

export function CustomAvatar({
  photoURL,
  name = 'Membre',
  className = '',
  size = 48,
}: CustomAvatarProps) {
  const cleanName = (name || 'Membre').trim();

  // 1. Avatar illustré Eganyé (choisi dans l'Atelier Avatar)
  if (isEganyeAvatarId(photoURL)) {
    return (
      <img
        src={getEganyeAvatarUrl(photoURL)}
        alt={cleanName}
        className={`rounded-full object-cover shadow-soft border-2 border-white/80 dark:border-border/80 select-none shrink-0 ${className}`}
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
        loading="lazy"
      />
    );
  }

  // 2. Si l'utilisateur a une vraie photo de profil (URL web, Supabase Storage ou data:)
  const isRealPhoto =
    photoURL &&
    (photoURL.startsWith('http') || photoURL.startsWith('data:') || photoURL.startsWith('blob:'));

  if (isRealPhoto) {
    return (
      <img
        src={photoURL}
        alt={cleanName}
        className={`rounded-full object-cover shadow-soft border-2 border-white/80 dark:border-border/80 select-none shrink-0 ${className}`}
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
        loading="lazy"
        onError={(e) => {
          // Fallback to monogram if photo fails to load
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  // 3. Monogramme Fintech Haute Couture (style WhatsApp / Apple / Wise)
  // Calcul déterministe de la palette à partir du nom
  const charCode = cleanName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const palette = MONOGRAM_PALETTES[charCode % MONOGRAM_PALETTES.length];

  // Extraction propre des initiales (jusqu'à 2 lettres majuscules)
  const words = cleanName.split(/\s+/).filter(Boolean);
  let initials = 'E';
  if (words.length >= 2) {
    initials = (words[0][0] + words[1][0]).toUpperCase();
  } else if (words.length === 1 && words[0].length >= 2) {
    initials = words[0].slice(0, 2).toUpperCase();
  } else if (words.length === 1) {
    initials = words[0][0].toUpperCase();
  }

  // Taille de police proportionnelle
  const fontSize = Math.max(11, Math.round(size * 0.40));

  return (
    <div
      className={`rounded-full shadow-soft flex items-center justify-center font-serif font-black select-none shrink-0 border border-white/30 dark:border-white/10 ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        background: `linear-gradient(135deg, ${palette.from}, ${palette.to})`,
        color: palette.text,
        fontSize,
      }}
      title={cleanName}
      aria-label={`Avatar de ${cleanName}`}
    >
      <span>{initials}</span>
    </div>
  );
}

export const DEFAULT_AVATAR = {
  skin: '#6F472B',
  role: 'member',
  primaryColor: '#C96F4A',
  background: '#F8F0E4',
};
