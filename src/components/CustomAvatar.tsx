import React from 'react';

export interface AvatarConfig {
  skin: string;
  role: 'commercante' | 'cadre' | 'etudiant' | 'artisan' | 'sage';
  primaryColor: string;
  background: string;
}

export const SKIN_PALETTE = [
  { name: 'Sable Doré', value: '#FCD34D' },
  { name: 'Miel', value: '#F59E0B' },
  { name: 'Bronze Doux', value: '#D97706' },
  { name: 'Chocolat Chaud', value: '#78350F' },
  { name: 'Ébène Éclatant', value: '#451A03' }
];

export const ROLES = [
  { id: 'commercante', name: 'Commerçante (Moussor)' },
  { id: 'cadre', name: 'Cadre / Bureau' },
  { id: 'etudiant', name: 'Jeune Dynamique' },
  { id: 'artisan', name: 'Artisan / Créateur' },
  { id: 'sage', name: 'Sage / Ancien' }
];

export const PRIMARY_COLORS = [
  { name: 'Indigo Sacré', value: '#1E3A8A' },
  { name: 'Sénégal Jaune', value: '#EAB308' },
  { name: 'Vert Forêt', value: '#15803D' },
  { name: 'Pourpre Égayé', value: '#A21CAF' },
  { name: 'Orange Épice', value: '#EA580C' },
  { name: 'Rouge Corail', value: '#DC2626' }
];

export const BACKGROUND_COLORS = [
  { name: 'Pêche Doux', value: '#FFE4E6' },
  { name: 'Menthe Fraîche', value: '#ECFDF5' },
  { name: 'Ciel Calme', value: '#EFF6FF' },
  { name: 'Lavande Douce', value: '#F5F3FF' },
  { name: 'Sable Fin', value: '#FEF3C7' },
  { name: 'Gris Ardoise', value: '#F1F5F9' }
];

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: SKIN_PALETTE[1].value,
  role: 'commercante',
  primaryColor: PRIMARY_COLORS[1].value,
  background: BACKGROUND_COLORS[0].value
};

interface CustomAvatarProps {
  config?: Partial<AvatarConfig> | string;
  className?: string;
  size?: number;
}

export function CustomAvatar({ config, className = '', size = 120 }: CustomAvatarProps) {
  let activeConfig = DEFAULT_AVATAR;
  if (config) {
    if (typeof config === 'string') {
      try {
        activeConfig = { ...DEFAULT_AVATAR, ...JSON.parse(config) };
      } catch (e) {
        activeConfig = getDeterministicConfig(config);
      }
    } else {
      activeConfig = { ...DEFAULT_AVATAR, ...config };
    }
  }

  const { skin, role, primaryColor, background } = activeConfig;

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={`rounded-full shadow-inner ${className}`}
      style={{ minWidth: size, minHeight: size }}
    >
      {/* Background */}
      <circle cx="100" cy="100" r="100" fill={background} />
      {/* Shadow */}
      <ellipse cx="100" cy="190" rx="60" ry="10" fill="rgba(0,0,0,0.06)" />

      {/* Base Face & Neck (Common to all) */}
      <rect x="90" y="115" width="20" height="35" rx="5" fill={skin} />
      <path d="M 90 115 Q 100 130 110 115" fill="rgba(0,0,0,0.12)" />
      <rect x="70" y="65" width="60" height="60" rx="26" fill={skin} />
      
      {/* Nose */}
      <path d="M 98 94 Q 100 103 103 102" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="2.5" strokeLinecap="round" />

      {/* Roles Specific */}
      {role === 'commercante' && (
        <g>
          {/* Moussor (Headwrap) */}
          <path d="M 68 62 C 60 40 80 20 100 20 C 120 20 140 40 132 62 Z" fill={primaryColor} />
          <path d="M 66 56 Q 100 35 134 50" fill="none" stroke="#FBBF24" strokeWidth="4" />
          <path d="M 66 42 Q 100 22 130 35" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="5" />
          <polygon points="90,30 110,30 105,42 95,42" fill="#FBBF24" />
          {/* Big Earrings */}
          <circle cx="66" cy="102" r="8" fill="none" stroke="#FBBF24" strokeWidth="3" />
          <circle cx="134" cy="102" r="8" fill="none" stroke="#FBBF24" strokeWidth="3" />
          {/* Happy Eyes */}
          <g stroke="#1F2937" strokeWidth="3" strokeLinecap="round" fill="none">
            <path d="M 80 95 Q 85 90 90 95" />
            <path d="M 110 95 Q 115 90 120 95" />
          </g>
          {/* Mouth */}
          <path d="M 88 110 Q 100 120 112 110" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" />
          {/* Traditional Dress */}
          <path d="M 40 145 C 40 145 60 135 100 135 C 140 135 160 145 160 145 L 175 200 H 25 L 40 145 Z" fill={primaryColor} />
          <path d="M 90 135 L 100 165 L 110 135 Z" fill="#FBBF24" />
        </g>
      )}

      {role === 'cadre' && (
        <g>
          {/* Clean Hair */}
          <path d="M 70 70 C 68 50 132 50 130 70 C 130 60 120 54 100 54 C 80 54 70 60 70 70 Z" fill="#111827" />
          {/* Curious Eyes */}
          <circle cx="85" cy="95" r="4" fill="#1F2937" />
          <circle cx="115" cy="95" r="4" fill="#1F2937" />
          {/* Mouth */}
          <path d="M 90 112 H 110" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />
          {/* Suit and Tie */}
          <path d="M 40 145 C 40 145 60 135 100 135 C 140 135 160 145 160 145 L 175 200 H 25 L 40 145 Z" fill="#1F2937" />
          <path d="M 80 135 L 100 155 L 75 140 Z" fill="#FFFFFF" />
          <path d="M 120 135 L 100 155 L 125 140 Z" fill="#FFFFFF" />
          {/* Tie */}
          <path d="M 95 150 L 105 150 L 100 190 Z" fill={primaryColor} />
        </g>
      )}

      {role === 'etudiant' && (
        <g>
          {/* Dreads/Afro mix */}
          <circle cx="100" cy="55" r="28" fill="#111827" />
          <circle cx="78" cy="62" r="22" fill="#111827" />
          <circle cx="122" cy="62" r="22" fill="#111827" />
          {/* Cool Glasses */}
          <path d="M 72 90 H 128 L 125 102 C 120 106 112 106 108 100 L 100 95 L 92 100 C 88 106 80 106 75 102 Z" fill="#1F2937" />
          <rect x="74" y="91" width="4" height="2" fill="#FFFFFF" opacity="0.4" />
          <rect x="104" y="91" width="4" height="2" fill="#FFFFFF" opacity="0.4" />
          {/* Smile */}
          <path d="M 88 112 Q 100 118 112 112" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" />
          {/* Hoodie */}
          <path d="M 40 145 C 40 145 60 135 100 135 C 140 135 160 145 160 145 L 175 200 H 25 L 40 145 Z" fill={primaryColor} />
          <path d="M 80 135 Q 100 155 120 135" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="8" strokeLinecap="round" />
          <line x1="93" y1="145" x2="93" y2="168" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="107" y1="145" x2="107" y2="168" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}

      {role === 'artisan' && (
        <g>
          {/* Cap */}
          <path d="M 65 65 Q 100 40 135 65 Z" fill={primaryColor} />
          <path d="M 60 65 Q 100 50 140 65" fill="none" stroke={primaryColor} strokeWidth="6" strokeLinecap="round" />
          {/* Eyes */}
          <circle cx="85" cy="95" r="4" fill="#1F2937" />
          <circle cx="115" cy="95" r="4" fill="#1F2937" />
          <circle cx="86" cy="94" r="1" fill="#FFFFFF" />
          <circle cx="116" cy="94" r="1" fill="#FFFFFF" />
          {/* Mouth */}
          <path d="M 90 110 H 110" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />
          {/* Shirt + Apron */}
          <path d="M 40 145 C 40 145 60 135 100 135 C 140 135 160 145 160 145 L 175 200 H 25 L 40 145 Z" fill="#D1D5DB" />
          <path d="M 70 145 L 75 200 H 125 L 130 145 Z" fill={primaryColor} />
          <line x1="70" y1="145" x2="80" y2="135" stroke={primaryColor} strokeWidth="4" />
          <line x1="130" y1="145" x2="120" y2="135" stroke={primaryColor} strokeWidth="4" />
        </g>
      )}

      {role === 'sage' && (
        <g>
          {/* Kufi/Cap */}
          <path d="M 70 65 Q 100 35 130 65 Z" fill={primaryColor} />
          <path d="M 70 60 Q 100 55 130 60" fill="none" stroke="#FBBF24" strokeWidth="2" />
          {/* White Beard */}
          <path d="M 70 100 Q 100 140 130 100 Q 120 150 100 160 Q 80 150 70 100 Z" fill="#F3F4F6" />
          {/* Calm Eyes */}
          <path d="M 78 95 Q 85 92 92 95" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 108 95 Q 115 92 122 95" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />
          {/* Boubou */}
          <path d="M 40 150 C 40 150 60 140 100 140 C 140 140 160 150 160 150 L 175 200 H 25 L 40 150 Z" fill="#FFFFFF" />
          <path d="M 90 140 L 100 170 L 110 140 Z" fill={primaryColor} />
        </g>
      )}
    </svg>
  );
}

export function getDeterministicConfig(seed: string): AvatarConfig {
  const hashString = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };

  const code = hashString(seed || 'egayne-default');

  const skin = SKIN_PALETTE[code % SKIN_PALETTE.length].value;
  const roleList: AvatarConfig['role'][] = ['commercante', 'cadre', 'etudiant', 'artisan', 'sage'];
  const role = roleList[(code >> 1) % roleList.length];
  const primaryColor = PRIMARY_COLORS[(code >> 2) % PRIMARY_COLORS.length].value;
  const background = BACKGROUND_COLORS[(code >> 3) % BACKGROUND_COLORS.length].value;

  return { skin, role, primaryColor, background };
}
