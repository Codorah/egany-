import React from 'react';

/** Bloc gris qui pulse doucement — la brique de base des squelettes de
 * chargement. Toujours composé en une forme qui rappelle le vrai contenu,
 * jamais utilisé seul à la place d'un texte « Chargement... ». */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-muted ${className}`} />;
}
