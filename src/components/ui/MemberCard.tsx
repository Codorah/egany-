import React from 'react';
import { CustomAvatar } from '../CustomAvatar';

interface MemberCardProps {
  avatarUrl?: string;
  name: string;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  tone?: 'default' | 'pending';
  className?: string;
}

/**
 * Ligne « personne » — avatar + nom + ligne de contexte + zone d'action —
 * réutilisée partout où l'app montre un membre : gestion des membres,
 * classement de fiabilité, appel de cotisation. Même design, où qu'elle
 * apparaisse (règle de cohérence).
 */
export function MemberCard({ avatarUrl, name, subtitle, trailing, tone = 'default', className = '' }: MemberCardProps) {
  return (
    <div
      className={`flex items-center justify-between gap-2 p-2.5 rounded-2xl border ${
        tone === 'pending' ? 'bg-brand/10 border-brand/20' : 'border-border/70 bg-card'
      } ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <CustomAvatar photoURL={avatarUrl} name={name} size={28} />
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{name}</p>
          {subtitle && <div className="text-[12px] text-muted-foreground truncate">{subtitle}</div>}
        </div>
      </div>
      {trailing && <div className="flex items-center gap-1.5 shrink-0">{trailing}</div>}
    </div>
  );
}
