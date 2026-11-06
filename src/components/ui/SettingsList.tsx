import React from 'react';
import { EganyeIcon, type EganyeIconName } from './EganyeIcon';

/**
 * Listes groupées façon réglages de téléphone : un titre court, puis des
 * lignes « icône · libellé · valeur ». Même présentation partout (profil,
 * cercle, portefeuille) pour qu'on lise chaque écran de la même manière.
 */
export function SettingsGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      {title && <h2 className="text-[13px] font-bold text-muted-foreground px-3">{title}</h2>}
      <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  icon,
  label,
  hint,
  value,
  onClick,
  trailing,
  danger = false,
}: {
  /** Icône neutre : la couleur reste réservée à l'action et à l'état. */
  icon?: EganyeIconName;
  /** Conservé pour les écrans existants : les icônes sont désormais toutes neutres. */
  tone?: string;
  label: string;
  hint?: string;
  /** Valeur courte affichée à droite (montant, état…). */
  value?: React.ReactNode;
  /** Ligne cliquable : ajoute le chevron. */
  onClick?: () => void;
  /** Élément libre à droite (interrupteur, badge…), à la place du chevron. */
  trailing?: React.ReactNode;
  danger?: boolean;
}) {
  const content = (
    <>
      {icon && (
        <span className={`w-6 flex items-center justify-center shrink-0 ${danger ? 'text-danger' : 'text-muted-foreground'}`}>
          <EganyeIcon name={icon} size={20} />
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className={`block text-[15px] font-semibold ${danger ? 'text-danger' : 'text-foreground'}`}>{label}</span>
        {hint && <span className="block text-[13px] text-muted-foreground leading-snug">{hint}</span>}
      </span>
      {value !== undefined && (
        <span className="text-sm text-muted-foreground text-right shrink-0 max-w-[45%] truncate">{value}</span>
      )}
      {trailing}
      {onClick && !trailing && <EganyeIcon name="chevron-right" size={16} className="text-muted-foreground shrink-0" />}
    </>
  );

  const className = 'w-full min-h-[52px] flex items-center gap-3 px-4 py-2.5 text-left';
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} active:bg-muted transition-colors duration-150 cursor-pointer`}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}
