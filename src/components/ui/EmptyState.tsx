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
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      border: 'border-amber-100',
      lightBorder: 'border-amber-200/50',
      button: 'bg-amber-500 hover:bg-amber-600 text-slate-950',
      glow: 'shadow-amber-100',
    },
    emerald: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      border: 'border-emerald-100',
      lightBorder: 'border-emerald-200/50',
      button: 'bg-[#2BB673] hover:bg-[#2BB673]/90 text-white',
      glow: 'shadow-emerald-100',
    },
    blue: {
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      border: 'border-blue-100',
      lightBorder: 'border-blue-200/50',
      button: 'bg-blue-600 hover:bg-blue-700 text-white',
      glow: 'shadow-blue-100',
    },
    purple: {
      bg: 'bg-purple-50',
      text: 'text-purple-600',
      border: 'border-purple-100',
      lightBorder: 'border-purple-200/50',
      button: 'bg-purple-600 hover:bg-purple-700 text-white',
      glow: 'shadow-purple-100',
    }
  };

  const selectedColor = colors[variant];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-white rounded-3xl border border-dashed border-slate-200/80 max-w-md mx-auto space-y-5"
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
          className={`absolute -inset-2 rounded-full bg-slate-50 opacity-60`}
        />

        {/* Central Icon Circle */}
        <div className={`relative flex items-center justify-center w-16 h-16 rounded-2xl ${selectedColor.bg} border ${selectedColor.border} shadow-lg ${selectedColor.glow}`}>
          <Icon className={`w-8 h-8 ${selectedColor.text}`} />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-2">
        <h3 className="font-serif font-extrabold text-lg text-[#4B2E05]">
          {title}
        </h3>
        <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-sm">
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
