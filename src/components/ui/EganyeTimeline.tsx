import React from 'react';
import { motion } from 'motion/react';
import { EganyeIcon, type EganyeIconName } from './EganyeIcon';

type TimelineTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface TimelineItem {
  id: string;
  icon: EganyeIconName;
  tone: TimelineTone;
  title: string;
  description?: string;
  time?: string;
  onClick?: () => void;
}

interface EganyeTimelineProps {
  items: TimelineItem[];
  className?: string;
}

const TONE_STYLES: Record<TimelineTone, { dot: string; icon: string }> = {
  success: { dot: 'bg-success-soft border-secondary', icon: 'text-secondary' },
  warning: { dot: 'bg-warning-soft border-warning', icon: 'text-warning' },
  danger: { dot: 'bg-danger-soft border-danger', icon: 'text-danger' },
  info: { dot: 'bg-primary/10 border-primary', icon: 'text-primary' },
  neutral: { dot: 'bg-muted border-border', icon: 'text-muted-foreground' },
};

const itemVariants = {
  hidden: { y: 8, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 140, damping: 18 } },
};

/**
 * EganyeTimeline — Vertical timeline for the Activity tab.
 * Each event is a row with a dot, icon, title, description, and time.
 * Consistent with Eganyé's warm, simple, readable style.
 *
 * Usage:
 *   <EganyeTimeline items={[
 *     { id: '1', icon: 'cotisation', tone: 'success', title: 'Cotisation enregistrée', description: '5 000 FCFA — Solidarité Famille', time: 'il y a 2h' },
 *     { id: '2', icon: 'bell', tone: 'warning', title: 'Rappel de cotisation', time: 'il y a 5h' },
 *   ]} />
 */
export function EganyeTimeline({ items, className = '' }: EganyeTimelineProps) {
  if (items.length === 0) return null;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      transition={{ staggerChildren: 0.04 }}
      className={`space-y-0 ${className}`}
    >
      {items.map((item, index) => {
        const styles = TONE_STYLES[item.tone];
        const isLast = index === items.length - 1;

        return (
          <motion.div
            key={item.id}
            variants={itemVariants}
            className="relative flex gap-3.5"
          >
            {/* Connector line */}
            {!isLast && (
              <div className="absolute left-[17px] top-10 bottom-0 w-[2px] bg-border" />
            )}

            {/* Dot with icon */}
            <div className={`relative z-10 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${styles.dot}`}>
              <EganyeIcon name={item.icon} size={16} className={styles.icon} />
            </div>

            {/* Content */}
            <button
              type="button"
              onClick={item.onClick}
              disabled={!item.onClick}
              className={`flex-1 min-w-0 text-left pb-4 ${item.onClick ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground truncate">{item.title}</p>
                  {item.description && (
                    <p className="text-[13px] text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                  )}
                </div>
                {item.time && (
                  <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap shrink-0 pt-0.5">
                    {item.time}
                  </span>
                )}
              </div>
            </button>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
