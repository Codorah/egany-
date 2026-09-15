import React from 'react';

/**
 * Eganyé Illustrations — Semi-abstract, warm, organic SVG illustrations
 * in Eganyé brand colors (terracotta, olive, cream, beige, brown).
 *
 * Style: Rounded geometric forms, slightly organic, no realistic characters.
 * Used for empty states, success states, error states, and feature highlights.
 *
 * Usage:
 *   <EganyeIllustration name="no-circles" width={200} />
 */

export type EganyeIllustrationName =
  // Empty states
  | 'no-circles' | 'no-activity' | 'no-savings' | 'no-documents' | 'no-messages' | 'no-notifications'
  // Finance
  | 'payment-success' | 'savings-created' | 'money-reserved' | 'withdrawal' | 'deposit-done' | 'wallet-empty'
  // Tontine
  | 'create-circle' | 'join-circle' | 'circle-active' | 'circle-completed'
  | 'invitation-sent' | 'distribution-done' | 'cotisation-success' | 'cotisation-late'
  // Security
  | 'account-secure' | 'biometric-auth' | 'pin-code' | 'account-locked'
  // Network
  | 'offline' | 'syncing' | 'server-error' | 'maintenance'
  // Savings goals
  | 'goal-studies' | 'goal-house' | 'goal-travel' | 'goal-family'
  | 'goal-emergency' | 'goal-project' | 'goal-personal'
  // Situational & Action Character Illustrations (Section 9)
  | 'money-received' | 'wallet-recharge' | 'contribution-success'
  | 'goal-reached' | 'payment-pending' | 'error-alert' | 'offline-state'
  | 'circle-empty' | 'no-movement' | 'celebration-success';

interface EganyeIllustrationProps {
  name: EganyeIllustrationName;
  width?: number;
  height?: number;
  className?: string;
}

// Brand colors used across all illustrations
const C = {
  terracotta: '#C96F4A',
  terracottaLight: '#C96F4A33',
  terracottaMid: '#C96F4A66',
  olive: '#718A68',
  oliveLight: '#718A6833',
  oliveMid: '#718A6866',
  brown: '#3E2F24',
  brownLight: '#3E2F2422',
  cream: '#F8F0E4',
  beige: '#EFE2D0',
  white: '#FFFDFC',
  gold: '#C49A55',
  goldLight: '#C49A5533',
};

function getIllustration(name: EganyeIllustrationName): React.ReactNode {
  switch (name) {
    // ═══════════════════════════════════════════
    // EMPTY STATES
    // ═══════════════════════════════════════════
    case 'no-circles':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.beige} />
          <circle cx="80" cy="80" r="45" fill={C.white} stroke={C.terracotta} strokeWidth="2" strokeDasharray="8 4" />
          {/* Stylized people silhouettes */}
          <circle cx="60" cy="68" r="8" fill={C.terracottaLight} stroke={C.terracotta} strokeWidth="1.5" />
          <circle cx="100" cy="68" r="8" fill={C.oliveLight} stroke={C.olive} strokeWidth="1.5" />
          <circle cx="80" cy="95" r="8" fill={C.goldLight} stroke={C.gold} strokeWidth="1.5" />
          {/* Connection lines (dashed = not yet connected) */}
          <path d="M68 68h24" stroke={C.terracotta} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.4" />
          <path d="M65 75l10 15" stroke={C.olive} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.4" />
          <path d="M95 75l-10 15" stroke={C.gold} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.4" />
          {/* Plus sign */}
          <circle cx="80" cy="45" r="10" fill={C.terracotta} />
          <path d="M76 45h8M80 41v8" stroke={C.white} strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    case 'no-activity':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.beige} />
          {/* Clock / timeline */}
          <circle cx="80" cy="75" r="35" fill={C.white} stroke={C.beige} strokeWidth="2" />
          <circle cx="80" cy="75" r="28" fill="none" stroke={C.terracottaLight} strokeWidth="1.5" />
          <path d="M80 55v20l12 8" stroke={C.terracotta} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
          {/* Decorative dots (events) */}
          <circle cx="80" cy="47" r="3" fill={C.olive} opacity="0.3" />
          <circle cx="108" cy="75" r="3" fill={C.terracotta} opacity="0.3" />
          <circle cx="80" cy="103" r="3" fill={C.gold} opacity="0.3" />
          <circle cx="52" cy="75" r="3" fill={C.olive} opacity="0.3" />
          {/* ZZZ (calm/sleeping) */}
          <text x="110" y="50" fontFamily="Poppins" fontSize="14" fontWeight="700" fill={C.terracotta} opacity="0.5">z</text>
          <text x="118" y="42" fontFamily="Poppins" fontSize="11" fontWeight="700" fill={C.terracotta} opacity="0.35">z</text>
        </g>
      );
    case 'no-savings':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.beige} />
          {/* Piggy bank shape (abstract) */}
          <ellipse cx="80" cy="82" rx="38" ry="30" fill={C.white} stroke={C.olive} strokeWidth="2" />
          {/* Coin slot */}
          <rect x="72" y="56" width="16" height="3" rx="1.5" fill={C.olive} opacity="0.6" />
          {/* Eye */}
          <circle cx="95" cy="75" r="3" fill={C.brown} opacity="0.4" />
          {/* Legs */}
          <rect x="62" y="108" width="6" height="10" rx="3" fill={C.oliveLight} stroke={C.olive} strokeWidth="1" />
          <rect x="92" y="108" width="6" height="10" rx="3" fill={C.oliveLight} stroke={C.olive} strokeWidth="1" />
          {/* Coin floating above (dashed = not yet deposited) */}
          <circle cx="80" cy="38" r="10" fill={C.goldLight} stroke={C.gold} strokeWidth="1.5" strokeDasharray="4 3" />
          <text x="77" y="42" fontFamily="Poppins" fontSize="10" fontWeight="700" fill={C.gold}>F</text>
        </g>
      );
    case 'no-documents':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.beige} />
          {/* Document stack */}
          <rect x="50" y="48" width="55" height="70" rx="6" fill={C.white} stroke={C.beige} strokeWidth="2" transform="rotate(-3 75 80)" />
          <rect x="52" y="45" width="55" height="70" rx="6" fill={C.white} stroke={C.terracottaLight} strokeWidth="1.5" />
          {/* Lines (empty) */}
          <rect x="62" y="62" width="35" height="3" rx="1.5" fill={C.beige} />
          <rect x="62" y="72" width="28" height="3" rx="1.5" fill={C.beige} />
          <rect x="62" y="82" width="32" height="3" rx="1.5" fill={C.beige} />
          <rect x="62" y="92" width="20" height="3" rx="1.5" fill={C.beige} />
          {/* Folder icon */}
          <circle cx="110" cy="45" r="12" fill={C.terracotta} opacity="0.15" />
          <path d="M104 42h4l2 3h6v8h-12v-11z" fill="none" stroke={C.terracotta} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
        </g>
      );
    case 'no-messages':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.beige} />
          {/* Chat bubble */}
          <path d="M40 50h65a8 8 0 018 8v35a8 8 0 01-8 8H65l-15 14V101H40a8 8 0 01-8-8V58a8 8 0 018-8z" fill={C.white} stroke={C.terracottaLight} strokeWidth="1.5" />
          {/* Dots (empty conversation) */}
          <circle cx="62" cy="76" r="4" fill={C.beige} />
          <circle cx="80" cy="76" r="4" fill={C.beige} />
          <circle cx="98" cy="76" r="4" fill={C.beige} />
        </g>
      );
    case 'no-notifications':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.beige} />
          {/* Bell */}
          <path d="M60 70a20 20 0 0140 0c0 12 6 18 6 18H54s6-6 6-18z" fill={C.white} stroke={C.terracottaLight} strokeWidth="2" />
          <path d="M72 88a8 8 0 0016 0" stroke={C.terracottaLight} strokeWidth="2" fill="none" />
          {/* ZZZ */}
          <text x="100" y="55" fontFamily="Poppins" fontSize="16" fontWeight="700" fill={C.terracotta} opacity="0.4">z</text>
          <text x="110" y="46" fontFamily="Poppins" fontSize="12" fontWeight="700" fill={C.terracotta} opacity="0.3">z</text>
          {/* Check mark badge */}
          <circle cx="100" cy="65" r="8" fill={C.olive} opacity="0.2" />
          <path d="M96 65l3 3 5-5" stroke={C.olive} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" />
        </g>
      );

    // ═══════════════════════════════════════════
    // FINANCE
    // ═══════════════════════════════════════════
    case 'payment-success':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.oliveLight} />
          {/* Big check circle */}
          <circle cx="80" cy="72" r="35" fill={C.white} stroke={C.olive} strokeWidth="2.5" />
          <path d="M64 72l10 10 22-24" stroke={C.olive} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* Sparkles */}
          <circle cx="120" cy="45" r="4" fill={C.gold} opacity="0.5" />
          <circle cx="40" cy="50" r="3" fill={C.terracotta} opacity="0.4" />
          <circle cx="115" cy="100" r="2.5" fill={C.olive} opacity="0.4" />
          {/* Coin */}
          <circle cx="50" cy="110" r="8" fill={C.goldLight} stroke={C.gold} strokeWidth="1.5" />
          <text x="47" y="114" fontFamily="Poppins" fontSize="9" fontWeight="700" fill={C.gold}>F</text>
        </g>
      );
    case 'savings-created':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.oliveLight} />
          {/* Vault / safe */}
          <rect x="45" y="45" width="70" height="60" rx="10" fill={C.white} stroke={C.olive} strokeWidth="2" />
          <circle cx="80" cy="72" r="15" fill="none" stroke={C.olive} strokeWidth="2" />
          <circle cx="80" cy="72" r="5" fill={C.olive} opacity="0.5" />
          <rect x="100" y="60" width="5" height="8" rx="2" fill={C.olive} opacity="0.4" />
          {/* Star sparkle */}
          <circle cx="110" cy="40" r="6" fill={C.gold} opacity="0.3" />
          <path d="M110 36v8M106 40h8" stroke={C.gold} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );
    case 'money-reserved':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.beige} />
          {/* Lock with coin */}
          <rect x="55" y="55" width="50" height="45" rx="8" fill={C.white} stroke={C.terracotta} strokeWidth="2" />
          <path d="M65 55V45a15 15 0 0130 0v10" fill="none" stroke={C.terracotta} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="80" cy="78" r="8" fill={C.goldLight} stroke={C.gold} strokeWidth="1.5" />
          <text x="77" y="82" fontFamily="Poppins" fontSize="9" fontWeight="700" fill={C.gold}>F</text>
        </g>
      );
    case 'withdrawal':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.beige} />
          {/* Card / wallet */}
          <rect x="35" y="55" width="70" height="45" rx="8" fill={C.white} stroke={C.terracotta} strokeWidth="2" />
          <rect x="35" y="65" width="70" height="6" fill={C.terracottaLight} />
          {/* Arrow coming out */}
          <path d="M100 78v-30" stroke={C.terracotta} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M93 55l7-7 7 7" stroke={C.terracotta} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* Coin */}
          <circle cx="100" cy="38" r="8" fill={C.goldLight} stroke={C.gold} strokeWidth="1.5" />
        </g>
      );
    case 'deposit-done':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.oliveLight} />
          {/* Card / wallet */}
          <rect x="35" y="55" width="70" height="45" rx="8" fill={C.white} stroke={C.olive} strokeWidth="2" />
          <rect x="35" y="65" width="70" height="6" fill={C.oliveLight} />
          {/* Arrow going in */}
          <path d="M100 40v30" stroke={C.olive} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M93 63l7 7 7-7" stroke={C.olive} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* Check */}
          <circle cx="50" cy="40" r="10" fill={C.olive} opacity="0.2" />
          <path d="M45 40l3 3 6-6" stroke={C.olive} strokeWidth="2" strokeLinecap="round" fill="none" />
        </g>
      );
    case 'wallet-empty':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.beige} />
          {/* Open wallet */}
          <path d="M30 60h100v50H30z" fill="none" />
          <rect x="35" y="50" width="70" height="55" rx="8" fill={C.white} stroke={C.beige} strokeWidth="2" />
          <path d="M35 60h70" stroke={C.beige} strokeWidth="1.5" />
          {/* Empty pocket indicator */}
          <path d="M65 82c0-3 6-8 15-8s15 5 15 8" fill="none" stroke={C.terracotta} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
          {/* Sad face dots */}
          <circle cx="70" cy="78" r="2" fill={C.terracotta} opacity="0.3" />
          <circle cx="90" cy="78" r="2" fill={C.terracotta} opacity="0.3" />
        </g>
      );

    // ═══════════════════════════════════════════
    // TONTINE
    // ═══════════════════════════════════════════
    case 'create-circle':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.terracottaLight} />
          {/* Circle being drawn */}
          <circle cx="80" cy="75" r="38" fill="none" stroke={C.terracotta} strokeWidth="2.5" strokeDasharray="12 6" />
          {/* People nodes */}
          <circle cx="80" cy="37" r="7" fill={C.white} stroke={C.terracotta} strokeWidth="1.5" />
          <circle cx="50" cy="95" r="7" fill={C.white} stroke={C.olive} strokeWidth="1.5" />
          <circle cx="110" cy="95" r="7" fill={C.white} stroke={C.gold} strokeWidth="1.5" />
          {/* Plus in center */}
          <circle cx="80" cy="75" r="14" fill={C.terracotta} />
          <path d="M75 75h10M80 70v10" stroke={C.white} strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    case 'join-circle':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.oliveLight} />
          {/* Existing circle */}
          <circle cx="75" cy="75" r="38" fill="none" stroke={C.olive} strokeWidth="2" />
          {/* Existing members */}
          <circle cx="75" cy="37" r="6" fill={C.olive} opacity="0.5" />
          <circle cx="45" cy="90" r="6" fill={C.olive} opacity="0.5" />
          <circle cx="105" cy="90" r="6" fill={C.olive} opacity="0.5" />
          {/* New person joining (with arrow) */}
          <circle cx="115" cy="55" r="9" fill={C.white} stroke={C.terracotta} strokeWidth="2" />
          <path d="M130 55h-8" stroke={C.terracotta} strokeWidth="2" strokeLinecap="round" />
          <path d="M126 51l-4 4 4 4" stroke={C.terracotta} strokeWidth="2" strokeLinecap="round" fill="none" />
        </g>
      );
    case 'circle-active':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.oliveLight} />
          {/* Active circle */}
          <circle cx="80" cy="75" r="38" fill="none" stroke={C.olive} strokeWidth="2.5" />
          {/* Members */}
          <circle cx="80" cy="37" r="7" fill={C.olive} />
          <circle cx="48" cy="92" r="7" fill={C.olive} opacity="0.7" />
          <circle cx="112" cy="92" r="7" fill={C.olive} opacity="0.7" />
          <circle cx="50" cy="60" r="6" fill={C.olive} opacity="0.5" />
          <circle cx="110" cy="60" r="6" fill={C.olive} opacity="0.5" />
          {/* Connection lines */}
          <path d="M80 44l-28 45M80 44l28 45M52 92h56" stroke={C.olive} strokeWidth="1" opacity="0.3" />
          {/* Active pulse */}
          <circle cx="80" cy="75" r="18" fill={C.olive} opacity="0.15" />
          <circle cx="80" cy="75" r="8" fill={C.olive} opacity="0.3" />
        </g>
      );
    case 'circle-completed':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.oliveLight} />
          <circle cx="80" cy="75" r="38" fill="none" stroke={C.olive} strokeWidth="2" opacity="0.5" />
          {/* Big check */}
          <circle cx="80" cy="75" r="22" fill={C.olive} opacity="0.15" />
          <path d="M68 75l8 8 16-18" stroke={C.olive} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* Trophy */}
          <circle cx="115" cy="42" r="10" fill={C.goldLight} stroke={C.gold} strokeWidth="1.5" />
          <path d="M112 39v6l3 2 3-2v-6" stroke={C.gold} strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </g>
      );
    case 'invitation-sent':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.terracottaLight} />
          {/* Envelope */}
          <rect x="40" y="50" width="65" height="45" rx="6" fill={C.white} stroke={C.terracotta} strokeWidth="2" />
          <path d="M40 50l32.5 22L105 50" stroke={C.terracotta} strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* Flying paper airplane */}
          <path d="M100 35l15-10-5 15-10-5z" fill={C.terracotta} opacity="0.6" />
          <path d="M105 38l5-13" stroke={C.terracotta} strokeWidth="1.5" opacity="0.4" />
          {/* Sparkles */}
          <circle cx="125" cy="30" r="3" fill={C.gold} opacity="0.5" />
          <circle cx="120" cy="22" r="2" fill={C.terracotta} opacity="0.3" />
        </g>
      );
    case 'distribution-done':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.oliveLight} />
          {/* Central coin burst */}
          <circle cx="80" cy="70" r="20" fill={C.goldLight} stroke={C.gold} strokeWidth="2" />
          <text x="73" y="76" fontFamily="Poppins" fontSize="16" fontWeight="800" fill={C.gold}>F</text>
          {/* Arrows radiating out */}
          <path d="M80 50v-12M60 58l-8-8M100 58l8-8" stroke={C.olive} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          {/* Person receiving */}
          <circle cx="80" cy="110" r="10" fill={C.white} stroke={C.olive} strokeWidth="2" />
          <path d="M80 90v10" stroke={C.olive} strokeWidth="2" strokeLinecap="round" />
          <path d="M76 96l4 4 4-4" stroke={C.olive} strokeWidth="2" strokeLinecap="round" fill="none" />
        </g>
      );
    case 'cotisation-success':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.oliveLight} />
          <circle cx="80" cy="72" r="30" fill={C.white} stroke={C.olive} strokeWidth="2" />
          <path d="M68 72l8 8 16-16" stroke={C.olive} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* Coin */}
          <circle cx="110" cy="100" r="10" fill={C.goldLight} stroke={C.gold} strokeWidth="1.5" />
          <text x="106" y="105" fontFamily="Poppins" fontSize="10" fontWeight="700" fill={C.gold}>F</text>
        </g>
      );
    case 'cotisation-late':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill="#F9E5E3" />
          {/* Warning clock */}
          <circle cx="80" cy="72" r="30" fill={C.white} stroke="#B4483F" strokeWidth="2" />
          <path d="M80 55v17l10 8" stroke="#B4483F" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* Exclamation */}
          <circle cx="110" cy="45" r="10" fill="#B4483F" opacity="0.15" />
          <path d="M110 39v6" stroke="#B4483F" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="110" cy="49" r="1.2" fill="#B4483F" />
        </g>
      );

    // ═══════════════════════════════════════════
    // SECURITY
    // ═══════════════════════════════════════════
    case 'account-secure':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.oliveLight} />
          {/* Shield */}
          <path d="M80 30l35 15v25c0 20-14 35-35 42-21-7-35-22-35-42V45l35-15z" fill={C.white} stroke={C.olive} strokeWidth="2.5" />
          <path d="M68 78l8 8 16-16" stroke={C.olive} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      );
    case 'biometric-auth':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.terracottaLight} />
          {/* Fingerprint */}
          <circle cx="80" cy="75" r="35" fill={C.white} stroke={C.beige} strokeWidth="1.5" />
          <path d="M65 85c0-15 6-25 15-25s15 10 15 25" fill="none" stroke={C.terracotta} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
          <path d="M70 82c0-10 4-18 10-18s10 8 10 18" fill="none" stroke={C.terracotta} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <path d="M75 80c0-6 2-10 5-10s5 4 5 10" fill="none" stroke={C.terracotta} strokeWidth="2" strokeLinecap="round" opacity="0.3" />
        </g>
      );
    case 'pin-code':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.beige} />
          {/* PIN dots */}
          {[45, 65, 85, 105].map((x, i) => (
            <g key={i}>
              <circle cx={x} cy="75" r="10" fill={C.white} stroke={C.terracotta} strokeWidth="1.5" />
              <circle cx={x} cy="75" r="4" fill={i < 3 ? C.terracotta : C.beige} />
            </g>
          ))}
          {/* Lock icon above */}
          <path d="M70 50V42a10 10 0 0120 0v8" fill="none" stroke={C.terracotta} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        </g>
      );
    case 'account-locked':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill="#F9E5E3" />
          {/* Big lock */}
          <rect x="55" y="65" width="50" height="40" rx="8" fill={C.white} stroke="#B4483F" strokeWidth="2.5" />
          <path d="M65 65V52a15 15 0 0130 0v13" fill="none" stroke="#B4483F" strokeWidth="3" strokeLinecap="round" />
          <circle cx="80" cy="82" r="5" fill="#B4483F" opacity="0.4" />
          <path d="M80 87v6" stroke="#B4483F" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );

    // ═══════════════════════════════════════════
    // NETWORK
    // ═══════════════════════════════════════════
    case 'offline':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.beige} />
          {/* Cloud */}
          <path d="M45 85a20 20 0 010-25 20 20 0 0135-10 18 18 0 0125 15 15 15 0 01-5 30H45z" fill={C.white} stroke={C.terracotta} strokeWidth="2" opacity="0.7" />
          {/* Slash */}
          <path d="M50 105L115 45" stroke="#B4483F" strokeWidth="3" strokeLinecap="round" />
          {/* WiFi bars */}
          <path d="M70 82a14 14 0 0120 0" fill="none" stroke={C.terracotta} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
          <path d="M64 76a22 22 0 0132 0" fill="none" stroke={C.terracotta} strokeWidth="2" strokeLinecap="round" opacity="0.3" />
          <circle cx="80" cy="88" r="3" fill={C.terracotta} opacity="0.5" />
        </g>
      );
    case 'syncing':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.oliveLight} />
          {/* Sync arrows */}
          <path d="M50 70a30 30 0 0155-8" fill="none" stroke={C.olive} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M100 58l5 4-6 2" stroke={C.olive} strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M110 90a30 30 0 01-55 8" fill="none" stroke={C.olive} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M60 102l-5-4 6-2" stroke={C.olive} strokeWidth="2" strokeLinecap="round" fill="none" />
          {/* Cloud */}
          <circle cx="80" cy="75" r="12" fill={C.white} stroke={C.olive} strokeWidth="1.5" opacity="0.5" />
        </g>
      );
    case 'server-error':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill="#F9E5E3" />
          {/* Server box */}
          <rect x="50" y="40" width="60" height="75" rx="6" fill={C.white} stroke="#B4483F" strokeWidth="2" />
          <rect x="50" y="40" width="60" height="25" rx="6" fill={C.white} stroke="#B4483F" strokeWidth="1.5" />
          <circle cx="65" cy="52" r="3" fill="#B4483F" opacity="0.4" />
          <rect x="75" y="50" width="25" height="4" rx="2" fill="#B4483F" opacity="0.2" />
          {/* Error X */}
          <path d="M72 85l16 16M88 85l-16 16" stroke="#B4483F" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 'maintenance':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.beige} />
          {/* Wrench + gear */}
          <circle cx="75" cy="70" r="20" fill="none" stroke={C.terracotta} strokeWidth="2" />
          <circle cx="75" cy="70" r="8" fill={C.terracottaLight} stroke={C.terracotta} strokeWidth="1.5" />
          {/* Gear teeth */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 75 + Math.cos(rad) * 18;
            const y1 = 70 + Math.sin(rad) * 18;
            const x2 = 75 + Math.cos(rad) * 23;
            const y2 = 70 + Math.sin(rad) * 23;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.terracotta} strokeWidth="3" strokeLinecap="round" opacity="0.5" />;
          })}
          {/* Wrench */}
          <path d="M100 95l-14-14" stroke={C.terracotta} strokeWidth="3" strokeLinecap="round" />
          <path d="M102 97a4 4 0 01-6 0l-2-2 6-6 2 2a4 4 0 010 6z" fill={C.terracotta} opacity="0.6" />
        </g>
      );

    // ═══════════════════════════════════════════
    // SAVINGS GOALS
    // ═══════════════════════════════════════════
    case 'goal-studies':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.oliveLight} />
          {/* Graduation cap */}
          <path d="M30 72l50-22 50 22-50 22-50-22z" fill={C.white} stroke={C.olive} strokeWidth="2" />
          <path d="M50 82v22c0 6 15 10 30 10s30-4 30-10V82" fill="none" stroke={C.olive} strokeWidth="2" />
          <path d="M130 72v20" stroke={C.olive} strokeWidth="2" strokeLinecap="round" />
          {/* Book */}
          <rect x="65" y="90" width="30" height="5" rx="2" fill={C.olive} opacity="0.3" />
        </g>
      );
    case 'goal-house':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.terracottaLight} />
          {/* House */}
          <path d="M80 35L40 65h10v40h60V65h10L80 35z" fill={C.white} stroke={C.terracotta} strokeWidth="2.5" />
          <rect x="68" y="80" width="24" height="25" rx="3" fill={C.terracottaLight} stroke={C.terracotta} strokeWidth="1.5" />
          <path d="M80 80v25" stroke={C.terracotta} strokeWidth="1" opacity="0.5" />
          {/* Window */}
          <rect x="55" y="70" width="12" height="10" rx="2" fill={C.terracottaLight} stroke={C.terracotta} strokeWidth="1" />
          <rect x="93" y="70" width="12" height="10" rx="2" fill={C.terracottaLight} stroke={C.terracotta} strokeWidth="1" />
        </g>
      );
    case 'goal-travel':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.terracottaLight} />
          {/* Suitcase */}
          <rect x="45" y="55" width="70" height="50" rx="8" fill={C.white} stroke={C.terracotta} strokeWidth="2" />
          <path d="M62 55V45a8 8 0 0116 0v10" fill="none" stroke={C.terracotta} strokeWidth="2" />
          <path d="M45 70h70" stroke={C.terracotta} strokeWidth="1.5" opacity="0.3" />
          {/* Label */}
          <circle cx="80" cy="80" r="8" fill={C.terracottaLight} stroke={C.terracotta} strokeWidth="1.5" />
          {/* Plane */}
          <path d="M110 35l-8 8 4 2-6 4 12-2-2-12z" fill={C.terracotta} opacity="0.4" />
        </g>
      );
    case 'goal-family':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.oliveLight} />
          {/* Family figures (abstract) */}
          {/* Adult 1 */}
          <circle cx="55" cy="55" r="10" fill={C.white} stroke={C.olive} strokeWidth="2" />
          <rect x="48" y="68" width="14" height="28" rx="5" fill={C.white} stroke={C.olive} strokeWidth="1.5" />
          {/* Adult 2 */}
          <circle cx="105" cy="55" r="10" fill={C.white} stroke={C.olive} strokeWidth="2" />
          <rect x="98" y="68" width="14" height="28" rx="5" fill={C.white} stroke={C.olive} strokeWidth="1.5" />
          {/* Child */}
          <circle cx="80" cy="65" r="8" fill={C.white} stroke={C.terracotta} strokeWidth="1.5" />
          <rect x="74" y="76" width="12" height="20" rx="4" fill={C.white} stroke={C.terracotta} strokeWidth="1.5" />
          {/* Heart */}
          <path d="M76 50a4 4 0 018 0c4-4 10 0 6 6l-10 8-10-8c-4-6 2-10 6-6z" fill={C.terracotta} opacity="0.2" />
        </g>
      );
    case 'goal-emergency':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.terracottaLight} />
          {/* Shield */}
          <path d="M80 30l35 15v25c0 20-14 35-35 42-21-7-35-22-35-42V45l35-15z" fill={C.white} stroke={C.terracotta} strokeWidth="2.5" />
          {/* Plus (emergency) */}
          <path d="M72 75h16M80 67v16" stroke={C.terracotta} strokeWidth="3.5" strokeLinecap="round" />
        </g>
      );
    case 'goal-project':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.goldLight} />
          {/* Rocket / rising star */}
          <polygon points="80,25 90,55 80,50 70,55" fill={C.white} stroke={C.gold} strokeWidth="2" />
          <circle cx="80" cy="42" r="4" fill={C.gold} opacity="0.4" />
          {/* Trail */}
          <path d="M74 55l-8 20" stroke={C.gold} strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />
          <path d="M86 55l8 20" stroke={C.gold} strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />
          <path d="M80 55v25" stroke={C.gold} strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />
          {/* Target */}
          <circle cx="80" cy="100" r="15" fill={C.white} stroke={C.gold} strokeWidth="2" />
          <circle cx="80" cy="100" r="8" fill="none" stroke={C.gold} strokeWidth="1.5" opacity="0.5" />
          <circle cx="80" cy="100" r="3" fill={C.gold} />
        </g>
      );
    case 'goal-personal':
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.terracottaLight} />
          {/* Gift box */}
          <rect x="48" y="65" width="64" height="42" rx="6" fill={C.white} stroke={C.terracotta} strokeWidth="2" />
          <path d="M80 65v42" stroke={C.terracotta} strokeWidth="2" />
          <path d="M48 78h64" stroke={C.terracotta} strokeWidth="1.5" opacity="0.4" />
          {/* Ribbon */}
          <path d="M65 65c0-12 15-18 15-18s15 6 15 18" fill="none" stroke={C.terracotta} strokeWidth="2" strokeLinecap="round" />
          {/* Bow */}
          <circle cx="80" cy="60" r="6" fill={C.terracotta} opacity="0.3" />
          {/* Sparkles */}
          <circle cx="120" cy="50" r="3" fill={C.gold} opacity="0.5" />
          <circle cx="42" cy="58" r="2" fill={C.gold} opacity="0.4" />
        </g>
      );

    default:
      return (
        <g>
          <circle cx="80" cy="80" r="65" fill={C.beige} />
          <circle cx="80" cy="80" r="30" fill={C.white} stroke={C.terracotta} strokeWidth="2" strokeDasharray="8 4" />
        </g>
      );
  }
}

const ACTION_ILLUSTRATIONS = new Set([
  'money-received',
  'wallet-recharge',
  'contribution-success',
  'goal-reached',
  'payment-pending',
  'error-alert',
  'offline-state',
  'circle-empty',
  'no-movement',
  'celebration-success',
]);

export function EganyeIllustration({
  name,
  width = 160,
  height,
  className = '',
}: EganyeIllustrationProps) {
  const h = height || width;

  if (ACTION_ILLUSTRATIONS.has(name)) {
    return (
      <img
        src={`/illustrations/${name}.svg`}
        alt={name}
        width={width}
        height={h}
        className={`select-none shrink-0 object-contain ${className}`}
        style={{ width, height: h }}
        loading="lazy"
      />
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 160 160"
      width={width}
      height={h}
      className={className}
      aria-hidden="true"
      role="presentation"
    >
      {getIllustration(name)}
    </svg>
  );
}

