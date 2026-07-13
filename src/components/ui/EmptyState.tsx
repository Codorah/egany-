import React from 'react';
import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  variant?: 'amber' | 'emerald' | 'blue' | 'purple';
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
  variant = 'amber',
}: EmptyStateProps) {
  // Theme color maps for visual accents
  const colors = {
    amber: {
      bg: 'bg-brand/10',
      text: 'text-brand',
      border: 'border-brand/20',
      lightBorder: 'border-brand/30',
      button: 'bg-primary hover:bg-primary/90 text-primary-foreground',
      glow: 'shadow-brand/10',
    },
    emerald: {
      bg: 'bg-secondary/10',
      text: 'text-secondary',
      border: 'border-secondary/20',
      lightBorder: 'border-secondary/30',
      button: 'bg-secondary hover:bg-secondary/90 text-white',
      glow: 'shadow-secondary/10',
    },
    blue: {
      bg: 'bg-blue-500/10',
      text: 'text-blue-500',
      border: 'border-blue-500/20',
      lightBorder: 'border-blue-500/30',
      button: 'bg-blue-600 hover:bg-blue-700 text-white',
      glow: 'shadow-blue-500/10',
    },
    purple: {
      bg: 'bg-purple-500/10',
      text: 'text-purple-500',
      border: 'border-purple-500/20',
      lightBorder: 'border-purple-500/30',
      button: 'bg-purple-600 hover:bg-purple-700 text-white',
      glow: 'shadow-purple-500/10',
    }
  };

  const selectedColor = colors[variant];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-card rounded-3xl border border-dashed border-border max-w-md mx-auto space-y-5"
    >
      {/* Illustrated Visual Container */}
      <div className="relative flex items-center justify-center w-24 h-24">
        {/* Animated Background Ring 1 */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className={`absolute inset-0 rounded-full border-2 border-dashed ${selectedColor.lightBorder}`}
        />

        {/* Animated Background Ring 2 */}
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute -inset-2 rounded-full bg-muted opacity-60`}
        />

        {/* Central Icon Circle */}
        <div className={`relative flex items-center justify-center w-16 h-16 rounded-2xl ${selectedColor.bg} border ${selectedColor.border} shadow-lg ${selectedColor.glow}`}>
          <Icon className={`w-8 h-8 ${selectedColor.text}`} />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-2">
        <h3 className="font-serif font-extrabold text-lg text-foreground">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground font-medium leading-relaxed max-w-sm">
          {description}
        </p>
      </div>

      {/* Action Button */}
      {actionText && onAction && (
        <motion.div
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            onClick={onAction}
            className={`rounded-2xl px-6 py-2 h-10 text-xs font-bold font-sans shadow-md ${selectedColor.button}`}
          >
            {actionText}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
