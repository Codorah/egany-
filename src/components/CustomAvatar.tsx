import React from 'react';

interface CustomAvatarProps {
  photoURL?: string;
  name?: string;
  className?: string;
  size?: number;
  config?: any;
}

export function CustomAvatar({ photoURL, name = 'User', className = '', size = 80 }: CustomAvatarProps) {
  const initial = (name.trim().charAt(0) || 'E').toUpperCase();

  // Vibrant gradient palette based on first character code
  const gradients = [
    'from-amber-500 to-orange-600',
    'from-emerald-500 to-teal-600',
    'from-blue-500 to-indigo-600',
    'from-purple-500 to-pink-600',
    'from-rose-500 to-red-600',
    'from-orange-500 to-amber-600'
  ];

  const charCode = name.charCodeAt(0) || 65;
  const selectedGradient = gradients[charCode % gradients.length];

  if (photoURL && photoURL.startsWith('http')) {
    return (
      <img
        src={photoURL}
        alt={name}
        className={`rounded-full object-cover shadow-soft border border-white/30 ${className}`}
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-gradient-to-br ${selectedGradient} text-white font-serif font-black flex items-center justify-center shadow-soft border border-white/30 select-none ${className}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size, fontSize: Math.max(size * 0.42, 14) }}
    >
      {initial}
    </div>
  );
}

export const DEFAULT_AVATAR = {
  skin: '#F59E0B',
  role: 'commercante',
  primaryColor: '#EA580C',
  background: '#FFE4E6'
};
