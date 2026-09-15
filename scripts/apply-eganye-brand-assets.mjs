import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const C = {
  terra: '#C96F4A',
  terraDark: '#A85638',
  olive: '#718A68',
  oliveDark: '#536E4D',
  cream: '#F8F0E4',
  beige: '#EFE2D0',
  brown: '#3E2F24',
  gold: '#C49A55',
  white: '#FFF9F0',
};

const dirs = [
  'public',
  'public/icons',
  'public/avatars',
  'public/brand-avatars',
  'src/assets/brand',
  'src/assets/avatars',
  'src/assets/brand-avatars',
];

// Final identity direction: sober fintech monogram, not a mascot mark.
function logoDefs() {
  return `<defs>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="150%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#6C3A28" flood-opacity=".14"/>
    </filter>
    <linearGradient id="markTerracotta" x1="10" y1="9" x2="55" y2="57" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.terra}"/>
      <stop offset="1" stop-color="${C.terraDark}"/>
    </linearGradient>
  </defs>`;
}

function markGroup({ white = false, shadow = true } = {}) {
  const primary = white ? C.white : 'url(#markTerracotta)';
  const olive = white ? C.white : C.olive;
  const gold = white ? '#FFE6A9' : C.gold;
  const paper = white ? 'rgba(255,255,255,.14)' : C.cream;
  const ring = white ? 'rgba(255,255,255,.36)' : C.beige;
  const coinLine = white ? C.brown : C.white;

  return `<g${shadow ? ' filter="url(#softShadow)"' : ''}>
    <circle cx="32" cy="32" r="29" fill="${paper}"/>
    <circle cx="32" cy="32" r="27" fill="none" stroke="${ring}" stroke-width="2"/>
    <path d="M47.8 13.8C42.6 9.7 35.2 8.1 28 9.6C17.2 11.9 10 21.2 10 32C10 44.7 19.8 55 32 55C39.5 55 46 51.4 50.1 45.9" fill="none" stroke="${primary}" stroke-width="6.5" stroke-linecap="round"/>
    <path d="M17.5 24.2H46.5" stroke="${primary}" stroke-width="6.5" stroke-linecap="round"/>
    <path d="M17.5 32.8H40.5" stroke="${olive}" stroke-width="6.5" stroke-linecap="round"/>
    <path d="M21.8 42.1H48" stroke="${primary}" stroke-width="6.5" stroke-linecap="round"/>
    <circle cx="48" cy="32.8" r="7.4" fill="${gold}" stroke="${white ? C.white : '#FFFDFC'}" stroke-width="2.4"/>
    <path d="M44.9 32.8h6.2" stroke="${coinLine}" stroke-width="2" stroke-linecap="round" opacity=".9"/>
  </g>`;
}

function logoMarkSvg({ white = false } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Eganyé">
  ${logoDefs()}
  ${markGroup({ white })}
</svg>`;
}

function logoFullSvg({ dark = false, white = false, compact = false } = {}) {
  const w = compact ? 256 : 520;
  const bg = dark ? C.brown : 'none';
  const text = white || dark ? C.white : C.brown;
  const sub = white || dark ? '#F4E7D5' : '#715C4B';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="112" viewBox="0 0 ${w} 112" role="img" aria-label="Eganyé">
  ${logoDefs()}
  ${bg !== 'none' ? `<rect width="${w}" height="112" rx="18" fill="${bg}"/>` : ''}
  <g transform="translate(18 24)">${markGroup({ white: white || dark, shadow: false })}</g>
  <g font-family="Nunito, Arial Rounded MT Bold, Trebuchet MS, Arial, sans-serif">
    <text x="96" y="55" font-size="${compact ? 38 : 46}" font-weight="900" fill="${text}" letter-spacing="0">Eganyé</text>
    ${compact ? '' : `<text x="99" y="82" font-size="17" font-weight="800" fill="${sub}" letter-spacing="0">Épargne collective simple et fiable</text>`}
    <rect x="99" y="${compact ? 78 : 92}" width="${compact ? 94 : 200}" height="6" rx="3" fill="${white || dark ? C.white : C.terra}" opacity="${white || dark ? '.92' : '1'}"/>
    <rect x="${compact ? 202 : 314}" y="${compact ? 78 : 92}" width="${compact ? 34 : 52}" height="6" rx="3" fill="${white || dark ? C.white : C.olive}" opacity="${white || dark ? '.72' : '1'}"/>
    <rect x="${compact ? 244 : 378}" y="${compact ? 78 : 92}" width="${compact ? 24 : 36}" height="6" rx="3" fill="${white || dark ? C.white : C.gold}" opacity="${white || dark ? '.55' : '1'}"/>
  </g>
</svg>`;
}

function wordmarkSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64" role="img" aria-label="Eganyé">
  <text x="0" y="46" font-family="Nunito, Arial Rounded MT Bold, Trebuchet MS, Arial, sans-serif" font-size="48" font-weight="900" fill="${C.brown}" letter-spacing="0">Eganyé</text>
</svg>`;
}

function appIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="Eganyé">
  <defs>
    <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="3"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .08"/></feComponentTransfer></filter>
    <filter id="iconShadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="28" stdDeviation="24" flood-color="#6C3A28" flood-opacity=".22"/></filter>
    <linearGradient id="markTerracotta" x1="10" y1="9" x2="55" y2="57" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.terra}"/><stop offset="1" stop-color="${C.terraDark}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="${C.cream}"/>
  <rect width="512" height="512" filter="url(#paper)" opacity=".5"/>
  <g transform="translate(96 96) scale(5)">
    ${markGroup({ shadow: false })}
  </g>
</svg>`;
}

const skin = ['#8E5738', '#6F432D', '#AF6B45', '#7E5037', '#B87954', '#5F3B2D'];
const shirts = [C.terra, C.olive, C.gold, '#9B6A4A', '#DFA272', '#5F7556'];
const hair = ['#3E2F24', '#2E2118', '#4B3325'];

function avatarSvg(i) {
  const s = skin[i % skin.length];
  const shirt = shirts[(i + 2) % shirts.length];
  const h = hair[i % hair.length];
  const bg = i % 3 === 0 ? C.beige : i % 3 === 1 ? '#F4E7D5' : '#E9E0CF';
  const isFemale = i % 2 === 0;
  const headY = isFemale ? 28 : 30;
  const hairShape = isFemale
    ? `<path d="M19 30c0-11 7-18 17-18s17 7 17 18c-7-5-23-5-34 0z" fill="${h}"/>`
    : `<path d="M20 23c4-9 25-11 31 1-8-2-21-2-31-1z" fill="${h}"/>`;
  const extra = i % 4 === 0
    ? `<circle cx="46" cy="22" r="5" fill="${C.gold}"/>`
    : i % 4 === 1
      ? `<path d="M17 43c6 4 32 4 38 0" fill="none" stroke="${C.gold}" stroke-width="3" stroke-linecap="round"/>`
      : i % 4 === 2
        ? `<path d="M18 20c10-10 27-10 38 2" fill="none" stroke="${C.olive}" stroke-width="5" stroke-linecap="round"/>`
        : `<path d="M22 50c8 7 23 7 31 0" fill="none" stroke="${C.terra}" stroke-width="4" stroke-linecap="round"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 72 72" role="img" aria-label="Avatar Eganyé ${i + 1}">
  <defs>
    <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .06"/></feComponentTransfer></filter>
  </defs>
  <circle cx="36" cy="36" r="34" fill="${bg}"/>
  <circle cx="36" cy="36" r="34" filter="url(#paper)" opacity=".8"/>
  ${extra}
  <path d="M14 66c3-19 41-19 44 0" fill="${shirt}"/>
  <path d="M20 63c8-9 24-9 32 0" fill="${C.white}" opacity=".22"/>
  ${hairShape}
  <circle cx="36" cy="${headY}" r="13" fill="${s}"/>
  <path d="M29 35c4 4 10 4 14 0" fill="none" stroke="${C.brown}" stroke-width="2.4" stroke-linecap="round" opacity=".78"/>
  <circle cx="31" cy="29" r="1.4" fill="${C.brown}"/>
  <circle cx="41" cy="29" r="1.4" fill="${C.brown}"/>
  <path d="M24 18c7-10 23-8 29 2-10-3-19-2-29 2z" fill="${h}" opacity=".92"/>
</svg>`;
}

const BRAND_AVATAR_CONFIG = {
  onboarding: { skin: '#8E5738', shirt: C.terra, bg: '#F4E7D5', expression: 'smile', prop: 'group' },
  loading: { skin: '#7E5037', shirt: C.terra, bg: '#F4E7D5', expression: 'focus', prop: 'coin' },
  success: { skin: '#8E5738', shirt: C.olive, bg: '#E7EDE3', expression: 'joy', prop: 'check' },
  payment: { skin: '#6F432D', shirt: C.terra, bg: '#F4E7D5', expression: 'wink', prop: 'phone' },
  saving: { skin: '#AF6B45', shirt: C.olive, bg: '#E7EDE3', expression: 'smile', prop: 'vault' },
  security: { skin: '#7E5037', shirt: C.brown, bg: '#EFE2D0', expression: 'calm', prop: 'shield' },
  empty: { skin: '#B87954', shirt: C.olive, bg: '#F4E7D5', expression: 'curious', prop: 'search' },
  circle: { skin: '#8E5738', shirt: C.terra, bg: '#F4E7D5', expression: 'smile', prop: 'people' },
  activity: { skin: '#AF6B45', shirt: C.gold, bg: '#F4E7D5', expression: 'focus', prop: 'list' },
  bank: { skin: '#6F432D', shirt: C.olive, bg: '#E7EDE3', expression: 'smile', prop: 'vault' },
  chat: { skin: '#B87954', shirt: C.terra, bg: '#F4E7D5', expression: 'joy', prop: 'bubble' },
  profile: { skin: '#8E5738', shirt: C.olive, bg: '#E7EDE3', expression: 'smile', prop: 'badge' },
  error: { skin: '#7E5037', shirt: C.terraDark, bg: '#F6DFD4', expression: 'concern', prop: 'alert' },
  offline: { skin: '#AF6B45', shirt: C.brown, bg: '#EFE2D0', expression: 'concern', prop: 'offline' },
};

function expressionSvg(type) {
  if (type === 'joy') {
    return `<path d="M54 72c4-6 11-6 15 0M78 72c4-6 11-6 15 0" fill="none" stroke="${C.brown}" stroke-width="5" stroke-linecap="round"/>
    <path d="M61 84c7 10 24 10 31 0" fill="none" stroke="${C.brown}" stroke-width="5" stroke-linecap="round"/>`;
  }
  if (type === 'wink') {
    return `<circle cx="61" cy="70" r="4" fill="${C.brown}"/>
    <path d="M78 72c5-5 11-5 16 0" fill="none" stroke="${C.brown}" stroke-width="5" stroke-linecap="round"/>
    <path d="M64 84c6 7 18 7 24 0" fill="none" stroke="${C.brown}" stroke-width="5" stroke-linecap="round"/>`;
  }
  if (type === 'curious') {
    return `<circle cx="61" cy="70" r="4" fill="${C.brown}"/><circle cx="86" cy="70" r="4" fill="${C.brown}"/>
    <circle cx="74" cy="85" r="4" fill="none" stroke="${C.brown}" stroke-width="4"/>`;
  }
  if (type === 'concern') {
    return `<circle cx="61" cy="72" r="4" fill="${C.brown}"/><circle cx="86" cy="72" r="4" fill="${C.brown}"/>
    <path d="M63 88c8-5 17-5 25 0" fill="none" stroke="${C.brown}" stroke-width="4" stroke-linecap="round"/>`;
  }
  if (type === 'focus') {
    return `<circle cx="61" cy="70" r="4" fill="${C.brown}"/><circle cx="86" cy="70" r="4" fill="${C.brown}"/>
    <path d="M65 84h20" fill="none" stroke="${C.brown}" stroke-width="4" stroke-linecap="round"/>`;
  }
  return `<circle cx="61" cy="70" r="4" fill="${C.brown}"/><circle cx="86" cy="70" r="4" fill="${C.brown}"/>
  <path d="M64 84c6 7 18 7 24 0" fill="none" stroke="${C.brown}" stroke-width="5" stroke-linecap="round"/>`;
}

function propSvg(prop) {
  if (prop === 'coin') return `<circle cx="104" cy="31" r="15" fill="${C.gold}" stroke="${C.white}" stroke-width="5"/><text x="104" y="37" text-anchor="middle" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-size="16" font-weight="900" fill="${C.white}">E</text>`;
  if (prop === 'check') return `<circle cx="105" cy="35" r="17" fill="${C.olive}" stroke="${C.white}" stroke-width="5"/><path d="M96 35l6 6 12-14" fill="none" stroke="${C.white}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (prop === 'phone') return `<rect x="91" y="98" width="28" height="43" rx="7" fill="${C.brown}" stroke="${C.white}" stroke-width="4"/><rect x="98" y="108" width="14" height="14" rx="3" fill="${C.olive}"/><circle cx="105" cy="133" r="3" fill="${C.gold}"/>`;
  if (prop === 'vault') return `<rect x="88" y="99" width="42" height="33" rx="10" fill="${C.white}" stroke="${C.olive}" stroke-width="5"/><circle cx="109" cy="116" r="9" fill="none" stroke="${C.olive}" stroke-width="4"/><path d="M109 107v18M100 116h18" stroke="${C.olive}" stroke-width="3" stroke-linecap="round"/>`;
  if (prop === 'shield') return `<path d="M105 94l25 10v22c0 16-25 27-25 27s-25-11-25-27v-22z" fill="${C.gold}" stroke="${C.white}" stroke-width="5"/><circle cx="105" cy="121" r="5" fill="${C.brown}"/><path d="M103 126l-3 12h10l-3-12z" fill="${C.brown}"/>`;
  if (prop === 'search') return `<circle cx="108" cy="109" r="16" fill="${C.white}" stroke="${C.terra}" stroke-width="5"/><path d="M119 121l16 16" stroke="${C.terraDark}" stroke-width="7" stroke-linecap="round"/>`;
  if (prop === 'people') return `<circle cx="25" cy="115" r="12" fill="#AF6B45"/><circle cx="131" cy="115" r="12" fill="#6F432D"/><path d="M7 152c4-18 31-18 36 0M113 152c4-18 31-18 36 0" fill="${C.olive}" opacity=".95"/>`;
  if (prop === 'list') return `<rect x="90" y="95" width="42" height="50" rx="10" fill="${C.white}" stroke="${C.gold}" stroke-width="5"/><path d="M101 111h19M101 124h19M101 137h12" stroke="${C.brown}" stroke-width="4" stroke-linecap="round"/>`;
  if (prop === 'bubble') return `<path d="M88 94h50v34h-26l-14 12v-12H88z" fill="${C.white}" stroke="${C.terra}" stroke-width="5" stroke-linejoin="round"/><circle cx="106" cy="111" r="3" fill="${C.terra}"/><circle cx="119" cy="111" r="3" fill="${C.terra}"/>`;
  if (prop === 'badge') return `<circle cx="107" cy="108" r="20" fill="${C.white}" stroke="${C.olive}" stroke-width="5"/><path d="M97 108l7 7 14-16" fill="none" stroke="${C.olive}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (prop === 'alert') return `<path d="M106 95l29 51H77z" fill="${C.white}" stroke="${C.terraDark}" stroke-width="5" stroke-linejoin="round"/><path d="M106 111v17" stroke="${C.terraDark}" stroke-width="5" stroke-linecap="round"/><circle cx="106" cy="137" r="3.8" fill="${C.terraDark}"/>`;
  if (prop === 'offline') return `<circle cx="109" cy="111" r="25" fill="${C.white}" stroke="${C.brown}" stroke-width="5"/><path d="M93 109c10-8 22-8 32 0M100 119c6-4 12-4 18 0M88 91l42 42" stroke="${C.brown}" stroke-width="5" stroke-linecap="round"/>`;
  if (prop === 'group') return `<circle cx="27" cy="112" r="12" fill="#AF6B45"/><circle cx="126" cy="112" r="12" fill="#6F432D"/><path d="M9 150c4-18 31-18 36 0M108 150c4-18 31-18 36 0" fill="${C.olive}"/><path d="M24 135c22 19 75 18 98-1" fill="none" stroke="${C.gold}" stroke-width="7" stroke-linecap="round"/>`;
  return '';
}

function brandAvatarSvg(name, cfg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 160 160" role="img" aria-label="Ganye ${name}">
  <defs>
    <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .055"/></feComponentTransfer></filter>
    <filter id="soft"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#6C3A28" flood-opacity=".16"/></filter>
  </defs>
  <circle cx="80" cy="80" r="72" fill="${cfg.bg}"/>
  <circle cx="80" cy="80" r="72" filter="url(#paper)" opacity=".85"/>
  ${propSvg(cfg.prop)}
  <g filter="url(#soft)">
    <path d="M35 155c5-35 85-35 90 0z" fill="${cfg.shirt}"/>
    <path d="M61 112l19 17 19-17v27H61z" fill="${C.white}" opacity=".24"/>
    <rect x="67" y="96" width="25" height="25" rx="8" fill="${cfg.skin}"/>
    <circle cx="80" cy="68" r="35" fill="${cfg.skin}"/>
    <circle cx="45" cy="69" r="7" fill="${cfg.skin}"/>
    <circle cx="115" cy="69" r="7" fill="${cfg.skin}"/>
    <path d="M45 60c2-30 24-45 51-35 17 6 26 19 28 35-24-12-53-13-79 0z" fill="${C.brown}"/>
    <path d="M46 52c14-22 46-27 68-5-24-7-43-5-68 5z" fill="${C.terra}"/>
    <path d="M55 39c21-12 42-9 57 7-17-7-37-7-57-7z" fill="${C.olive}"/>
    <circle cx="103" cy="43" r="13" fill="${C.gold}"/>
    ${expressionSvg(cfg.expression)}
  </g>
</svg>`;
}

async function writeBothBrand(name, svg) {
  await fs.writeFile(path.join('public', name), svg, 'utf8');
  await fs.writeFile(path.join('src/assets/brand', name), svg, 'utf8');
}

async function main() {
  for (const dir of dirs) await fs.mkdir(dir, { recursive: true });

  await writeBothBrand('logo.svg', logoMarkSvg());
  await writeBothBrand('logo-compact.svg', logoFullSvg({ compact: true }));
  await writeBothBrand('logo-full.svg', logoFullSvg());
  await writeBothBrand('logo-dark.svg', logoFullSvg({ dark: true }));
  await writeBothBrand('logo-white.svg', logoFullSvg({ white: true }));
  await writeBothBrand('wordmark.svg', wordmarkSvg());
  await writeBothBrand('app-icon.svg', appIconSvg());
  await fs.writeFile('public/favicon.svg', appIconSvg(), 'utf8');
  await fs.writeFile('public/icons/icon.svg', appIconSvg(), 'utf8');

  for (let i = 0; i < 24; i += 1) {
    const file = `avatar-${String(i + 1).padStart(2, '0')}.svg`;
    const svg = avatarSvg(i);
    await fs.writeFile(path.join('public/avatars', file), svg, 'utf8');
    await fs.writeFile(path.join('src/assets/avatars', file), svg, 'utf8');
  }

  for (const [name, cfg] of Object.entries(BRAND_AVATAR_CONFIG)) {
    const svg = brandAvatarSvg(name, cfg);
    await fs.writeFile(path.join('public/brand-avatars', `${name}.svg`), svg, 'utf8');
    await fs.writeFile(path.join('src/assets/brand-avatars', `${name}.svg`), svg, 'utf8');
  }

  const iconSvg = Buffer.from(appIconSvg());
  const sizes = [48, 72, 96, 128, 144, 152, 180, 192, 384, 512];
  for (const size of sizes) {
    await sharp(iconSvg).resize(size, size).png().toFile(path.join('public/icons', `icon-${size}.png`));
  }
  await sharp(iconSvg).resize(512, 512).png().toFile('public/logo.png');
  await sharp(iconSvg).resize(512, 512).png().toFile('public/logo-emblem.png');
  await sharp(iconSvg).resize(512, 512).png().toFile('public/logo-mark.png');
  await sharp(iconSvg).resize(32, 32).png().toFile('public/favicon.png');
  await fs.copyFile('public/icons/icon-512.png', 'resources/icon.png');

  console.log('Eganyé brand assets applied.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
