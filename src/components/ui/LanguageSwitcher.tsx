import React from 'react';
import { LanguageCode } from '@/contexts/LanguageContext';

const LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'wo', label: 'WO' },
  { code: 'bm', label: 'BM' },
];

interface LanguageSwitcherProps {
  value: LanguageCode;
  onChange: (lang: LanguageCode) => void;
  variant?: 'pill' | 'grid';
  className?: string;
}

// Un seul composant pour les 3 endroits où le choix de langue apparaissait,
// jusqu'ici recopiés à la main avec un style légèrement différent à chaque fois
// (Onboarding étape 0, Onboarding formulaire, Profile > Paramètres).
export function LanguageSwitcher({ value, onChange, variant = 'grid', className = '' }: LanguageSwitcherProps) {
  if (variant === 'pill') {
    return (
      <div className={`flex gap-1 bg-muted p-1 rounded-full border border-border ${className}`}>
        {LANGUAGES.map(({ code, label }) => (
          <button
            key={code}
            type="button"
            onClick={() => onChange(code)}
            className={`h-8 text-xs rounded-full px-3 font-bold cursor-pointer transition-all ${
              value === code ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-4 gap-1 bg-muted p-1 rounded-xl ${className}`}>
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          onClick={() => onChange(code)}
          className={`text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer ${
            value === code ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
