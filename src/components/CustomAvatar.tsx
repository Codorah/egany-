import React from 'react';

export interface AvatarConfig {
  skin: string;          // hex color
  hair: 'afro' | 'braids' | 'clean' | 'headwrap' | 'hijab' | 'dreads' | 'none';
  hairColor: string;     // hex color
  eyes: 'happy' | 'curious' | 'starry' | 'cool';
  clothing: 'hoodie' | 'traditional' | 'shirt';
  clothingColor: string; // hex color
  glasses: boolean;
  earrings: boolean;
  background: string;    // hex color
}

export const SKIN_PALETTE = [
  { name: 'Sable Doré', value: '#FCD34D' },
  { name: 'Miel', value: '#F59E0B' },
  { name: 'Bronze Doux', value: '#D97706' },
  { name: 'Chocolat Chaud', value: '#78350F' },
  { name: 'Ébène Éclatant', value: '#451A03' }
];

export const HAIR_TYPES = [
  { id: 'afro', name: 'Coupe Afro' },
  { id: 'braids', name: 'Tresses Africaines' },
  { id: 'dreads', name: 'Dreadlocks' },
  { id: 'headwrap', name: 'Moussor (Foulard)' },
  { id: 'hijab', name: 'Hijab Élégant' },
  { id: 'clean', name: 'Court / Rasé' },
  { id: 'none', name: 'Sans cheveux' }
];

export const HAIR_COLORS = [
  { name: 'Noir Profond', value: '#111827' },
  { name: 'Brun Intense', value: '#4B5563' },
  { name: 'Châtain Doré', value: '#B45309' },
  { name: 'Pourpre Royal', value: '#701A75' },
  { name: 'Blanc d\'Ancien', value: '#F3F4F6' }
];

export const EYE_TYPES = [
  { id: 'happy', name: 'Souriants' },
  { id: 'curious', name: 'Éveillés' },
  { id: 'starry', name: 'Étoilés' },
  { id: 'cool', name: 'Lunettes de Soleil' }
];

export const CLOTHING_TYPES = [
  { id: 'traditional', name: 'Bazin / Boubou' },
  { id: 'hoodie', name: 'Sweat à Capuche' },
  { id: 'shirt', name: 'Chemise Moderne' }
];

export const CLOTHING_COLORS = [
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
  hair: 'afro',
  hairColor: HAIR_COLORS[0].value,
  eyes: 'happy',
  clothing: 'traditional',
  clothingColor: CLOTHING_COLORS[0].value,
  glasses: false,
  earrings: true,
  background: BACKGROUND_COLORS[0].value
};

interface CustomAvatarProps {
  config?: Partial<AvatarConfig> | string; // Config object or stringified JSON
  className?: string;
  size?: number;
}

export function CustomAvatar({ config, className = '', size = 120 }: CustomAvatarProps) {
  // Parse config if it is stringified JSON
  let activeConfig = DEFAULT_AVATAR;
  if (config) {
    if (typeof config === 'string') {
      try {
        activeConfig = { ...DEFAULT_AVATAR, ...JSON.parse(config) };
      } catch (e) {
        // Fallback to deterministic generation based on seed string
        activeConfig = getDeterministicConfig(config);
      }
    } else {
      activeConfig = { ...DEFAULT_AVATAR, ...config };
    }
  }

  const {
    skin,
    hair,
    hairColor,
    eyes,
    clothing,
    clothingColor,
    glasses,
    earrings,
    background
  } = activeConfig;

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

      {/* Neck */}
      <rect x="90" y="115" width="20" height="35" rx="5" fill={skin} />
      <path d="M 90 115 Q 100 130 110 115" fill="rgba(0,0,0,0.12)" />

      {/* Ears */}
      <circle cx="68" cy="98" r="8" fill={skin} />
      <circle cx="132" cy="98" r="8" fill={skin} />

      {/* Earring Rings */}
      {earrings && (
        <>
          <circle cx="66" cy="102" r="6" fill="none" stroke="#FBBF24" strokeWidth="2.5" />
          <circle cx="134" cy="102" r="6" fill="none" stroke="#FBBF24" strokeWidth="2.5" />
        </>
      )}

      {/* Face Base */}
      <rect x="70" y="65" width="60" height="60" rx="26" fill={skin} />

      {/* Eyes styles */}
      {eyes === 'happy' && (
        <g stroke="#1F2937" strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M 80 95 Q 85 90 90 95" />
          <path d="M 110 95 Q 115 90 120 95" />
        </g>
      )}
      {eyes === 'curious' && (
        <g>
          <circle cx="85" cy="95" r="5" fill="#1F2937" />
          <circle cx="115" cy="95" r="5" fill="#1F2937" />
          <circle cx="86.5" cy="93.5" r="1.5" fill="#FFFFFF" />
          <circle cx="116.5" cy="93.5" r="1.5" fill="#FFFFFF" />
        </g>
      )}
      {eyes === 'starry' && (
        <g fill="#F59E0B">
          {/* Star Left */}
          <path d="M 85 88 L 87 93 L 92 93 L 88 96 L 90 101 L 85 98 L 80 101 L 82 96 L 78 93 L 83 93 Z" />
          {/* Star Right */}
          <path d="M 115 88 L 117 93 L 122 93 L 118 96 L 120 101 L 115 98 L 110 101 L 112 96 L 108 93 L 113 93 Z" />
        </g>
      )}
      {eyes === 'cool' && (
        <g fill="#1F2937" stroke="#111827" strokeWidth="1">
          {/* Sunglasses */}
          <path d="M 72 90 H 128 L 125 102 C 120 106 112 106 108 100 L 100 95 L 92 100 C 88 106 80 106 75 102 Z" />
          <rect x="74" y="91" width="4" height="2" fill="#FFFFFF" opacity="0.4" />
          <rect x="104" y="91" width="4" height="2" fill="#FFFFFF" opacity="0.4" />
        </g>
      )}

      {/* Nose */}
      <path d="M 98 94 Q 100 103 103 102" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="2.5" strokeLinecap="round" />

      {/* Mouth */}
      <path d="M 88 110 Q 100 120 112 110" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" />

      {/* Glasses (additional) */}
      {glasses && eyes !== 'cool' && (
        <g stroke="#1F2937" strokeWidth="3" fill="none">
          <circle cx="85" cy="95" r="11" />
          <circle cx="115" cy="95" r="11" />
          <line x1="96" y1="95" x2="104" y2="95" />
          <path d="M 68 95 L 74 95" />
          <path d="M 126 95 L 132 95" />
        </g>
      )}

      {/* Clothing */}
      {clothing === 'traditional' && (
        <g>
          {/* Traditional Boubou with nice embroidery pattern */}
          <path d="M 40 145 C 40 145 60 135 100 135 C 140 135 160 145 160 145 L 175 200 H 25 L 40 145 Z" fill={clothingColor} />
          {/* Golden pattern / embroidery */}
          <path d="M 90 135 L 100 165 L 110 135 Z" fill="#FBBF24" />
          <circle cx="100" cy="150" r="4" fill="#D97706" />
          <circle cx="100" cy="162" r="3" fill="#D97706" />
          <path d="M 75 140 Q 100 146 125 140" fill="none" stroke="#FBBF24" strokeWidth="2" />
        </g>
      )}
      {clothing === 'hoodie' && (
        <g>
          <path d="M 40 145 C 40 145 60 135 100 135 C 140 135 160 145 160 145 L 175 200 H 25 L 40 145 Z" fill={clothingColor} />
          {/* Hoodie strings & hood overlay */}
          <path d="M 80 135 Q 100 155 120 135" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="8" strokeLinecap="round" />
          <line x1="93" y1="145" x2="93" y2="168" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="107" y1="145" x2="107" y2="168" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="93" cy="168" r="2.5" fill="#FFFFFF" />
          <circle cx="107" cy="168" r="2.5" fill="#FFFFFF" />
        </g>
      )}
      {clothing === 'shirt' && (
        <g>
          <path d="M 40 145 C 40 145 60 135 100 135 C 140 135 160 145 160 145 L 175 200 H 25 L 40 145 Z" fill={clothingColor} />
          {/* Shirt collar */}
          <path d="M 80 135 L 100 155 L 75 140 Z" fill="#FFFFFF" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
          <path d="M 120 135 L 100 155 L 125 140 Z" fill="#FFFFFF" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
          {/* Tie or buttons */}
          <line x1="100" y1="155" x2="100" y2="200" stroke="rgba(0,0,0,0.15)" strokeWidth="2" />
          <circle cx="100" cy="165" r="2" fill="#1F2937" />
          <circle cx="100" cy="177" r="2" fill="#1F2937" />
          <circle cx="100" cy="189" r="2" fill="#1F2937" />
        </g>
      )}

      {/* Hair Styles */}
      {hair === 'afro' && (
        <g fill={hairColor}>
          <circle cx="100" cy="52" r="30" />
          <circle cx="78" cy="62" r="25" />
          <circle cx="122" cy="62" r="25" />
          <circle cx="68" cy="80" r="18" />
          <circle cx="132" cy="80" r="18" />
        </g>
      )}
      {hair === 'braids' && (
        <g stroke={hairColor} strokeWidth="6" strokeLinecap="round" fill="none">
          {/* Braids cascading */}
          <path d="M 75 50 Q 55 60 52 105" />
          <path d="M 85 45 Q 60 55 58 115" />
          <path d="M 100 42 Q 100 70 95 120" />
          <path d="M 115 45 Q 140 55 142 115" />
          <path d="M 125 50 Q 145 60 148 105" />
          {/* Base crown hair layer */}
          <ellipse cx="100" cy="58" rx="30" ry="15" fill={hairColor} stroke="none" />
        </g>
      )}
      {hair === 'dreads' && (
        <g stroke={hairColor} strokeWidth="8" strokeLinecap="round" fill="none">
          {/* Dreadlocks styled locks */}
          <path d="M 70 55 C 50 65 45 95 48 135" />
          <path d="M 80 50 C 60 70 58 110 56 142" />
          <path d="M 90 45 C 80 75 84 110 82 145" />
          <path d="M 110 45 C 120 75 116 110 118 145" />
          <path d="M 120 50 C 140 70 142 110 144 142" />
          <path d="M 130 55 C 150 65 155 95 152 135" />
          {/* Base crown */}
          <ellipse cx="100" cy="58" rx="28" ry="12" fill={hairColor} stroke="none" />
        </g>
      )}
      {hair === 'headwrap' && (
        <g>
          {/* Turban Moussor styling */}
          <path d="M 68 62 C 60 40 80 20 100 20 C 120 20 140 40 132 62 Z" fill={clothingColor} />
          {/* Wrap layers */}
          <path d="M 66 56 Q 100 35 134 50" fill="none" stroke="#FBBF24" strokeWidth="4" />
          <path d="M 66 42 Q 100 22 130 35" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="5" />
          {/* Central bow/pin */}
          <polygon points="90,30 110,30 105,42 95,42" fill="#FBBF24" />
          <circle cx="100" cy="36" r="4" fill="#DC2626" />
        </g>
      )}
      {hair === 'hijab' && (
        <g fill={clothingColor}>
          {/* Under cap */}
          <path d="M 72 65 C 72 45 128 45 128 65 Z" fill="#FBBF24" />
          {/* Outer drape */}
          <path d="M 64 68 C 64 40 136 40 136 68 C 136 90 145 138 128 152 C 112 165 88 165 72 152 C 55 138 64 90 64 68 Z" fill={clothingColor} opacity="0.95" />
          {/* Face opening cutout (re-draws face on top of hijab background back-side) */}
          <rect x="74" y="65" width="52" height="52" rx="24" fill={skin} />
          {/* Inner shade */}
          <path d="M 74 65 C 74 58 126 58 126 65 Q 126 80 120 75 Q 100 68 80 75 Q 74 80 74 65" fill="rgba(0,0,0,0.1)" />
          {/* Fold lines */}
          <path d="M 64 68 Q 100 55 136 68" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
          <path d="M 72 120 Q 100 135 128 120" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="3" />
        </g>
      )}
      {hair === 'clean' && (
        <g fill={hairColor}>
          {/* Simple cropped fade hair */}
          <path d="M 70 70 C 68 50 132 50 130 70 C 130 60 120 54 100 54 C 80 54 70 60 70 70 Z" />
        </g>
      )}
    </svg>
  );
}

// Generate an activeConfig deterministically from a user's UID or username seed string
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
  const hairList: AvatarConfig['hair'][] = ['afro', 'braids', 'clean', 'headwrap', 'hijab', 'dreads'];
  const hair = hairList[(code >> 1) % hairList.length];
  const hairColor = HAIR_COLORS[(code >> 2) % HAIR_COLORS.length].value;
  const eyeList: AvatarConfig['eyes'][] = ['happy', 'curious', 'starry', 'cool'];
  const eyes = eyeList[(code >> 3) % eyeList.length];
  const clothingList: AvatarConfig['clothing'][] = ['hoodie', 'traditional', 'shirt'];
  const clothing = clothingList[(code >> 4) % clothingList.length];
  const clothingColor = CLOTHING_COLORS[(code >> 5) % CLOTHING_COLORS.length].value;
  const glasses = ((code >> 6) % 3) === 0;
  const earrings = ((code >> 7) % 2) === 0;
  const background = BACKGROUND_COLORS[(code >> 8) % BACKGROUND_COLORS.length].value;

  return {
    skin,
    hair,
    hairColor,
    eyes,
    clothing,
    clothingColor,
    glasses,
    earrings,
    background
  };
}
