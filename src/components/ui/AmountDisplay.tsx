import React from 'react';

interface AmountDisplayProps {
  amount: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  hidden?: boolean;
  className?: string;
  currencyClassName?: string;
}

const SIZE_CLASSES: Record<NonNullable<AmountDisplayProps['size']>, string> = {
  sm: 'text-sm',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl sm:text-4xl',
};

const CURRENCY_SIZE_CLASSES: Record<NonNullable<AmountDisplayProps['size']>, string> = {
  sm: 'text-[11px]',
  md: 'text-[13px]',
  lg: 'text-sm',
  xl: 'text-sm',
};

/**
 * Montant en gros chiffres façon charte eganyé (Poppins, tracking serré) —
 * remplace le pattern dupliqué dans Dashboard/ContributionsManager/MyBank/GroupDetails.
 */
export function AmountDisplay({
  amount,
  currency = 'FCFA',
  size = 'md',
  hidden = false,
  className = '',
  currencyClassName = 'text-muted-foreground',
}: AmountDisplayProps) {
  return (
    <span className={`font-serif font-black tracking-tight ${SIZE_CLASSES[size]} ${className}`}>
      {hidden ? '••••••' : amount.toLocaleString()}{' '}
      <span className={`font-sans font-bold ${CURRENCY_SIZE_CLASSES[size]} ${currencyClassName}`}>
        {currency}
      </span>
    </span>
  );
}
