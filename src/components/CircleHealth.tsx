import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { fetchCircleHealth, setAssistantLanguage, tr, type CircleHealthLevel } from '@/lib/reliability';
import { useLanguage } from '@/contexts/LanguageContext';

const label = (level: CircleHealthLevel) => ({
  low: tr('Ce tour : risque de retard faible', 'This round: low risk of delay'),
  medium: tr('Ce tour : risque de retard moyen', 'This round: medium risk of delay'),
  high: tr('Ce tour : risque de retard élevé', 'This round: high risk of delay'),
})[level];

/**
 * Estimation pour tout le cercle, sans score ni nom. Rien ne s'affiche sous 4 membres
 * avec un score : dans un petit cercle, on devinerait les personnes.
 */
export function CircleHealth({ groupId }: { groupId: string }) {
  const { language } = useLanguage();
  setAssistantLanguage(language);
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
        {label(level)}
        <span className="text-muted-foreground"> · {tr('estimation de l’IA d’eganyé', 'estimated by eganyé’s AI')}</span>
      </span>
    </p>
  );
}
