import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const outDir = path.resolve('public/concepts');

const C = {
  terra: '#C96F4A',
  terraDark: '#A85638',
  olive: '#718A68',
  cream: '#F8F0E4',
  beige: '#EFE2D0',
  brown: '#3E2F24',
  gold: '#C49A55',
  white: '#FFF9F0',
  green: '#5E8C57',
};

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function text(x, y, content, size = 16, weight = 700, fill = C.brown, extra = '') {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(content)}</text>`;
}

function multiText(x, y, lines, size = 14, weight = 600, fill = C.brown, lh = 20, extra = '') {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${lines
    .map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lh}">${esc(line)}</tspan>`)
    .join('')}</text>`;
}

function icon(type, x, y, color = C.terra) {
  const stroke = `stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const fill = `fill="${color}"`;
  if (type === 'home') return `<path ${stroke} d="M${x} ${y + 14}l12-10 12 10v17h-8V21h-8v10h-8z"/>`;
  if (type === 'bank') return `<path ${stroke} d="M${x + 2} ${y + 11}h24M${x + 5} ${y + 27}h18M${x + 7} ${y + 11}v14M${x + 15} ${y + 11}v14M${x + 23} ${y + 11}v14M${x + 3} ${y + 8}l12-6 12 6z"/>`;
  if (type === 'circle') return `<circle ${stroke} cx="${x + 14}" cy="${y + 14}" r="10"/><path ${stroke} d="M${x + 14} ${y + 6}v16M${x + 6} ${y + 14}h16"/>`;
  if (type === 'bell') return `<path ${stroke} d="M${x + 8} ${y + 23}h16l-2-4v-6a6 6 0 0 0-12 0v6z"/><path ${stroke} d="M${x + 13} ${y + 26}a4 4 0 0 0 6 0"/>`;
  if (type === 'chat') return `<path ${stroke} d="M${x + 4} ${y + 6}h24v16H${x + 13}l-7 6v-6H${x + 4}z"/>`;
  if (type === 'user') return `<circle ${stroke} cx="${x + 16}" cy="${y + 10}" r="6"/><path ${stroke} d="M${x + 5} ${y + 29}c2-8 20-8 22 0"/>`;
  if (type === 'send') return `<path ${fill} d="M${x + 4} ${y + 5}l24 11-24 11 4-10 10-1-10-1z"/>`;
  if (type === 'vault') return `<rect x="${x + 3}" y="${y + 5}" width="26" height="22" rx="7" fill="${color}" opacity=".18"/><circle ${stroke} cx="${x + 16}" cy="${y + 16}" r="6"/><path ${stroke} d="M${x + 16} ${y + 10}v12M${x + 10} ${y + 16}h12"/>`;
  if (type === 'wallet') return `<path ${stroke} d="M${x + 4} ${y + 9}h22v18H${x + 4}z"/><path ${stroke} d="M${x + 4} ${y + 12}l19-5v5"/><circle ${fill} cx="${x + 22}" cy="${y + 18}" r="2.5"/>`;
  if (type === 'check') return `<circle cx="${x + 16}" cy="${y + 16}" r="14" fill="${C.green}" opacity=".16"/><path ${stroke} d="M${x + 9} ${y + 16}l5 5 10-12"/>`;
  return `<circle cx="${x + 16}" cy="${y + 16}" r="10" fill="${color}" opacity=".2"/>`;
}

function avatar(x, y, r = 18, tone = C.gold, shirt = C.olive, ring = '') {
  return `<g>
    ${ring ? `<circle cx="${x}" cy="${y}" r="${r + 5}" fill="none" stroke="${ring}" stroke-width="4"/>` : ''}
    <circle cx="${x}" cy="${y}" r="${r}" fill="${C.beige}"/>
    <circle cx="${x}" cy="${y - 4}" r="${r * 0.42}" fill="${tone}"/>
    <path d="M${x - r * 0.75} ${y + r * 0.75}c3-13 27-13 30 0" fill="${shirt}"/>
    <path d="M${x - r * 0.45} ${y - r * 0.45}c6-9 18-5 20 3-7-2-13-1-20 3z" fill="${C.brown}" opacity=".9"/>
  </g>`;
}

function progress(x, y, w, pct, color = C.olive) {
  return `<rect x="${x}" y="${y}" width="${w}" height="10" rx="5" fill="${C.beige}"/>
  <rect x="${x}" y="${y}" width="${Math.round(w * pct)}" height="10" rx="5" fill="${color}"/>`;
}

function pill(x, y, w, h, label, fill, color = C.white, stroke = 'none', size = 15) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
  ${text(x + w / 2, y + h / 2 + 6, label, size, 800, color, 'text-anchor="middle"')}`;
}

function phone(x, y, title, body) {
  return `<g transform="translate(${x} ${y})">
    <rect x="-12" y="-12" width="344" height="704" rx="48" fill="#2B211A" opacity=".22" filter="url(#shadow)"/>
    <rect width="320" height="680" rx="42" fill="#2D251F"/>
    <rect x="12" y="12" width="296" height="656" rx="34" fill="${C.cream}"/>
    <rect x="119" y="22" width="82" height="16" rx="8" fill="#2D251F"/>
    <g transform="translate(24 54)">${body}</g>
    <text x="160" y="716" font-size="22" font-weight="900" text-anchor="middle" fill="${C.brown}">${esc(title)}</text>
  </g>`;
}

function bottomNav(active = 0) {
  const items = ['home', 'bank', 'circle', 'chat', 'user'];
  return `<g transform="translate(0 582)">
    <rect x="0" y="0" width="272" height="48" rx="24" fill="${C.white}" stroke="${C.beige}" stroke-width="2"/>
    ${items
      .map((it, i) => `<g transform="translate(${18 + i * 53} 9)">${icon(it, 0, 0, i === active ? C.terra : '#A99A87')}</g>`)
      .join('')}
  </g>`;
}

function onboarding() {
  return `
  <g>
    <circle cx="38" cy="12" r="4" fill="${C.terra}"/><circle cx="54" cy="12" r="4" fill="${C.beige}"/><circle cx="70" cy="12" r="4" fill="${C.beige}"/>
    <rect x="-24" y="42" width="320" height="294" rx="34" fill="${C.beige}"/>
    <path d="M-24 270c68-42 143-24 203-4 47 16 79 4 117-18v88H-24z" fill="${C.cream}"/>
    <circle cx="66" cy="130" r="40" fill="${C.gold}" opacity=".18"/>
    ${avatar(74, 168, 30, '#9F603E', C.terra)}
    ${avatar(128, 150, 34, '#7F4C32', C.olive)}
    ${avatar(185, 170, 31, '#B8744B', C.gold)}
    <path d="M42 220c42 35 151 31 194-1" fill="none" stroke="${C.terra}" stroke-width="8" stroke-linecap="round" opacity=".28"/>
    ${multiText(4, 390, ['Épargnez ensemble,', 'réussissez ensemble'], 24, 950, C.brown, 30)}
    ${multiText(4, 462, ['Créez vos cercles, cotisez en confiance', 'et suivez chaque objectif simplement.'], 14, 700, '#6C5848', 20)}
    ${pill(0, 535, 272, 48, 'Commencer', C.terra)}
    ${text(136, 615, "J'ai déjà un compte", 15, 800, C.olive, 'text-anchor="middle"')}
  </g>`;
}

function dashboard() {
  const circles = ['Famille', 'Marché', 'Amies'];
  return `
    <g>${avatar(20, 18, 18)}${text(50, 14, 'Bonjour, Amara', 18, 900)}<g transform="translate(238 0)">${icon('bell', 0, 0, C.brown)}</g></g>
    <rect x="0" y="54" width="272" height="142" rx="28" fill="url(#terraGrad)"/>
    ${text(22, 92, 'Solde disponible', 15, 800, C.white)}
    ${text(22, 136, '128 500 FCFA', 31, 950, C.white)}
    ${pill(22, 154, 104, 32, 'Recharger', C.white, C.terra, 'none', 13)}
    ${pill(138, 154, 84, 32, 'Retirer', C.white, C.terra, 'none', 13)}
    <rect x="0" y="216" width="272" height="104" rx="24" fill="${C.white}" stroke="${C.beige}" stroke-width="2"/>
    ${text(18, 250, 'Mon épargne', 18, 900)}
    ${text(204, 250, '72%', 18, 900, C.olive)}
    ${progress(18, 276, 236, .72, C.olive)}
    ${text(18, 302, 'Objectif : 300 000 FCFA', 13, 700, '#7B6757')}
    ${text(0, 360, 'Mes cercles', 20, 950)}
    ${circles.map((c, i) => `<rect x="${i * 104}" y="382" width="92" height="112" rx="24" fill="${i === 1 ? '#F4E7D5' : C.white}" stroke="${C.beige}" stroke-width="2"/>
      ${avatar(i * 104 + 46, 426, 20, i === 0 ? '#8C5437' : '#B8744B', i === 2 ? C.terra : C.olive)}
      ${text(i * 104 + 46, 470, c, 14, 900, C.brown, 'text-anchor="middle"')}`).join('')}
    ${bottomNav(0)}
  `;
}

function bank() {
  const vaults = [
    ['Mariage Awa', '85 000 / 150 000', 'Verrouillé', C.terra],
    ['Rentrée', '120 000 / 120 000', 'Débloqué', C.olive],
    ['Boutique', '42 000 / 90 000', 'Verrouillé', C.gold],
  ];
  return `
    ${text(0, 18, 'Ma Banque', 25, 950)}
    <rect x="0" y="44" width="272" height="124" rx="28" fill="url(#terraGrad)"/>
    ${text(22, 82, 'Solde disponible', 15, 800, C.white)}
    ${text(22, 124, '128 500 FCFA', 30, 950, C.white)}
    <rect x="0" y="188" width="272" height="96" rx="24" fill="${C.white}" stroke="${C.beige}" stroke-width="2"/>
    ${text(18, 222, 'Épargne totale', 18, 900)}${text(188, 222, '247 000', 18, 900, C.olive)}
    ${progress(18, 248, 236, .58, C.olive)}
    ${text(18, 274, 'Objectif global : 420 000 FCFA', 13, 700, '#7B6757')}
    ${text(0, 328, 'Mes réservations', 20, 950)}
    ${vaults.map((v, i) => `<rect x="0" y="${350 + i * 74}" width="272" height="62" rx="20" fill="${C.white}" stroke="${C.beige}" stroke-width="2"/>
      <g transform="translate(12 ${364 + i * 74})">${icon('vault', 0, 0, v[3])}</g>
      ${text(58, 374 + i * 74, v[0], 15, 900)}${text(58, 397 + i * 74, v[1], 12, 700, '#7B6757')}
      ${pill(180, 368 + i * 74, 78, 26, v[2], v[2] === 'Débloqué' ? '#E3F0DD' : '#F6DFD4', v[2] === 'Débloqué' ? C.green : C.terra, 'none', 11)}`).join('')}
    ${pill(0, 574, 272, 46, 'Créer une épargne', C.terra)}
  `;
}

function createCircle() {
  return `
    ${text(0, 18, 'Créer un cercle', 24, 950)}${text(0, 47, 'Étape 2/3', 14, 800, '#7B6757')}
    <rect x="0" y="72" width="82" height="9" rx="5" fill="${C.terra}"/><rect x="95" y="72" width="82" height="9" rx="5" fill="${C.terra}"/><rect x="190" y="72" width="82" height="9" rx="5" fill="${C.beige}"/>
    <rect x="0" y="112" width="272" height="116" rx="28" fill="${C.white}" stroke="${C.beige}" stroke-width="2"/>
    ${text(20, 148, 'Montant de la cotisation', 15, 800, '#7B6757')}
    ${text(20, 196, '25 000 FCFA', 36, 950, C.brown)}
    ${['5000', '10000', '25000', '50000'].map((n, i) => pill((i % 2) * 138, 252 + Math.floor(i / 2) * 48, 126, 36, `${n} FCFA`, i === 2 ? C.terra : C.white, i === 2 ? C.white : C.brown, C.beige, 12)).join('')}
    ${text(0, 382, 'Fréquence', 18, 950)}
    <rect x="0" y="404" width="272" height="44" rx="22" fill="${C.beige}"/>
    ${pill(4, 408, 86, 36, 'Semaine', C.white, C.terra, 'none', 12)}${text(136, 431, 'Mois', 13, 800, '#7B6757', 'text-anchor="middle"')}${text(228, 431, 'Libre', 13, 800, '#7B6757', 'text-anchor="middle"')}
    ${text(0, 488, 'Nombre de participants', 18, 950)}
    <rect x="0" y="512" width="272" height="54" rx="24" fill="${C.white}" stroke="${C.beige}" stroke-width="2"/>
    ${pill(18, 522, 34, 34, '-', C.beige, C.brown, 'none', 20)}${text(136, 548, '8', 26, 950, C.brown, 'text-anchor="middle"')}${pill(220, 522, 34, 34, '+', C.terra, C.white, 'none', 20)}
    ${pill(0, 580, 272, 46, 'Continuer', C.terra)}
  `;
}

function circleDetail() {
  const names = ['Amara', 'Awa', 'Moussa', 'Kadi', 'Ibra'];
  return `
    <rect x="0" y="0" width="272" height="138" rx="30" fill="url(#oliveGrad)"/>
    ${text(22, 42, 'Cercle Marché', 25, 950, C.white)}
    ${text(22, 72, '8 membres', 14, 800, C.white)}
    ${text(22, 106, 'Prochain versement : 18 sept.', 15, 900, C.white)}
    <g transform="translate(6 170)">${avatar(24, 0, 18)}${avatar(64, 0, 18, '#9F603E', C.terra, C.terra)}${avatar(104, 0, 18, '#B8744B', C.olive)}${avatar(144, 0, 18)}${avatar(184, 0, 18, '#8C5437', C.gold)}</g>
    ${pill(166, 153, 106, 34, "C'est votre tour", '#F6DFD4', C.terra, 'none', 12)}
    ${text(0, 232, 'Ordre de paiement', 20, 950)}
    <path d="M24 260v250" stroke="${C.beige}" stroke-width="4" stroke-linecap="round"/>
    ${names.map((n, i) => `<g transform="translate(0 ${256 + i * 56})">
      <circle cx="24" cy="16" r="14" fill="${i < 2 ? C.olive : i === 2 ? C.terra : C.beige}"/>
      ${i < 2 ? icon('check', 8, 0, C.white) : ''}
      ${text(54, 20, n, 15, 900)}${text(188, 20, i === 1 ? 'En cours' : i < 1 ? 'Payé' : 'À venir', 12, 800, i === 1 ? C.terra : '#7B6757')}
    </g>`).join('')}
    ${pill(0, 562, 152, 42, 'Cotiser maintenant', C.terra, C.white, 'none', 13)}
    ${pill(164, 562, 108, 42, 'Discussion', 'transparent', C.olive, C.olive, 13)}
  `;
}

function activity() {
  const rows = [
    ['Cotisation reçue', 'Cercle Marché', '+25 000', C.olive, '09:12'],
    ['Retrait validé', 'Portefeuille', '-10 000', C.terra, '08:40'],
    ['Tour confirmé', 'Famille Diop', '+50 000', C.olive, 'Hier'],
    ['Notification', 'KYC approuvé', '+0', C.olive, 'Hier'],
  ];
  return `
    ${text(0, 18, 'Activité', 25, 950)}
    ${['Tous', 'Cotisations', 'Transactions'].map((n, i) => pill(i === 0 ? 0 : i === 1 ? 64 : 166, 48, i === 0 ? 54 : i === 1 ? 92 : 106, 34, n, i === 0 ? C.terra : C.white, i === 0 ? C.white : C.brown, C.beige, 12)).join('')}
    ${text(0, 120, "Aujourd'hui", 18, 950)}
    ${rows.map((r, i) => `<g transform="translate(0 ${146 + i * 88})">
      ${i === 2 ? text(0, -18, 'Hier', 18, 950) : ''}
      <rect x="0" y="0" width="272" height="70" rx="22" fill="${C.white}" stroke="${C.beige}" stroke-width="2"/>
      <circle cx="28" cy="35" r="18" fill="${i % 2 ? '#F6DFD4' : '#E3F0DD'}"/>
      <g transform="translate(12 19)">${icon(i === 3 ? 'bell' : 'wallet', 0, 0, i % 2 ? C.terra : C.olive)}</g>
      ${text(58, 29, r[0], 14, 900)}${text(58, 51, r[1], 12, 700, '#7B6757')}
      ${text(250, 29, r[2], 13, 900, r[3], 'text-anchor="end"')}${text(250, 51, r[4], 11, 700, '#9A8979', 'text-anchor="end"')}
    </g>`).join('')}
    ${bottomNav(3)}
  `;
}

function chat() {
  return `
    <g>${avatar(22, 18, 18)}${avatar(52, 18, 18, '#9F603E', C.terra)}${avatar(82, 18, 18, '#B8744B', C.olive)}${text(116, 17, 'Cercle Marché', 18, 950)}${text(116, 40, '8 membres actifs', 12, 700, '#7B6757')}</g>
    ${text(136, 95, 'Aujourd’hui', 12, 800, '#9A8979', 'text-anchor="middle"')}
    <rect x="0" y="126" width="198" height="58" rx="22" fill="${C.white}" stroke="${C.beige}" stroke-width="2"/>
    ${avatar(20, 156, 12)}
    ${multiText(42, 150, ['La cotisation est ouverte', 'jusqu’à 18h.'], 13, 700, C.brown, 17)}
    <rect x="72" y="212" width="200" height="56" rx="22" fill="${C.terra}"/>
    ${multiText(92, 236, ['Je cotise maintenant.'], 14, 800, C.white, 18)}
    <rect x="0" y="298" width="216" height="76" rx="22" fill="${C.white}" stroke="${C.beige}" stroke-width="2"/>
    ${avatar(20, 334, 12, '#9F603E', C.olive)}
    ${multiText(42, 322, ['Merci Amara, je confirme', 'la réception.'], 13, 700, C.brown, 17)}
    <rect x="106" y="410" width="166" height="50" rx="22" fill="${C.terra}"/>
    ${text(126, 440, 'Super, merci !', 14, 800, C.white)}
    <rect x="0" y="594" width="216" height="48" rx="24" fill="${C.white}" stroke="${C.beige}" stroke-width="2"/>
    ${text(22, 625, 'Votre message', 13, 700, '#9A8979')}
    <circle cx="248" cy="618" r="24" fill="${C.terra}"/><g transform="translate(232 602)">${icon('send', 0, 0, C.white)}</g>
  `;
}

function profile() {
  const items = [
    ['Vérification d’identité', 'KYC validé', C.green],
    ['Portefeuille Mobile Money', 'Orange Money connecté', C.terra],
    ['Mandataire numérique', 'Personne de confiance', C.olive],
    ['Code PIN de retrait', 'Sécurité renforcée', C.gold],
    ["Langue de l'application", 'Français', C.brown],
  ];
  return `
    <circle cx="136" cy="78" r="52" fill="${C.beige}"/>
    ${avatar(136, 82, 46, '#9F603E', C.terra)}
    ${text(136, 160, 'Amara Coulibaly', 24, 950, C.brown, 'text-anchor="middle"')}
    ${pill(86, 176, 100, 28, 'Vérifié', '#E3F0DD', C.green, 'none', 12)}
    ${items.map((it, i) => `<rect x="0" y="${228 + i * 72}" width="272" height="58" rx="20" fill="${C.white}" stroke="${C.beige}" stroke-width="2"/>
      <rect x="14" y="${240 + i * 72}" width="34" height="34" rx="11" fill="${it[2]}" opacity=".16"/>
      <g transform="translate(15 ${241 + i * 72})">${icon(i === 0 ? 'check' : i === 1 ? 'wallet' : i === 2 ? 'user' : 'bank', 0, 0, it[2])}</g>
      ${text(60, 251 + i * 72, it[0], 14, 900)}${text(60, 273 + i * 72, it[1], 12, 700, '#7B6757')}
      ${text(250, 265 + i * 72, '›', 26, 900, '#A99A87')}
    `).join('')}
  `;
}

function logoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
  <defs>
    <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .07"/></feComponentTransfer></filter>
    <filter id="soft"><feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#8B4B31" flood-opacity=".16"/></filter>
  </defs>
  <rect width="1600" height="1000" fill="${C.cream}"/>
  <rect width="1600" height="1000" filter="url(#paper)" opacity=".55"/>
  <g transform="translate(220 166)" filter="url(#soft)" font-family="Arial Rounded MT Bold, Trebuchet MS, Arial, sans-serif">
    <rect width="1160" height="668" rx="56" fill="${C.white}" stroke="${C.beige}" stroke-width="4"/>
    <g transform="translate(130 136)">
      <circle cx="178" cy="178" r="154" fill="${C.beige}"/>
      <path d="M74 188c32-118 170-154 238-54 48 71 8 172-71 198-95 32-176-44-167-144z" fill="${C.terra}"/>
      <path d="M104 212c39 60 109 88 174 42 24-17 37-41 43-67-26 57-102 78-163 45-28-15-45-36-54-20z" fill="${C.gold}" opacity=".95"/>
      <path d="M127 121c44-52 121-50 165 2-40-20-85-21-126-1-18 9-31 15-39-1z" fill="${C.olive}"/>
      <circle cx="244" cy="118" r="28" fill="${C.gold}"/>
      <path d="M174 92c31-26 81-35 125-9" fill="none" stroke="${C.white}" stroke-width="18" stroke-linecap="round" opacity=".38"/>
      <path d="M88 256c38 54 99 82 159 72" fill="none" stroke="${C.white}" stroke-width="16" stroke-linecap="round" opacity=".26"/>
    </g>
    <g transform="translate(510 210)">
      ${text(0, 80, 'Eganye', 104, 950, C.brown)}
      ${text(8, 138, 'Épargne collective simple et fiable', 33, 800, '#715C4B')}
      <rect x="8" y="194" width="392" height="14" rx="7" fill="${C.terra}"/>
      <rect x="422" y="194" width="92" height="14" rx="7" fill="${C.olive}"/>
      <rect x="532" y="194" width="58" height="14" rx="7" fill="${C.gold}"/>
    </g>
  </g>
  </svg>`;
}

function screensSvg() {
  const screens = [
    ['1. Onboarding', onboarding()],
    ['2. Accueil', dashboard()],
    ['3. Ma Banque', bank()],
    ['4. Créer 2/3', createCircle()],
    ["5. Détail cercle", circleDetail()],
    ['6. Activité', activity()],
    ['7. Discussion', chat()],
    ['8. Profil', profile()],
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="3200" height="2300" viewBox="0 0 3200 2300">
  <defs>
    <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .075"/></feComponentTransfer></filter>
    <filter id="shadow"><feDropShadow dx="0" dy="24" stdDeviation="22" flood-color="#7B3F29" flood-opacity=".20"/></filter>
    <linearGradient id="terraGrad" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${C.terra}"/><stop offset="1" stop-color="${C.terraDark}"/></linearGradient>
    <linearGradient id="oliveGrad" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${C.olive}"/><stop offset="1" stop-color="#536E4D"/></linearGradient>
  </defs>
  <rect width="3200" height="2300" fill="${C.cream}"/>
  <rect width="3200" height="2300" filter="url(#paper)" opacity=".65"/>
  <g font-family="Nunito, Poppins, Arial, sans-serif">
    ${text(160, 170, 'Eganye - 8 écrans mobiles', 76, 950, C.brown)}
    ${text(162, 228, 'Charte verrouillée : terracotta, olive, crème, beige, brun et touche or', 30, 800, '#715C4B')}
    ${screens
      .map(([title, body], i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        return phone(170 + col * 760, 330 + row * 900, title, body);
      })
      .join('')}
  </g>
  </svg>`;
}

await fs.mkdir(outDir, { recursive: true });
const screens = screensSvg();
const logo = logoSvg();
await fs.writeFile(path.join(outDir, 'eganye-8-screens.svg'), screens, 'utf8');
await fs.writeFile(path.join(outDir, 'eganye-logo-unique.svg'), logo, 'utf8');
await sharp(Buffer.from(screens)).png().toFile(path.join(outDir, 'eganye-8-screens.png'));
await sharp(Buffer.from(logo)).png().toFile(path.join(outDir, 'eganye-logo-unique.png'));

console.log('Generated:');
console.log(path.join(outDir, 'eganye-8-screens.svg'));
console.log(path.join(outDir, 'eganye-8-screens.png'));
console.log(path.join(outDir, 'eganye-logo-unique.svg'));
console.log(path.join(outDir, 'eganye-logo-unique.png'));
