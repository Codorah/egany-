import React from 'react';

/**
 * Avatars eganyé : un emoji, ou rien.
 *
 * Les 24 avatars illustrés qui occupaient ce fichier ont été retirés. Un jeu
 * d'illustrations figées qui prétend représenter des personnes finit
 * toujours par caricaturer celles qui ne s'y reconnaissent pas — teint,
 * coiffure, traits, genre assigné à un prénom. Pour une application dont le
 * public est précisément celui qui est d'ordinaire mal représenté, le coût
 * est réel et le bénéfice nul.
 *
 * Il reste donc trois possibilités, dans cet ordre : sa propre photo, un
 * emoji choisi librement, ou le monogramme formé des initiales (voir
 * CustomAvatar) — le comportement par défaut que tout le monde connaît
 * déjà par WhatsApp.
 */

/** Préfixe de stockage, pour distinguer un emoji d'une URL de photo. */
const EMOJI_PREFIX = 'emoji:';

/**
 * Jeu d'emojis proposé. Volontairement sans visages humains stylisés aux
 * teints variables (même problème que les illustrations) : des symboles,
 * des animaux, des plantes, des objets du quotidien et des marqueurs de
 * réussite, où chacune choisit ce qui lui parle.
 */
export const EGANYE_EMOJIS: string[] = [
  '😀', '😄', '😊', '🙂', '😎', '🤗', '🥳', '😇',
  '🌟', '✨', '⭐', '🔥', '💫', '🌈', '☀️', '🌙',
  '🌳', '🌴', '🌻', '🌺', '🌸', '🍀', '🌾', '🪴',
  '🦁', '🐘', '🦋', '🐝', '🦜', '🐬', '🦚', '🐓',
  '🏡', '🛖', '🚲', '⚽', '🎵', '🥁', '📚', '🎨',
  '💎', '👑', '🏆', '🎯', '🧺', '🛍️', '🍲', '🥭',
];

export function isEmojiAvatar(val?: string | null): boolean {
  return !!val && val.startsWith(EMOJI_PREFIX);
}

/** Emoji nu, sans son préfixe de stockage. */
export function getEmojiAvatar(val?: string | null): string {
  if (!isEmojiAvatar(val)) return '';
  return val!.slice(EMOJI_PREFIX.length);
}

/** Valeur à enregistrer en base pour un emoji donné. */
export function toEmojiAvatarValue(emoji: string): string {
  return `${EMOJI_PREFIX}${emoji}`;
}

interface EganyeAvatarProps {
  emoji?: string;
  size?: number;
  className?: string;
}

export function EganyeAvatar({ emoji = '😊', size = 64, className = '' }: EganyeAvatarProps) {
  return (
    <div
      className={`rounded-full bg-muted flex items-center justify-center select-none shrink-0 ${className}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size, fontSize: Math.round(size * 0.55) }}
      role="img"
      aria-label={`Avatar ${emoji}`}
    >
      <span>{emoji}</span>
    </div>
  );
}
