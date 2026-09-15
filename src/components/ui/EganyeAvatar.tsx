import React from 'react';

export interface EganyeAvatarMeta {
  id: string;
  name: string;
  gender: 'female' | 'male';
  url: string;
}

export const EGANYE_AVATARS: EganyeAvatarMeta[] = [
  { id: 'avatar-01', name: 'Amina', gender: 'female', url: '/avatars/avatar-01.svg' },
  { id: 'avatar-02', name: 'Kofi', gender: 'male', url: '/avatars/avatar-02.svg' },
  { id: 'avatar-03', name: 'Fatou', gender: 'female', url: '/avatars/avatar-03.svg' },
  { id: 'avatar-04', name: 'Ibrahim', gender: 'male', url: '/avatars/avatar-04.svg' },
  { id: 'avatar-05', name: 'Awa', gender: 'female', url: '/avatars/avatar-05.svg' },
  { id: 'avatar-06', name: 'Moussa', gender: 'male', url: '/avatars/avatar-06.svg' },
  { id: 'avatar-07', name: 'Zainab', gender: 'female', url: '/avatars/avatar-07.svg' },
  { id: 'avatar-08', name: 'Kwame', gender: 'male', url: '/avatars/avatar-08.svg' },
  { id: 'avatar-09', name: 'Mariam', gender: 'female', url: '/avatars/avatar-09.svg' },
  { id: 'avatar-10', name: 'Tariq', gender: 'male', url: '/avatars/avatar-10.svg' },
  { id: 'avatar-11', name: 'Nia', gender: 'female', url: '/avatars/avatar-11.svg' },
  { id: 'avatar-12', name: 'Oumar', gender: 'male', url: '/avatars/avatar-12.svg' },
  { id: 'avatar-13', name: 'Yasmine', gender: 'female', url: '/avatars/avatar-13.svg' },
  { id: 'avatar-14', name: 'Sekou', gender: 'male', url: '/avatars/avatar-14.svg' },
  { id: 'avatar-15', name: 'Binta', gender: 'female', url: '/avatars/avatar-15.svg' },
  { id: 'avatar-16', name: 'Chidi', gender: 'male', url: '/avatars/avatar-16.svg' },
  { id: 'avatar-17', name: 'Halima', gender: 'female', url: '/avatars/avatar-17.svg' },
  { id: 'avatar-18', name: 'Bakary', gender: 'male', url: '/avatars/avatar-18.svg' },
  { id: 'avatar-19', name: 'Adama', gender: 'female', url: '/avatars/avatar-19.svg' },
  { id: 'avatar-20', name: 'Femi', gender: 'male', url: '/avatars/avatar-20.svg' },
  { id: 'avatar-21', name: 'Kadiatou', gender: 'female', url: '/avatars/avatar-21.svg' },
  { id: 'avatar-22', name: 'Malik', gender: 'male', url: '/avatars/avatar-22.svg' },
  { id: 'avatar-23', name: 'Sokhna', gender: 'female', url: '/avatars/avatar-23.svg' },
  { id: 'avatar-24', name: 'David', gender: 'male', url: '/avatars/avatar-24.svg' },
];

export function isEganyeAvatarId(val?: string | null): boolean {
  if (!val) return false;
  const clean = val.replace(/^eganye:/, '').replace(/^\/avatars\//, '').replace(/\.svg$/, '');
  return EGANYE_AVATARS.some((a) => a.id === clean);
}

export function getEganyeAvatarUrl(idOrUrl?: string | null): string {
  if (!idOrUrl) return EGANYE_AVATARS[0].url;
  const clean = idOrUrl.replace(/^eganye:/, '').replace(/^\/avatars\//, '').replace(/\.svg$/, '');
  const match = EGANYE_AVATARS.find((a) => a.id === clean);
  return match ? match.url : idOrUrl;
}

interface EganyeAvatarProps {
  id?: string;
  size?: number;
  className?: string;
  alt?: string;
}

export function EganyeAvatar({ id = 'avatar-01', size = 64, className = '', alt = 'Eganyé Avatar' }: EganyeAvatarProps) {
  const url = getEganyeAvatarUrl(id);

  return (
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full object-cover select-none shrink-0 ${className}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
      loading="lazy"
    />
  );
}
