import React, { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft } from 'lucide-react';
import { useBackHandler } from '@/hooks/useBackHandler';

interface FlowScreenProps {
  /** Flèche en haut à gauche et bouton retour Android. */
  onBack: () => void;
  /** Nom du service, au centre de la barre du haut. */
  title: string;
  /** Étape courante (1-based) et nombre d'étapes : affiche la progression. */
  step?: number;
  totalSteps?: number;
  /** Bandeau optionnel sous la barre du haut (couleur du service, icône…). */
  hero?: React.ReactNode;
  heading?: string;
  desc?: React.ReactNode;
  children?: React.ReactNode;
  /** Actions collées en bas de l'écran (Suivant, Envoyer…). */
  footer?: React.ReactNode;
}

/**
 * Écran plein d'un parcours mobile (Coup de pouce, crédit, services) : une
 * question par écran, la progression en haut, l'action principale toujours
 * sous le pouce en bas. Remplace les fenêtres modales, qui sur téléphone
 * empilaient tout le formulaire dans une boîte qui défile.
 *
 * Sur ordinateur, l'écran devient une carte centrée de la largeur d'un
 * téléphone, comme l'inscription.
 */
export function FlowScreen({ onBack, title, step, totalSteps, hero, heading, desc, children, footer }: FlowScreenProps) {
  const handleBack = useCallback(() => {
    onBack();
    return true;
  }, [onBack]);
  useBackHandler(handleBack, true);

  // La page derrière ne doit pas défiler sous l'écran.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const progress = step && totalSteps ? Math.min(100, Math.round((step / totalSteps) * 100)) : null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-background md:bg-muted/60 md:flex md:items-center md:justify-center md:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full h-full md:h-[min(820px,calc(100dvh-3rem))] md:max-w-[440px] md:rounded-[2rem] md:shadow-elevated bg-background flex flex-col overflow-hidden"
      >
        <header className="shrink-0 pt-[env(safe-area-inset-top)] bg-background/95 backdrop-blur-md border-b border-border/60">
          <div className="h-14 px-2 flex items-center gap-1">
            <button
              type="button"
              onClick={onBack}
              aria-label="Retour"
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-foreground hover:bg-muted cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <p className="flex-1 text-center text-[15px] font-bold text-foreground truncate">{title}</p>
            <div className="w-11 shrink-0 text-right pr-2 text-[12px] font-bold text-muted-foreground tabular-nums">
              {step && totalSteps ? `${step}/${totalSteps}` : ''}
            </div>
          </div>
          {progress !== null && (
            <div className="h-1 bg-muted">
              <div className="h-full gradient-sunset transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {hero}
          <div className="px-5 pt-6 pb-8 space-y-5">
            {(heading || desc) && (
              <div className="space-y-1.5">
                {heading && (
                  <h1 className="text-[24px] leading-tight font-serif font-bold text-foreground tracking-tight text-balance">{heading}</h1>
                )}
                {desc && <p className="text-[14px] leading-relaxed text-muted-foreground font-medium">{desc}</p>}
              </div>
            )}
            {children}
          </div>
        </div>

        {footer && (
          <footer className="shrink-0 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] border-t border-border/60 bg-background space-y-2">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Ligne libellé / valeur d'un récapitulatif. */
export function FlowRow({ label, value, strong, onEdit }: { label: string; value: React.ReactNode; strong?: boolean; onEdit?: () => void }) {
  return (
    <div className={`flex justify-between items-center gap-3 py-3 ${strong ? 'text-[15px]' : 'text-sm'}`}>
      <span className={strong ? 'font-bold text-foreground' : 'text-muted-foreground'}>{label}</span>
      <span className="flex items-center gap-2 min-w-0">
        <span className="font-bold text-foreground text-right truncate">{value}</span>
        {onEdit && (
          <button type="button" onClick={onEdit} className="text-[12px] font-bold text-brand underline cursor-pointer shrink-0">
            Modifier
          </button>
        )}
      </span>
    </div>
  );
}

/** Encadré d'information (statut, avertissement, bonne nouvelle). */
export function FlowNotice({ tone = 'muted', icon, children }: { tone?: 'muted' | 'brand' | 'success' | 'danger' | 'warning'; icon?: React.ReactNode; children: React.ReactNode }) {
  const look = {
    muted: 'bg-muted border-border/60',
    brand: 'bg-brand/5 border-brand/20',
    success: 'bg-success-soft border-success/20',
    danger: 'bg-danger-soft border-danger/20',
    warning: 'bg-warning-soft border-warning/20',
  }[tone];
  return (
    <div className={`p-4 rounded-2xl border flex items-start gap-3 text-sm ${look}`}>
      {icon && <span className="shrink-0 mt-0.5">{icon}</span>}
      <div className="leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

/**
 * Saisie d'un montant en grand, centrée, avec séparateurs de milliers et
 * raccourcis. `value` est la chaîne de chiffres sans espaces.
 */
export function AmountField({ value, onChange, suggestions, max, autoFocus }: {
  value: string;
  onChange: (digits: string) => void;
  suggestions?: number[];
  max?: number;
  autoFocus?: boolean;
}) {
  const shown = value ? Number(value).toLocaleString('fr-FR') : '';
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border-2 border-border focus-within:border-brand transition-colors px-4 py-6 text-center bg-card">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          aria-label="Montant en FCFA"
          placeholder="0"
          value={shown}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12))}
          className="w-full bg-transparent text-center text-[40px] leading-none font-black text-foreground tabular-nums outline-none placeholder:text-muted-foreground/40"
        />
        <p className="mt-2 text-sm font-bold text-muted-foreground">FCFA</p>
      </div>
      {suggestions && suggestions.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {suggestions.filter((s) => max === undefined || s <= max).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(String(s))}
              className={`h-11 rounded-2xl border text-sm font-bold cursor-pointer transition-colors ${
                value === String(s) ? 'border-brand bg-brand/10 text-brand' : 'border-border text-foreground hover:bg-muted/60'
              }`}
            >
              {s.toLocaleString('fr-FR')} F
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Case à cocher large, facile à toucher. */
export function FlowCheckbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-3 p-4 rounded-2xl border border-border cursor-pointer has-[:checked]:border-brand has-[:checked]:bg-brand/5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-5 h-5 rounded border-border accent-[#C96F4A] cursor-pointer shrink-0"
      />
      <span className="text-sm text-foreground leading-relaxed">{children}</span>
    </label>
  );
}
