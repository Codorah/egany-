import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { fetchCircleHealth, type CircleHealthLevel } from '@/lib/reliability';

const LABEL: Record<CircleHealthLevel, string> = {
  low: 'Ce tour : risque de retard faible',
  medium: 'Ce tour : risque de retard moyen',
  high: 'Ce tour : risque de retard élevé',
};

/**
 * Estimation pour tout le cercle, sans score ni nom. Rien ne s'affiche sous 4 membres
 * avec un score : dans un petit cercle, on devinerait les personnes.
 */
export function CircleHealth({ groupId }: { groupId: string }) {
  const [level, setLevel] = useState<CircleHealthLevel | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLevel(null);
    fetchCircleHealth(groupId).then((result) => {
      if (!cancelled && result.status === 'ok') setLevel(result.level);
    });
    return () => { cancelled = true; };
  }, [groupId]);

  if (!level) return null;

  return (
    <p className="flex items-start gap-2 text-[13px] leading-snug text-foreground">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
      <span>
        {LABEL[level]}
        <span className="text-muted-foreground"> · estimation de l'IA d'eganyé</span>
      </span>
    </p>
  );
}
