import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

/** Barre d'un écran de détail : retour, titre, une action au plus. */
export function ScreenBar({ title, onBack, action }: { title: string; onBack: () => void; action?: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-11 items-center gap-1 -ml-2.5">
      <button
        type="button"
        onClick={onBack}
        aria-label={t('a11y_back')}
        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors duration-150 hover:bg-muted active:bg-muted"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-foreground">{title}</h1>
      {action}
    </div>
  );
}
