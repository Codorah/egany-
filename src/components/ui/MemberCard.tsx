import React from 'react';
import { CustomAvatar } from '../CustomAvatar';

interface MemberCardProps {
  avatarUrl?: string;
  name: string;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}

/**
 * Ligne « personne » : avatar, nom, contexte, action. À placer dans une liste séparée
 * par des filets, sans cadre propre.
 */
export function MemberCard({ avatarUrl, name, subtitle, trailing, className = '' }: MemberCardProps) {
  return (
    <div className={`flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 ${className}`}>
      <div className="flex min-w-0 items-center gap-3">
        <CustomAvatar photoURL={avatarUrl} name={name} size={36} />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{name}</p>
          {subtitle && <div className="truncate text-[13px] text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-1.5">{trailing}</div>}
    </div>
  );
}
