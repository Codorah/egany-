import React from 'react';

interface EganyeProgressProps {
  /** Value from 0 to max */
  value: number;
  /** Maximum value (default 100) */
  max?: number;
  /** 'circle' for Trust Score gauge, 'bar' for savings progress */
  variant?: 'circle' | 'bar';
  /** Size in pixels (for circle variant) */
  size?: number;
  /** Stroke thickness (for circle variant) */
  strokeWidth?: number;
  /** Show the value label inside (circle) or on the right (bar) */
  showLabel?: boolean;
  /** Custom label to display instead of value/max */
  label?: string;
  /** Color variant */
  tone?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'gold';
  className?: string;
}

const TONE_COLORS: Record<NonNullable<EganyeProgressProps['tone']>, { stroke: string; bg: string; text: string }> = {
  primary: { stroke: 'var(--primary)', bg: 'var(--primary)', text: 'text-primary' },
  secondary: { stroke: 'var(--secondary)', bg: 'var(--secondary)', text: 'text-secondary' },
  success: { stroke: 'var(--success)', bg: 'var(--success)', text: 'text-success' },
  warning: { stroke: 'var(--warning)', bg: 'var(--warning)', text: 'text-warning' },
  danger: { stroke: 'var(--danger)', bg: 'var(--danger)', text: 'text-danger' },
  gold: { stroke: 'var(--gold)', bg: 'var(--gold)', text: 'text-gold' },
};

/**
 * EganyeProgress — Circular gauge (Trust Score) or horizontal bar (savings).
 *
 * Usage:
 *   <EganyeProgress value={85} max={100} variant="circle" showLabel />  // Trust Score
 *   <EganyeProgress value={75000} max={120000} variant="bar" tone="secondary" />  // Savings
 */
export function EganyeProgress({
  value,
  max = 100,
  variant = 'bar',
  size = 72,
  strokeWidth = 5,
  showLabel = false,
  label,
  tone = 'primary',
  className = '',
}: EganyeProgressProps) {
  const percentage = Math.min(Math.max(value / max, 0), 1);
  const colors = TONE_COLORS[tone];

  if (variant === 'circle') {
    const radius = (size - strokeWidth * 2) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - percentage);

    return (
      <div className={`eganye-gauge inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          />
        </svg>
        {showLabel && (
          <div className="absolute flex flex-col items-center justify-center">
            <span className={`font-serif font-black text-sm ${colors.text}`}>
              {label || Math.round(value)}
            </span>
            {!label && (
              <span className="text-[9px] font-bold text-muted-foreground">/ {max}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Bar variant
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${percentage * 100}%`,
            backgroundColor: colors.bg,
          }}
        />
      </div>
      {showLabel && (
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold ${colors.text}`}>
            {label || `${Math.round(percentage * 100)}%`}
          </span>
          <span className="text-[11px] text-muted-foreground font-medium">
            {value.toLocaleString()} / {max.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
