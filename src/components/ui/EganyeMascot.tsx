import React from 'react';
import { motion } from 'motion/react';

export type MascotVariant =
  | 'loading'
  | 'success'
  | 'payment'
  | 'security'
  | 'empty'
  | 'saving'
  | 'circle'
  | 'activity'
  | 'bank'
  | 'chat'
  | 'profile'
  | 'error'
  | 'offline'
  | 'onboarding';

interface EganyeMascotProps {
  variant?: MascotVariant;
  size?: number;
  className?: string;
  message?: string;
}

const VARIANT_TO_ASSET: Record<MascotVariant, string> = {
  loading: 'loading',
  success: 'success',
  payment: 'payment',
  security: 'security',
  empty: 'empty',
  saving: 'saving',
  circle: 'circle',
  activity: 'activity',
  bank: 'bank',
  chat: 'chat',
  profile: 'profile',
  error: 'error',
  offline: 'offline',
  onboarding: 'onboarding',
};

const FLOATING_VARIANTS = new Set<MascotVariant>(['loading', 'payment', 'saving']);

/**
 * Ganye, the Eganye companion avatar.
 *
 * The component deliberately stays image-based: the character system is shared
 * between onboarding, empty states, loading, errors, banking and circle screens
 * through /brand-avatars/*.svg instead of one-off inline drawings.
 */
export function EganyeMascot({
  variant = 'loading',
  size = 120,
  className = '',
  message,
}: EganyeMascotProps) {
  const asset = VARIANT_TO_ASSET[variant] || VARIANT_TO_ASSET.loading;
  const shouldFloat = FLOATING_VARIANTS.has(variant);

  const image = (
    <img
      src={`/brand-avatars/${asset}.svg`}
      alt=""
      width={size}
      height={size}
      className="block select-none object-contain"
      style={{ width: size, height: size }}
      draggable={false}
    />
  );

  return (
    <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
      {shouldFloat ? (
        <motion.div
          animate={{ y: [-3, 3, -3] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
          className="relative"
        >
          {image}
        </motion.div>
      ) : (
        <div className="relative">{image}</div>
      )}

      {message && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 max-w-[220px] text-xs font-bold leading-relaxed text-muted-foreground"
        >
          {message}
        </motion.p>
      )}
    </div>
  );
}
