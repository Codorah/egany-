import React from 'react';

/**
 * Eganyé Icon Language — Unified custom icon system.
 *
 * Style: rounded, soft, slightly organic, clean lines.
 * All icons: 24×24 viewBox, stroke-based, currentColor,
 * stroke-width 1.8, stroke-linecap round, stroke-linejoin round.
 *
 * Usage:
 *   <EganyeIcon name="home" />
 *   <EganyeIcon name="circle" size={20} className="text-primary" />
 */

export type EganyeIconName =
  // Navigation
  | 'home' | 'circle' | 'activity' | 'bank' | 'profile'
  // Finance
  | 'wallet' | 'money' | 'coin' | 'bill' | 'payment' | 'withdraw' | 'deposit'
  | 'transfer' | 'savings' | 'vault' | 'lock' | 'calendar-finance'
  // Tontine
  | 'tontine-circle' | 'members' | 'cotisation' | 'distribution' | 'tour'
  | 'contribution' | 'penalty' | 'trust' | 'invitation' | 'qr-code' | 'code' | 'share'
  // Communication
  | 'message' | 'notification' | 'bell' | 'chat' | 'call' | 'support'
  // Documents
  | 'document' | 'contract' | 'status-doc' | 'receipt' | 'download' | 'share-doc'
  // Profile
  | 'user' | 'security' | 'biometric' | 'language' | 'settings' | 'help' | 'logout'
  // States
  | 'success' | 'error' | 'warning' | 'info' | 'locked' | 'completed' | 'pending' | 'late'
  // Savings goals
  | 'project' | 'house' | 'studies' | 'travel' | 'family' | 'emergency' | 'health'
  | 'goal' | 'gift' | 'investment'
  // Extra
  | 'search' | 'close' | 'chevron-right' | 'chevron-left' | 'plus' | 'arrow-up' | 'arrow-down'
  | 'eye' | 'eye-off' | 'refresh' | 'star' | 'shield' | 'check' | 'loading'
  | 'send' | 'camera' | 'trash' | 'copy' | 'shuffle' | 'list' | 'key' | 'fingerprint' | 'globe';

interface EganyeIconProps {
  name: EganyeIconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  'aria-label'?: string;
}

// All paths use the same base style for visual consistency
const BASE_PROPS = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function getPath(name: EganyeIconName, sw: number): React.ReactNode {
  const p = { ...BASE_PROPS, strokeWidth: sw };
  const pThin = { ...BASE_PROPS, strokeWidth: sw * 0.75 };

  switch (name) {
    // ═══════════════════════════════════════════
    // NAVIGATION
    // ═══════════════════════════════════════════
    case 'home':
      return (
        <>
          <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5z" {...p} />
          <path d="M9 21V14h6v7" {...p} />
        </>
      );
    case 'circle':
      return (
        <>
          <circle cx="12" cy="12" r="9" {...p} />
          <circle cx="12" cy="9" r="2" {...p} />
          <circle cx="8" cy="14.5" r="1.5" {...pThin} />
          <circle cx="16" cy="14.5" r="1.5" {...pThin} />
          <path d="M9 18c0-1.5 1.5-2.5 3-2.5s3 1 3 2.5" {...pThin} />
        </>
      );
    case 'activity':
      return (
        <>
          <path d="M12 3v4" {...p} />
          <path d="M5.5 7l2.8 2.8" {...p} />
          <path d="M3 13.5h4" {...p} />
          <path d="M5.5 20l2.8-2.8" {...p} />
          <path d="M12 21v-4" {...p} />
          <path d="M18.5 20l-2.8-2.8" {...p} />
          <path d="M21 13.5h-4" {...p} />
          <path d="M18.5 7l-2.8 2.8" {...p} />
          <circle cx="12" cy="12" r="3" {...p} />
        </>
      );
    case 'bank':
      return (
        <>
          <path d="M3 21h18" {...p} />
          <path d="M5 21V11" {...p} />
          <path d="M19 21V11" {...p} />
          <path d="M9 21V14" {...p} />
          <path d="M15 21V14" {...p} />
          <path d="M12 3L2 9h20L12 3z" {...p} />
          <path d="M3 9h18" {...p} />
        </>
      );
    case 'profile':
      return (
        <>
          <circle cx="12" cy="8" r="4" {...p} />
          <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" {...p} />
        </>
      );

    // ═══════════════════════════════════════════
    // FINANCE
    // ═══════════════════════════════════════════
    case 'wallet':
      return (
        <>
          <rect x="2" y="6" width="20" height="14" rx="3" {...p} />
          <path d="M2 10h20" {...p} />
          <circle cx="17" cy="14" r="1.5" fill="currentColor" stroke="none" />
        </>
      );
    case 'money':
      return (
        <>
          <rect x="2" y="5" width="20" height="14" rx="2" {...p} />
          <circle cx="12" cy="12" r="3" {...p} />
          <path d="M6 9v0" {...p} />
          <path d="M18 15v0" {...p} />
        </>
      );
    case 'coin':
      return (
        <>
          <circle cx="12" cy="12" r="9" {...p} />
          <path d="M12 7v10" {...p} />
          <path d="M9 9.5c0-1 1.5-2 3-2s3 1 3 2-1.5 1.5-3 2-3 1-3 2 1.5 2 3 2 3-1 3-2" {...p} />
        </>
      );
    case 'bill':
      return (
        <>
          <path d="M2 6c1 0 2 1 3 1s2-1 3-1 2 1 3 1 2-1 3-1 2 1 3 1 2-1 3-1v12c-1 0-2 1-3 1s-2-1-3-1-2 1-3 1-2-1-3-1-2 1-3 1-2-1-3-1V6z" {...p} />
          <path d="M7 11h10" {...pThin} />
          <path d="M7 14h6" {...pThin} />
        </>
      );
    case 'payment':
      return (
        <>
          <rect x="2" y="5" width="20" height="14" rx="2" {...p} />
          <path d="M2 10h20" {...p} />
          <path d="M6 15h4" {...pThin} />
        </>
      );
    case 'withdraw':
      return (
        <>
          <rect x="3" y="6" width="18" height="12" rx="2" {...p} />
          <path d="M12 10v6" {...p} />
          <path d="M9 13l3 3 3-3" {...p} />
          <path d="M7 2h10" {...pThin} />
        </>
      );
    case 'deposit':
      return (
        <>
          <rect x="3" y="6" width="18" height="12" rx="2" {...p} />
          <path d="M12 16v-6" {...p} />
          <path d="M9 13l3-3 3 3" {...p} />
          <path d="M7 22h10" {...pThin} />
        </>
      );
    case 'transfer':
      return (
        <>
          <path d="M4 8h14" {...p} />
          <path d="M14 4l4 4-4 4" {...p} />
          <path d="M20 16H6" {...p} />
          <path d="M10 12l-4 4 4 4" {...p} />
        </>
      );
    case 'savings':
      return (
        <>
          <path d="M19 10c0-4-3-7-7-7S5 6 5 10c0 2.5 1 4.5 3 6v3a1 1 0 001 1h6a1 1 0 001-1v-3c2-1.5 3-3.5 3-6z" {...p} />
          <path d="M9 20h6" {...pThin} />
          <path d="M12 7v5" {...pThin} />
          <path d="M10 10h4" {...pThin} />
        </>
      );
    case 'vault':
      return (
        <>
          <rect x="3" y="5" width="18" height="14" rx="3" {...p} />
          <circle cx="12" cy="12" r="4" {...p} />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <path d="M21 9h-1" {...pThin} />
          <path d="M21 15h-1" {...pThin} />
        </>
      );
    case 'lock':
      return (
        <>
          <rect x="5" y="11" width="14" height="10" rx="2" {...p} />
          <path d="M8 11V7a4 4 0 018 0v4" {...p} />
          <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
        </>
      );
    case 'calendar-finance':
      return (
        <>
          <rect x="3" y="4" width="18" height="17" rx="2" {...p} />
          <path d="M3 9h18" {...p} />
          <path d="M8 2v4" {...p} />
          <path d="M16 2v4" {...p} />
          <path d="M12 13v4" {...pThin} />
          <path d="M10 15h4" {...pThin} />
        </>
      );

    // ═══════════════════════════════════════════
    // TONTINE
    // ═══════════════════════════════════════════
    case 'tontine-circle':
      return (
        <>
          <circle cx="12" cy="12" r="9" {...p} />
          <circle cx="12" cy="8" r="2" {...pThin} />
          <circle cx="7.5" cy="15" r="1.5" {...pThin} />
          <circle cx="16.5" cy="15" r="1.5" {...pThin} />
          <path d="M8 11l4-1 4 1" {...pThin} />
          <path d="M8 17l4 1 4-1" {...pThin} />
        </>
      );
    case 'members':
      return (
        <>
          <circle cx="9" cy="7" r="3" {...p} />
          <path d="M2 20c0-3.5 3-6 7-6" {...p} />
          <circle cx="17" cy="9" r="2.5" {...p} />
          <path d="M22 20c0-3 -2-5-5-5" {...p} />
          <path d="M12 20c0-2 1-3 2-4" {...pThin} />
        </>
      );
    case 'cotisation':
      return (
        <>
          <circle cx="12" cy="12" r="9" {...p} />
          <path d="M12 7v5l3 3" {...p} />
          <path d="M16 8l2-2" {...pThin} />
        </>
      );
    case 'distribution':
      return (
        <>
          <circle cx="12" cy="12" r="3" {...p} />
          <path d="M12 3v3" {...p} />
          <path d="M12 18v3" {...p} />
          <path d="M3 12h3" {...p} />
          <path d="M18 12h3" {...p} />
          <path d="M5.6 5.6l2.2 2.2" {...pThin} />
          <path d="M16.2 16.2l2.2 2.2" {...pThin} />
          <path d="M5.6 18.4l2.2-2.2" {...pThin} />
          <path d="M16.2 7.8l2.2-2.2" {...pThin} />
        </>
      );
    case 'tour':
      return (
        <>
          <path d="M12 3a9 9 0 110 18 9 9 0 010-18" {...p} />
          <path d="M12 7v5l3.5 2" {...p} />
        </>
      );
    case 'contribution':
      return (
        <>
          <path d="M12 2v6" {...p} />
          <path d="M9 5l3 3 3-3" {...p} />
          <rect x="4" y="10" width="16" height="10" rx="2" {...p} />
          <path d="M12 14v3" {...pThin} />
          <path d="M10.5 15.5h3" {...pThin} />
        </>
      );
    case 'penalty':
      return (
        <>
          <path d="M12 3L2 20h20L12 3z" {...p} />
          <path d="M12 9v4" {...p} />
          <circle cx="12" cy="16" r="0.8" fill="currentColor" stroke="none" />
        </>
      );
    case 'trust':
      return (
        <>
          <path d="M12 2l3 3h4v4l3 3-3 3v4h-4l-3 3-3-3H5v-4L2 12l3-3V5h4l3-3z" {...p} />
          <path d="M9 12l2 2 4-4" {...p} />
        </>
      );
    case 'invitation':
      return (
        <>
          <rect x="2" y="5" width="20" height="14" rx="2" {...p} />
          <path d="M2 5l10 7 10-7" {...p} />
          <path d="M17 12v5" {...pThin} />
          <path d="M14.5 14.5h5" {...pThin} />
        </>
      );
    case 'qr-code':
      return (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1" {...p} />
          <rect x="14" y="3" width="7" height="7" rx="1" {...p} />
          <rect x="3" y="14" width="7" height="7" rx="1" {...p} />
          <rect x="14" y="14" width="3" height="3" rx="0.5" {...pThin} />
          <rect x="18" y="18" width="3" height="3" rx="0.5" {...pThin} />
          <path d="M14 18h3" {...pThin} />
          <path d="M18 14v3" {...pThin} />
        </>
      );
    case 'code':
      return (
        <>
          <path d="M7 8l-4 4 4 4" {...p} />
          <path d="M17 8l4 4-4 4" {...p} />
          <path d="M14 4l-4 16" {...pThin} />
        </>
      );
    case 'share':
      return (
        <>
          <circle cx="6" cy="12" r="2.5" {...p} />
          <circle cx="18" cy="6" r="2.5" {...p} />
          <circle cx="18" cy="18" r="2.5" {...p} />
          <path d="M8.5 10.8L15.5 7.2" {...pThin} />
          <path d="M8.5 13.2L15.5 16.8" {...pThin} />
        </>
      );

    // ═══════════════════════════════════════════
    // COMMUNICATION
    // ═══════════════════════════════════════════
    case 'message':
      return (
        <>
          <path d="M4 4h16a2 2 0 012 2v10a2 2 0 01-2 2H8l-4 4V6a2 2 0 012-2z" {...p} />
          <path d="M8 10h8" {...pThin} />
          <path d="M8 13h5" {...pThin} />
        </>
      );
    case 'notification':
      return (
        <>
          <path d="M6 8a6 6 0 0112 0c0 4 2 6 2 6H4s2-2 2-6" {...p} />
          <path d="M10 18a2 2 0 004 0" {...p} />
          <circle cx="17" cy="5" r="3" fill="currentColor" stroke="none" opacity="0.6" />
        </>
      );
    case 'bell':
      return (
        <>
          <path d="M6 8a6 6 0 0112 0c0 4 2 6 2 6H4s2-2 2-6" {...p} />
          <path d="M10 18a2 2 0 004 0" {...p} />
        </>
      );
    case 'chat':
      return (
        <>
          <path d="M21 12c0 4-4 7.5-9 7.5-1.5 0-3-.3-4.2-.8L3 20l1.3-3.8C3 14.8 3 13.5 3 12c0-4 4-7.5 9-7.5s9 3.5 9 7.5z" {...p} />
          <path d="M8 11h0" {...p} />
          <path d="M12 11h0" {...p} />
          <path d="M16 11h0" {...p} />
        </>
      );
    case 'call':
      return (
        <>
          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2C10 21 3 14 3 6a2 2 0 012-2" {...p} />
        </>
      );
    case 'support':
      return (
        <>
          <circle cx="12" cy="12" r="9" {...p} />
          <path d="M9 9a3 3 0 015 1c0 2-3 2-3 4" {...p} />
          <circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" />
        </>
      );

    // ═══════════════════════════════════════════
    // DOCUMENTS
    // ═══════════════════════════════════════════
    case 'document':
      return (
        <>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" {...p} />
          <path d="M14 2v6h6" {...p} />
          <path d="M8 13h8" {...pThin} />
          <path d="M8 17h5" {...pThin} />
        </>
      );
    case 'contract':
      return (
        <>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" {...p} />
          <path d="M14 2v6h6" {...p} />
          <path d="M8 13l2 2 4-4" {...p} />
        </>
      );
    case 'status-doc':
      return (
        <>
          <path d="M9 2H5a2 2 0 00-2 2v16a2 2 0 002 2h14a2 2 0 002-2V8l-6-6h-6z" {...p} />
          <path d="M15 2v6h6" {...p} />
          <circle cx="12" cy="14" r="3" {...p} />
        </>
      );
    case 'receipt':
      return (
        <>
          <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2H4z" {...p} />
          <path d="M8 8h8" {...pThin} />
          <path d="M8 12h8" {...pThin} />
          <path d="M8 16h4" {...pThin} />
        </>
      );
    case 'download':
      return (
        <>
          <path d="M12 3v12" {...p} />
          <path d="M8 11l4 4 4-4" {...p} />
          <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" {...p} />
        </>
      );
    case 'share-doc':
      return (
        <>
          <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" {...p} />
          <path d="M12 15V3" {...p} />
          <path d="M8 7l4-4 4 4" {...p} />
        </>
      );

    // ═══════════════════════════════════════════
    // PROFILE
    // ═══════════════════════════════════════════
    case 'user':
      return (
        <>
          <circle cx="12" cy="8" r="4" {...p} />
          <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" {...p} />
        </>
      );
    case 'security':
      return (
        <>
          <path d="M12 2l8 4v5c0 5.5-3.5 10-8 12-4.5-2-8-6.5-8-12V6l8-4z" {...p} />
          <path d="M9 12l2 2 4-4" {...p} />
        </>
      );
    case 'biometric':
      return (
        <>
          <path d="M2 12C2 6.5 6.5 2 12 2" {...p} />
          <path d="M22 12c0 5.5-4.5 10-10 10" {...p} />
          <path d="M7 12a5 5 0 0110 0" {...p} />
          <path d="M12 12a2 2 0 010 4" {...pThin} />
          <path d="M12 7v1" {...pThin} />
        </>
      );
    case 'language':
      return (
        <>
          <circle cx="12" cy="12" r="9" {...p} />
          <path d="M3 12h18" {...pThin} />
          <path d="M12 3c-2 3-3 6-3 9s1 6 3 9" {...p} />
          <path d="M12 3c2 3 3 6 3 9s-1 6-3 9" {...p} />
        </>
      );
    case 'settings':
      return (
        <>
          <circle cx="12" cy="12" r="3" {...p} />
          <path d="M12 2v2" {...p} />
          <path d="M12 20v2" {...p} />
          <path d="M4.9 4.9l1.4 1.4" {...p} />
          <path d="M17.7 17.7l1.4 1.4" {...p} />
          <path d="M2 12h2" {...p} />
          <path d="M20 12h2" {...p} />
          <path d="M4.9 19.1l1.4-1.4" {...p} />
          <path d="M17.7 6.3l1.4-1.4" {...p} />
        </>
      );
    case 'help':
      return (
        <>
          <circle cx="12" cy="12" r="9" {...p} />
          <path d="M9 9a3 3 0 015 1c0 2-3 2-3 4" {...p} />
          <circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" />
        </>
      );
    case 'logout':
      return (
        <>
          <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" {...p} />
          <path d="M10 17l-5-5 5-5" {...p} />
          <path d="M5 12h12" {...p} />
        </>
      );

    // ═══════════════════════════════════════════
    // STATES
    // ═══════════════════════════════════════════
    case 'success':
      return (
        <>
          <circle cx="12" cy="12" r="9" {...p} />
          <path d="M8 12l3 3 5-6" {...p} />
        </>
      );
    case 'error':
      return (
        <>
          <circle cx="12" cy="12" r="9" {...p} />
          <path d="M15 9l-6 6" {...p} />
          <path d="M9 9l6 6" {...p} />
        </>
      );
    case 'warning':
      return (
        <>
          <path d="M12 3L2 20h20L12 3z" {...p} />
          <path d="M12 9v4" {...p} />
          <circle cx="12" cy="16" r="0.8" fill="currentColor" stroke="none" />
        </>
      );
    case 'info':
      return (
        <>
          <circle cx="12" cy="12" r="9" {...p} />
          <path d="M12 11v5" {...p} />
          <circle cx="12" cy="8" r="0.8" fill="currentColor" stroke="none" />
        </>
      );
    case 'locked':
      return (
        <>
          <rect x="5" y="11" width="14" height="10" rx="2" {...p} />
          <path d="M8 11V7a4 4 0 018 0v4" {...p} />
          <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
        </>
      );
    case 'completed':
      return (
        <>
          <circle cx="12" cy="12" r="9" {...p} />
          <path d="M8 12l3 3 5-6" {...p} />
        </>
      );
    case 'pending':
      return (
        <>
          <circle cx="12" cy="12" r="9" {...p} />
          <path d="M12 7v5l3 3" {...p} />
        </>
      );
    case 'late':
      return (
        <>
          <circle cx="12" cy="12" r="9" {...p} />
          <path d="M12 7v5l3 3" {...p} />
          <path d="M17.5 3.5l2 2" {...pThin} />
          <path d="M4.5 3.5l2 2" {...pThin} />
        </>
      );

    // ═══════════════════════════════════════════
    // SAVINGS GOALS
    // ═══════════════════════════════════════════
    case 'project':
      return (
        <>
          <polygon points="12,2 15,9 22,9 16.5,13.5 18.5,21 12,16.5 5.5,21 7.5,13.5 2,9 9,9" {...p} />
        </>
      );
    case 'house':
      return (
        <>
          <path d="M3 11l9-8 9 8" {...p} />
          <path d="M5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9" {...p} />
          <rect x="9" y="14" width="6" height="6" rx="0.5" {...p} />
        </>
      );
    case 'studies':
      return (
        <>
          <path d="M2 10l10-5 10 5-10 5-10-5z" {...p} />
          <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" {...p} />
          <path d="M22 10v6" {...p} />
        </>
      );
    case 'travel':
      return (
        <>
          <rect x="4" y="8" width="16" height="12" rx="2" {...p} />
          <path d="M8 8V6a4 4 0 018 0v2" {...p} />
          <path d="M4 13h16" {...pThin} />
          <circle cx="12" cy="15" r="1.5" {...pThin} />
        </>
      );
    case 'family':
      return (
        <>
          <circle cx="8" cy="6" r="2.5" {...p} />
          <circle cx="16" cy="6" r="2.5" {...p} />
          <path d="M3 18c0-3 2-5 5-5" {...p} />
          <path d="M21 18c0-3-2-5-5-5" {...p} />
          <circle cx="12" cy="13" r="2" {...pThin} />
          <path d="M8 20c0-2 1.5-3 4-3s4 1 4 3" {...pThin} />
        </>
      );
    case 'emergency':
      return (
        <>
          <path d="M12 2l8 4v5c0 5.5-3.5 10-8 12-4.5-2-8-6.5-8-12V6l8-4z" {...p} />
          <path d="M12 8v4" {...p} />
          <circle cx="12" cy="15" r="0.8" fill="currentColor" stroke="none" />
        </>
      );
    case 'health':
      return (
        <>
          <path d="M12 20l-7-7a4.5 4.5 0 010-6.4 4.5 4.5 0 016.4 0L12 7.2l.6-.6a4.5 4.5 0 016.4 0 4.5 4.5 0 010 6.4L12 20z" {...p} />
          <path d="M10 12h4" {...pThin} />
          <path d="M12 10v4" {...pThin} />
        </>
      );
    case 'goal':
      return (
        <>
          <circle cx="12" cy="12" r="9" {...p} />
          <circle cx="12" cy="12" r="5" {...pThin} />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
        </>
      );
    case 'gift':
      return (
        <>
          <rect x="3" y="10" width="18" height="11" rx="2" {...p} />
          <path d="M12 10v11" {...p} />
          <path d="M3 14h18" {...pThin} />
          <path d="M7.5 10C6 10 5 8.5 5 7.5S6 5 7.5 5 10 6 10 7.5" {...p} />
          <path d="M16.5 10C18 10 19 8.5 19 7.5S18 5 16.5 5 14 6 14 7.5" {...p} />
        </>
      );
    case 'investment':
      return (
        <>
          <path d="M3 20l5-6 4 3 5-7 4 3" {...p} />
          <path d="M17 10h4v4" {...p} />
          <path d="M3 20h18" {...pThin} />
        </>
      );

    // ═══════════════════════════════════════════
    // EXTRAS
    // ═══════════════════════════════════════════
    case 'search':
      return (
        <>
          <circle cx="11" cy="11" r="7" {...p} />
          <path d="M16 16l5 5" {...p} />
        </>
      );
    case 'close':
      return (
        <>
          <path d="M18 6L6 18" {...p} />
          <path d="M6 6l12 12" {...p} />
        </>
      );
    case 'chevron-right':
      return <path d="M9 6l6 6-6 6" {...p} />;
    case 'chevron-left':
      return <path d="M15 6l-6 6 6 6" {...p} />;
    case 'plus':
      return (
        <>
          <path d="M12 5v14" {...p} />
          <path d="M5 12h14" {...p} />
        </>
      );
    case 'arrow-up':
      return (
        <>
          <path d="M12 19V5" {...p} />
          <path d="M5 12l7-7 7 7" {...p} />
        </>
      );
    case 'arrow-down':
      return (
        <>
          <path d="M12 5v14" {...p} />
          <path d="M19 12l-7 7-7-7" {...p} />
        </>
      );
    case 'eye':
      return (
        <>
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" {...p} />
          <circle cx="12" cy="12" r="3" {...p} />
        </>
      );
    case 'eye-off':
      return (
        <>
          <path d="M2 2l20 20" {...p} />
          <path d="M6.7 6.7C4.3 8.5 2 12 2 12s3 7 10 7c2.1 0 3.9-.6 5.3-1.5" {...p} />
          <path d="M17.3 17.3C19.7 15.5 22 12 22 12s-3-7-10-7c-2.1 0-3.9.6-5.3 1.5" {...p} />
        </>
      );
    case 'refresh':
      return (
        <>
          <path d="M4 12a8 8 0 0114-5.3V4" {...p} />
          <path d="M20 12a8 8 0 01-14 5.3V20" {...p} />
          <path d="M18 3v4h-4" {...p} />
          <path d="M6 21v-4h4" {...p} />
        </>
      );
    case 'star':
      return (
        <>
          <polygon points="12,2 15,9 22,9 16.5,13.5 18.5,21 12,16.5 5.5,21 7.5,13.5 2,9 9,9" {...p} />
        </>
      );
    case 'shield':
      return (
        <>
          <path d="M12 2l8 4v5c0 5.5-3.5 10-8 12-4.5-2-8-6.5-8-12V6l8-4z" {...p} />
        </>
      );
    case 'check':
      return <path d="M5 12l5 5L20 7" {...p} />;
    case 'loading':
      return (
        <path
          d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"
          {...p}
        />
      );
    case 'send':
      return <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" {...p} />;
    case 'camera':
      return (
        <>
          <path d="M4 8a2 2 0 012-2h1.2l1-1.6A1.5 1.5 0 019.5 3.6h5a1.5 1.5 0 011.3.8L17 6h1a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V8z" {...p} />
          <circle cx="12" cy="13" r="3.5" {...p} />
        </>
      );
    case 'trash':
      return (
        <>
          <path d="M3 6h18" {...p} />
          <path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v13a2 2 0 01-2 2H8a2 2 0 01-2-2V6h12z" {...p} />
          <path d="M10 11v5M14 11v5" {...pThin} />
        </>
      );
    case 'copy':
      return (
        <>
          <rect x="9" y="9" width="12" height="12" rx="2" {...p} />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" {...p} />
        </>
      );
    case 'shuffle':
      return (
        <>
          <path d="M2 6h4l10 12h6" {...p} />
          <path d="M18 6h4v4M2 18h4l3.5-4.2" {...p} />
          <path d="M18 18h4v-4" {...p} />
        </>
      );
    case 'list':
      return (
        <>
          <path d="M8 6h13M8 12h13M8 18h13" {...p} />
          <path d="M3 6h.01M3 12h.01M3 18h.01" {...p} />
        </>
      );
    case 'key':
      return (
        <>
          <circle cx="7" cy="15" r="4" {...p} />
          <path d="M10 12l9-9m0 0h-4m4 0v4m-8 4l3 3" {...p} />
        </>
      );
    case 'fingerprint':
      return (
        <>
          <path d="M12 3a7 7 0 00-7 7c0 3.5.5 6.5 2 9" {...pThin} />
          <path d="M12 3a7 7 0 017 7c0 1.5-.1 2.9-.4 4.2" {...pThin} />
          <path d="M8 20c-1.2-2-2-5-2-8a6 6 0 0112 0c0 1 0 2-.2 3" {...p} />
          <path d="M12 10a3 3 0 013 3c0 2.5-.6 4.7-1.6 6.5" {...pThin} />
          <path d="M9 13a3 3 0 016 0" {...pThin} />
        </>
      );
    case 'globe':
      return (
        <>
          <circle cx="12" cy="12" r="9" {...p} />
          <path d="M3 12h18" {...p} />
          <path d="M12 3a14 14 0 010 18 14 14 0 010-18z" {...p} />
        </>
      );

    default:
      // Fallback: simple circle
      return <circle cx="12" cy="12" r="9" {...p} />;
  }
}

export function EganyeIcon({
  name,
  size = 24,
  className = '',
  strokeWidth = 1.8,
  'aria-label': ariaLabel,
}: EganyeIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel}
      role={ariaLabel ? 'img' : 'presentation'}
    >
      {getPath(name, strokeWidth)}
    </svg>
  );
}
