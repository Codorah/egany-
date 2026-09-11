import React from 'react';

interface TransactionItemProps {
  title: string;
  subtitle?: string;
  amount: number;
  currency?: string;
}

/**
 * Ligne de transaction — description + date + montant signé (olive si
 * positif, rouge doux si négatif). Même composant partout où l'app affiche
 * un historique d'argent.
 */
export function TransactionItem({ title, subtitle, amount, currency = 'FCFA' }: TransactionItemProps) {
  const positive = amount >= 0;
  return (
    <div className="p-3 bg-card border border-border/60 rounded-2xl flex justify-between items-center gap-3">
      <div className="min-w-0">
        <p className="text-xs font-bold text-foreground truncate">{title}</p>
        {subtitle && <p className="text-[13px] text-muted-foreground">{subtitle}</p>}
      </div>
      <span className={`text-xs font-black shrink-0 ${positive ? 'text-secondary' : 'text-danger'}`}>
        {positive ? '+' : ''}{amount.toLocaleString()} {currency}
      </span>
    </div>
  );
}
