// Captures des vrais écrans d'eganyé pour les vidéos, avec de FAUSSES données. Rien ne sort vers la vraie base.
//
//   PUPPETEER_CORE=/chemin/vers/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js node video/capture-screens.mjs fr
//   (idem avec en) -> video/screens/<langue>/*.jpg
//
// puppeteer-core n'est pas une dépendance du projet : l'installer ailleurs et donner son chemin.
//
// Barrières réseau (trois couches indépendantes) :
//  1. Interception de TOUTES les requêtes de la page : seules localhost et les polices Google
//     continuent ; supabase, paydunya, /api/* reçoivent une réponse en mémoire ; le reste est bloqué.
//  2. WebSocket remplacé dans la page pour tout hôte non local.
//  3. --host-resolver-rules : Chrome ne résout aucun nom hors localhost et polices.
// Le fichier .env n'est jamais lu ici ; ni en-têtes ni clés ne sont journalisés.
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
const puppeteer = (await import(process.env.PUPPETEER_CORE ? pathToFileURL(process.env.PUPPETEER_CORE).href : 'puppeteer-core')).default;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.join(HERE, '..');
const PORT = Number(process.env.SHOTS_PORT) || 5198;
const ORIGIN = `http://localhost:${PORT}`;
const LANG = process.argv[2] === 'en' ? 'en' : 'fr';
const EN = LANG === 'en';
const OUT = path.join(HERE, 'screens', LANG);
fs.mkdirSync(OUT, { recursive: true });
const TEXT_OUT = process.env.TEXT_OUT || null; // texte de chaque écran, pour contrôler la langue
if (TEXT_OUT) fs.mkdirSync(TEXT_OUT, { recursive: true });

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const ALLOWED_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------ FAUSSES DONNÉES ------------------------------ */
const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
const later = (d) => new Date(Date.now() + d * 864e5).toISOString();
const dateOnly = (iso) => iso.slice(0, 10);
const period = (d) => ago(d).slice(0, 7);
const ME = 'aaaaaaaa-0000-4000-8000-000000000001';
const person = (n) => `bbbbbbbb-0000-4000-8000-00000000000${n}`;
const G1 = 'cccccccc-0000-4000-8000-000000000001';
const G2 = 'cccccccc-0000-4000-8000-000000000002';
const EMAIL = 'awa.demo@example.invalid';
const CIRCLE = EN ? 'Market Women Circle' : 'Cercle des commerçantes';
const FAMILY = EN ? 'Family Savings' : 'Épargne famille';
const NEW_CIRCLE = EN ? 'Market Circle' : 'Tontine du marché';

const profile = {
  id: ME, email: EMAIL, display_name: 'Awa Koffi', avatar_config: null, avatar_url: null,
  reputation_score: 82, total_saved: 340000, groups_joined: 2, role: 'user', wallet_balance: 125000,
  language: LANG, theme: 'light', biometrics_enabled: false, push_enabled: true,
  email_notifications_enabled: true, sms_notifications_enabled: false, whatsapp_notifications_enabled: false,
  created_at: ago(240), updated_at: ago(1), kyc_level: 2, kyc_verified_at: ago(200),
  mandate_name: null, mandate_phone: null, mandate_permissions: null,
  subscription_plan: null, subscription_expires_at: null,
  first_name: 'Awa', last_name: 'Koffi', date_of_birth: '1990-04-12', phone: '+22890000000',
  bank_tier: 'starter', bank_subscription_expires_at: later(200),
};
const others = ['Ama Mensah', 'Kofi Agbo', 'Afi Dossou', 'Yao Tetteh', 'Esi Lawson'].map((name, i) => ({
  id: person(i + 1), display_name: name, avatar_config: null, avatar_url: null,
  reputation_score: 70 + i * 4, kyc_level: 2,
}));
const groupRow = (id, name, description, amount, frequency, joinCode, creator, idx, nextDays) => ({
  id, name, description, creator_id: creator, contribution_amount: amount, frequency,
  start_date: dateOnly(ago(120)), end_date: null, next_payout_date: dateOnly(later(nextDays)),
  status: 'active', current_payout_index: idx, currency: 'FCFA', join_code: joinCode, is_private: true,
  max_members: 6, rules: 'Cotiser avant la date prévue.', last_reminder_period: null,
  distribution_method: 'sequential', drawn_beneficiary_id: null, penalty_rate: 5,
  penalty_type: 'percentage', penalty_amount: null, grace_period: 3, created_at: ago(120),
});
const member = (group_id, user_id, payout_position, role = 'member') => ({
  group_id, user_id, payout_position, role, status: 'active', joined_at: ago(120),
});
const contrib = (id, group_id, user_id, amount, days, status) => ({
  id, group_id, user_id, user_name: null, user_email: null, amount, date: dateOnly(ago(days)), status,
  period: period(days), proof_reference: null, proof_submitted_at: null, penalty_applied: 0, penalty_status: 'none',
  notified_insufficient: false, payment_method: 'wallet', debited_at: ago(days), idempotency_key: null,
});
const tx = (id, amount, type, description, days, status = 'completed') => ({
  id, user_id: ME, amount, type, description, date: ago(days), status, reference: null, payment_method: 'wallet',
});

const DB = {
  profiles: [profile],
  member_profiles: others,
  groups: [
    groupRow(G1, CIRCLE, 'Marché de Hédzranawoé', 10000, 'monthly', 'AWA123', ME, 1, 12),
    groupRow(G2, FAMILY, 'Pour les fêtes de fin d’année', 5000, 'weekly', 'FAM456', person(1), 2, 4),
  ],
  group_members: [
    member(G1, ME, 1, 'treasurer'), member(G1, person(1), 2), member(G1, person(2), 3),
    member(G1, person(3), 4), member(G1, person(4), 5), member(G1, person(5), 6),
    member(G2, person(1), 1), member(G2, person(3), 2), member(G2, ME, 3), member(G2, person(5), 4),
  ],
  contributions: [
    contrib('d0000000-0000-4000-8000-000000000001', G1, ME, 10000, 3, 'paid'),
    contrib('d0000000-0000-4000-8000-000000000002', G1, person(1), 10000, 4, 'paid'),
    contrib('d0000000-0000-4000-8000-000000000003', G1, person(2), 10000, 2, 'paid'),
    contrib('d0000000-0000-4000-8000-000000000004', G1, person(3), 10000, 1, 'pending'),
    contrib('d0000000-0000-4000-8000-000000000005', G1, ME, 10000, 34, 'paid'),
    contrib('d0000000-0000-4000-8000-000000000006', G2, ME, 5000, 2, 'paid'),
    contrib('d0000000-0000-4000-8000-000000000007', G2, person(1), 5000, 2, 'paid'),
    contrib('d0000000-0000-4000-8000-000000000008', G2, person(5), 5000, 1, 'late'),
  ],
  payouts: [{ id: 'e0000000-0000-4000-8000-000000000001', group_id: G1, user_id: person(1), amount: 60000, date: dateOnly(ago(20)), discount_amount: null, currency: 'FCFA', cycle: 1, transaction_id: null }],
  wallet_transactions: [
    tx('f0000000-0000-4000-8000-000000000001', 50000, 'recharge', EN ? 'Mobile Money top-up (Mixx)' : 'Recharge Mobile Money (Mixx)', 1),
    tx('f0000000-0000-4000-8000-000000000002', -10000, 'contribution_debit', (EN ? 'Contribution - ' : 'Cotisation - ') + CIRCLE, 3),
    tx('f0000000-0000-4000-8000-000000000003', -5000, 'contribution_debit', (EN ? 'Contribution - ' : 'Cotisation - ') + FAMILY, 2),
    tx('f0000000-0000-4000-8000-000000000005', -20000, 'withdraw', EN ? 'Withdrawal to Flooz' : 'Retrait vers Flooz', 25),
    tx('f0000000-0000-4000-8000-000000000006', 30000, 'recharge', EN ? 'Mobile Money top-up (Flooz)' : 'Recharge Mobile Money (Flooz)', 40),
  ],
  notifications: [
    { id: 'a1000000-0000-4000-8000-000000000001', user_id: ME, title: EN ? 'Contribution recorded' : 'Cotisation enregistrée', message: EN ? 'Your 10,000 F contribution was received.' : 'Votre cotisation de 10 000 F a bien été reçue.', type: 'payout', read: false, link: null, created_at: ago(3) },
    { id: 'a1000000-0000-4000-8000-000000000002', user_id: ME, title: EN ? 'Reminder' : 'Rappel', message: EN ? 'Family Savings: next contribution in 4 days.' : 'Épargne famille : prochaine cotisation dans 4 jours.', type: 'reminder', read: false, link: null, created_at: ago(1) },
  ],
  messages: [],
  personal_vaults: [
    { id: 'a3000000-0000-4000-8000-000000000001', user_id: ME, name: EN ? 'School fees' : 'Scolarité des enfants', description: 'Rentrée de septembre', balance: 85000, lock_days: 90, unlock_at: later(45), created_at: ago(45) },
    { id: 'a3000000-0000-4000-8000-000000000002', user_id: ME, name: EN ? 'Shop fund' : 'Fonds de commerce', description: 'Nouveau stock', balance: 40000, lock_days: 30, unlock_at: ago(2), created_at: ago(32) },
  ],
  platform_settings: [{
    id: 1, maintenance_mode: false, allow_signups: true, payout_fee_mode: 'none', payout_fee_percent: 0, platform_wallet_id: null,
    deposit_fee_enabled: true, deposit_fee_percent: 2, deposit_fee_fixed: 0, deposit_fee_min: 0,
    auto_withdraw_enabled: true, auto_withdraw_max_amount: 100000, auto_withdraw_daily_max: 200000,
    withdraw_fee_enabled: true, withdraw_fee_percent: 1, withdraw_fee_fixed: 0, withdraw_fee_min: 100,
    aid_application_fee: 1000,
  }],
  platform_revenue_shares: [],
  marketplace_services: [
    { id: 'a4000000-0000-4000-8000-000000000001', title: EN ? 'Family health cover' : 'Assurance santé famille', description: 'Une couverture santé simple pour votre foyer.', provider: 'Partenaire démo', category: 'assurance', icon_name: 'ShieldPlus', color_class: 'bg-blue-500', requirements: ['Compte vérifié'], min_reputation_score: 50, action_label: 'Demander', is_active: true, created_at: ago(90) },
    { id: 'a4000000-0000-4000-8000-000000000002', title: EN ? 'Equipment for your business' : 'Équipement pour votre commerce', description: 'Congélateur, machine à coudre : payez en plusieurs fois.', provider: 'Partenaire démo', category: 'equipement', icon_name: 'Zap', color_class: 'bg-amber-500', requirements: [], min_reputation_score: 60, action_label: 'Demander', is_active: true, created_at: ago(80) },
  ],
  marketplace_requests: [], credit_applications: [], aid_applications: [], kyc_submissions: [],
  group_documents: [], support_tickets: [],
};
const RPC = {
  get_member_profiles: () => [profile, ...others],
  claim_reminder_period: () => false,
  get_my_reliability: () => ({
    status: 'ready', score: 70, modelVersion: 'depart-1', dueCount: 5, onTimeCount: 4, openLate: 0, recentLate: 1, recentCount: 3,
    afterPayoutCount: 0, lateAfterPayout: 0, factors: {}, previousScore: 85, previousDay: '2026-11-03',
    changes: [{ factor: 'on_time_rate', impact: 0.42 }, { factor: 'recent_late_rate', impact: 0.33 }],
  }),
  get_circle_health: () => ({ status: 'ok', level: 'low' }),
};

/* ------------------------------ MOCK POSTGREST ------------------------------ */
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns', 'or', 'and']);
function matches(row, key, expr) {
  const col = key.split('.').pop();
  if (!(col in row)) return true;
  const v = row[col];
  const m = /^(not\.)?(eq|neq|gt|gte|lt|lte|in|is|like|ilike)\.(.*)$/s.exec(expr);
  if (!m) return true;
  const [, neg, op, raw] = m;
  let ok = true;
  if (op === 'eq') ok = String(v) === raw;
  else if (op === 'neq') ok = String(v) !== raw;
  else if (op === 'in') ok = raw.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '')).includes(String(v));
  else if (op === 'is') ok = raw === 'null' ? v == null : String(v) === raw;
  else if (op === 'gte') ok = String(v) >= raw;
  else if (op === 'lte') ok = String(v) <= raw;
  else if (op === 'gt') ok = String(v) > raw;
  else if (op === 'lt') ok = String(v) < raw;
  return neg ? !ok : ok;
}
function fakeJwt() {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: ME, email: EMAIL, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 86400 })}.fausse-signature`;
}
const USER = {
  id: ME, aud: 'authenticated', role: 'authenticated', email: EMAIL, email_confirmed_at: ago(240),
  phone: '', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { display_name: 'Awa Koffi' },
  identities: [], created_at: ago(240), updated_at: ago(1),
};
const makeSession = () => ({
  access_token: fakeJwt(), token_type: 'bearer', expires_in: 86400,
  expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: 'faux-jeton', user: USER,
});

const netlog = { local: 0, fonts: 0, mockSupabase: 0, mockApi: 0, mockPaydunya: 0, blocked: {}, writesAnsweredInMemory: [], unknownTables: [], websocketsNonLocal: 0, passedThrough: [] };

function cors(req) {
  return {
    'access-control-allow-origin': req.headers().origin || '*',
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS',
    'access-control-allow-headers': req.headers()['access-control-request-headers'] || 'authorization,apikey,content-type,prefer,accept-profile,content-profile,x-client-info,x-supabase-api-version,range',
    'access-control-expose-headers': 'content-range,x-supabase-api-version',
  };
}
function json(req, status, body, extra = {}) {
  return req.respond({
    status,
    headers: { ...cors(req), 'content-type': 'application/json; charset=utf-8', ...extra },
    body: body === undefined ? '' : JSON.stringify(body),
  });
}
function mockSupabase(req, url) {
  const p = url.pathname;
  const method = req.method();
  if (method === 'OPTIONS') return req.respond({ status: 204, headers: cors(req), body: '' });

  if (p.startsWith('/auth/v1/')) {
    if (p.endsWith('/signup')) return json(req, 200, { ...USER, email_confirmed_at: null, identities: [{ id: 'x', provider: 'email' }], confirmation_sent_at: ago(0) });
    if (p.endsWith('/verify')) return json(req, 200, makeSession());
    if (p.endsWith('/token')) return json(req, 200, makeSession());
    if (p.endsWith('/user')) return json(req, 200, USER);
    if (p.endsWith('/settings')) return json(req, 200, { external: { email: true }, disable_signup: false });
    return json(req, 200, {});
  }
  if (p.startsWith('/rest/v1/rpc/')) {
    const fn = p.split('/').pop();
    const known = RPC[fn];
    if (!known) netlog.writesAnsweredInMemory.push(`rpc:${fn}`);
    return json(req, 200, known ? known() : { success: false, message: 'Données de démonstration' });
  }
  if (p.startsWith('/rest/v1/')) {
    const table = p.split('/').pop();
    if (!(table in DB)) netlog.unknownTables.push(table);
    if (method !== 'GET' && method !== 'HEAD') {
      netlog.writesAnsweredInMemory.push(`${method}:${table}`);
      if (method === 'POST' && table === 'groups') {
        const body = JSON.parse(req.postData() || '{}');
        const row = { ...(Array.isArray(body) ? body[0] : body), id: 'cccccccc-0000-4000-8000-000000000009' };
        if ((req.headers().accept || '').includes('vnd.pgrst.object')) return json(req, 201, row);
        return json(req, 201, [row]);
      }
      return json(req, method === 'POST' ? 201 : 200, []);
    }
    let rows = DB[table] || [];
    for (const [k, v] of url.searchParams) if (!RESERVED.has(k)) rows = rows.filter((r) => matches(r, k, v));
    const order = url.searchParams.get('order');
    if (order) {
      const [col, dir] = order.split(',')[0].split('.');
      rows = [...rows].sort((a, b) => (String(a[col]) > String(b[col]) ? 1 : -1) * (dir === 'asc' ? 1 : -1));
    }
    const total = rows.length;
    const limit = url.searchParams.get('limit');
    if (limit) rows = rows.slice(0, Number(limit));
    const range = { 'content-range': total ? `0-${rows.length - 1}/${total}` : '*/0' };
    if (method === 'HEAD') return req.respond({ status: 200, headers: { ...cors(req), ...range }, body: '' });
    if ((req.headers().accept || '').includes('vnd.pgrst.object')) {
      if (!rows.length) return json(req, 406, { code: 'PGRST116', message: 'no rows', details: null, hint: null });
      return json(req, 200, rows[0], range);
    }
    return json(req, 200, rows, range);
  }
  if (p.startsWith('/storage/v1/')) return json(req, 200, method === 'POST' ? { Key: 'demo', signedURL: '' } : []);
  return json(req, 200, {});
}

/* ------------------------------ NAVIGATEUR ------------------------------ */
async function hardenPage(page, { session, storageKey, forceDesktopQuery }) {
  await page.setBypassServiceWorker(true);
  await page.setRequestInterception(true);
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  cdp.on('Network.webSocketCreated', ({ url }) => {
    if (!/^wss?:\/\/localhost(:\d+)?\//.test(url)) netlog.websocketsNonLocal += 1;
  });
  page.on('request', async (req) => {
    try {
      const raw = req.url();
      if (raw.startsWith('data:') || raw.startsWith('blob:')) return req.continue();
      const url = new URL(raw);
      const host = url.hostname;
      if (url.pathname.startsWith('/api/')) {
        netlog.mockApi += 1;
        if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: cors(req), body: '' });
        return json(req, 200, { success: false, message: 'Données de démonstration' });
      }
      if (host.endsWith('.supabase.co') || host.endsWith('.supabase.in')) {
        netlog.mockSupabase += 1;
        return mockSupabase(req, url);
      }
      if (host === 'paydunya.com' || host.endsWith('.paydunya.com')) {
        netlog.mockPaydunya += 1;
        return json(req, 200, {});
      }
      if (host === 'localhost' && url.port === String(PORT)) {
        netlog.local += 1;
        return req.continue();
      }
      if (ALLOWED_HOSTS.has(host)) {
        netlog.fonts += 1;
        return req.continue();
      }
      netlog.blocked[host] = (netlog.blocked[host] || 0) + 1;
      return req.abort('blockedbyclient');
    } catch { /* requête déjà traitée ou page fermée */ }
  });
  await page.evaluateOnNewDocument((opts) => {
    // Aucun WebSocket hors localhost (Supabase Realtime reste « en connexion »).
    const Native = window.WebSocket;
    class Stub extends EventTarget {
      static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
      constructor(u) { super(); this.url = String(u); this.readyState = 0; this.bufferedAmount = 0; this.protocol = ''; this.extensions = ''; this.binaryType = 'blob'; }
      send() {} close() { this.readyState = 3; }
    }
    window.WebSocket = new Proxy(Native, {
      construct(T, args) {
        return /^wss?:\/\/localhost(:\d+)?\//.test(String(args[0])) ? new T(...args) : new Stub(args[0]);
      },
    });
    // Pas de service worker : il échapperait à l'interception.
    try {
      if (navigator.serviceWorker) {
        navigator.serviceWorker.register = () => new Promise(() => {});
        navigator.serviceWorker.getRegistrations = () => Promise.resolve([]);
      }
    } catch {}
    try {
      localStorage.setItem('egayne_lang', opts.lang);
      localStorage.setItem('eganye_theme', 'light');
      localStorage.setItem('eganye_pwa_prompt_dismissed_at', String(Date.now()));
      if (opts.session && opts.storageKey) localStorage.setItem(opts.storageKey, JSON.stringify(opts.session));
    } catch {}
    if (opts.forceDesktopQuery) {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (q) => q === '(min-width: 1024px)'
        ? { matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } }
        : original(q);
    }
  }, { session, storageKey, forceDesktopQuery: !!forceDesktopQuery, lang: LANG });
}

const MOBILE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const manifest = [];

async function newPage(browser, opts = {}) {
  const page = await browser.newPage();
  await page.setViewport(opts.viewport || MOBILE);
  if (!opts.viewport) await page.setUserAgent(UA);
  page.consoleErrors = [];
  page.on('pageerror', (e) => page.consoleErrors.push(`pageerror: ${String(e.message).slice(0, 160)}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/ERR_BLOCKED_BY_CLIENT|ERR_NAME_NOT_RESOLVED|Failed to load resource/.test(t)) return;
    page.consoleErrors.push(t.slice(0, 160));
  });
  await hardenPage(page, opts);
  return page;
}
async function open(page, url) {
  await page.goto(ORIGIN + url, { waitUntil: 'domcontentloaded', timeout: 300000 });
}
async function waitText(page, text, timeout = 30000) {
  try {
    await page.waitForFunction((t) => document.body && document.body.innerText.includes(t), { timeout }, text);
    return true;
  } catch { return false; }
}
async function clickText(page, text, { exact = false, last = false } = {}) {
  return page.evaluate((t, ex, la) => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const els = [...document.querySelectorAll('button, a, [role="button"], [role="tab"]')].filter((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      const x = norm(el.innerText);
      return ex ? x === t : x.includes(t);
    });
    const el = la ? els[els.length - 1] : els[0];
    if (!el) return false;
    el.click();
    return true;
  }, text, exact, last);
}
async function nav(page, label) {
  return page.evaluate((l) => {
    const n = document.querySelector('nav[aria-label="Navigation principale"]');
    if (!n) return false;
    const b = [...n.querySelectorAll('button, a')].find((x) => (x.innerText || '').includes(l));
    if (!b) return false;
    b.click();
    return true;
  }, label);
}
async function shot(page, name, { settle = 1500 } = {}) {
  await sleep(settle);
  await page.waitForFunction(() => !/Chargement|Loading/.test(document.body.innerText), { timeout: 60000 }).catch(() => {});
  await sleep(700);
  await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 88 });
  if (TEXT_OUT) fs.writeFileSync(path.join(TEXT_OUT, `${LANG}-${name}.txt`), await page.evaluate(() => document.body.innerText));
  const errors = page.consoleErrors.splice(0);
  console.log(`  ${name}${errors.length ? '  ! ' + errors[0] : ''}`);
}
async function typeIn(page, selector, text) {
  const el = await page.waitForSelector(selector, { timeout: 90000 });
  await el.click();
  await el.evaluate((e) => e.select?.());
  await el.type(text, { delay: 8 });
}
async function typeNth(page, index, text) {
  await page.waitForFunction((n) => document.querySelectorAll('input:not([type="checkbox"]):not([type="hidden"])').length > n, { timeout: 90000 }, index);
  await sleep(400);
  const inputs = await page.$$('input:not([type="checkbox"]):not([type="hidden"])');
  await inputs[index].click();
  await inputs[index].evaluate((e) => e.select?.());
  await inputs[index].type(text, { delay: 8 });
}
// Variantes de l'état des fausses données.
function setPot(paidCount) {
  // Premier tour du cercle : Awa, l'organisatrice, reçoit le pot quand tout le monde a cotisé.
  DB.payouts = [];
  DB.groups[0].current_payout_index = 0;
  DB.group_members.filter((m) => m.group_id === G1).forEach((m, i) => { m.payout_position = i; });
  DB.contributions = DB.contributions.filter((c) => c.group_id !== G1);
  // Awa cotise en dernier : avant cela, le bouton « Cotiser » la concerne.
  [person(1), person(2), person(3), person(4), person(5), ME].forEach((u, i) => {
    DB.contributions.push({ ...contrib(`d9000000-0000-4000-8000-00000000000${i}`, G1, u, 10000, 0, i < paidCount ? 'paid' : 'pending'), period: '2026-11', date: later(2).slice(0, 10) });
  });
}
const CLEAN = () => JSON.parse(JSON.stringify(DB));
async function logged(browser, storageKey) {
  const p = await newPage(browser, { session: makeSession(), storageKey });
  await open(p, '/');
  await waitText(p, EN ? 'Recharge' : 'Recharger', 120000);
  await sleep(1500);
  return p;
}

async function createPart(browser, storageKey) {
  let p;
  // --- Créer un cercle
  p = await logged(browser, storageKey);
  await nav(p, EN ? 'Circles' : 'Cercles');
  await sleep(1500);
  await shot(p, 'circles');
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /créer|ajouter|nouveau|create|add|new/i.test(x.getAttribute('aria-label') || ''));
    b?.click();
  });
  await shot(p, 'circles-add', { settle: 800 });
  await clickText(p, EN ? 'Create' : 'Créer');
  await sleep(1500);
  await typeIn(p, '#name', NEW_CIRCLE);
  await typeIn(p, '#contributionAmount', '10000');
  await typeIn(p, '#maxMembers', '6');
  await p.evaluate(() => document.activeElement?.blur());
  await shot(p, 'create-1', { settle: 600 });
  await clickText(p, EN ? 'Continue' : 'Continuer', { last: true });
  await shot(p, 'create-2', { settle: 900 });
  await clickText(p, EN ? 'Continue' : 'Continuer', { last: true });
  await sleep(900);
  await p.click('#terms').catch(() => console.log('  (case des conditions introuvable)'));
  const canvas = await p.$('canvas');
  if (canvas) {
    const r = await canvas.boundingBox();
    const y = (k) => r.y + r.height * k;
    await p.mouse.move(r.x + r.width * 0.2, y(0.6));
    await p.mouse.down();
    for (let i = 0; i <= 26; i++) await p.mouse.move(r.x + r.width * (0.2 + i * 0.022), y(0.5 + 0.22 * Math.sin(i * 0.9)));
    await p.mouse.up();
  } else console.log('  (signature introuvable)');
  await shot(p, 'create-3', { settle: 500 });
  await clickText(p, EN ? 'Create my circle' : 'Créer mon cercle', { last: true });
  await sleep(6000);
  await shot(p, 'invite', { settle: 500 });
  await p.close();
}

async function run(browser) {
  const base = CLEAN();
  const restore = () => { Object.keys(base).forEach((k) => { DB[k] = JSON.parse(JSON.stringify(base[k])); }); };

  const ONLY = process.env.ONLY || '';
  // --- Inscription
  let p = await newPage(browser);
  await open(p, '/');
  await waitText(p, EN ? 'Discover' : 'Découvrir');
  const storageKey = await p.evaluate(async () => (await import('/src/lib/supabase.ts')).supabase.auth.storageKey);
  await shot(p, 'welcome');
  if (ONLY === 'create') { await p.close(); await createPart(browser, storageKey); return; }
  await clickText(p, EN ? 'Discover' : 'Découvrir');
  await sleep(1200);
  await shot(p, 'slide-1', { settle: 1200 });
  await clickText(p, EN ? 'Next' : 'Suivant');
  await shot(p, 'slide-2', { settle: 1200 });
  await clickText(p, EN ? 'Skip' : 'Passer');
  await waitText(p, EN ? 'Create a tontine' : 'Créer une tontine');
  await shot(p, 'intent', { settle: 800 });
  await clickText(p, EN ? 'Create a tontine' : 'Créer une tontine');
  await sleep(900);
  await typeNth(p, 0, 'Awa Koffi');
  await typeNth(p, 1, 'awa@exemple.tg');
  await typeNth(p, 2, 'Tontine2026!');
  await p.evaluate(() => document.activeElement?.blur());
  await shot(p, 'register', { settle: 500 });
  await clickText(p, EN ? 'Next Step' : 'Étape Suivante');
  await sleep(1500);
  await shot(p, 'avatar', { settle: 1500 });
  await clickText(p, EN ? 'Create my account' : 'Créer mon compte', { last: true });
  await waitText(p, '@exemple.tg', 60000);
  await shot(p, 'code-empty', { settle: 500 });
  await typeNth(p, 0, '48201736');
  await sleep(3000);
  await shot(p, 'code', { settle: 300 });
  await p.close();
  const intentDone = true;

  // --- Accueil et assistant
  setPot(1);
  p = await logged(browser, storageKey);
  await shot(p, 'home', { settle: 2500 });
  await nav(p, 'Assistant');
  await shot(p, 'assistant', { settle: 1500 });
  await clickText(p, EN ? 'How can I raise' : 'Comment faire monter');
  await shot(p, 'assistant-answer', { settle: 800 });
  await nav(p, EN ? 'Savings' : 'Épargne');
  await shot(p, 'savings', { settle: 2000 });
  await p.close();

  // --- Alerte avant un retard
  restore();
  DB.profiles[0].wallet_balance = 7500;
  DB.contributions.push({ ...contrib('d8000000-0000-4000-8000-000000000001', G1, ME, 10000, 0, 'pending'), date: later(3).slice(0, 10), period: '2026-12' });
  p = await logged(browser, storageKey).catch(() => null);
  if (p) { await shot(p, 'home-alert', { settle: 6000 }); await p.close(); }
  restore();

  await createPart(browser, storageKey);

  // --- Cotiser, le pot, recevoir
  const openCircle = async (page) => {
    await nav(page, EN ? 'Circles' : 'Cercles');
    await sleep(1800);
    const row = await page.evaluateHandle((c) => [...document.querySelectorAll('main button')].find((e) => (e.innerText || '').includes(c)), CIRCLE);
    if (row.asElement()) await row.asElement().click();
    await sleep(2000);
  };
  setPot(4);
  p = await logged(browser, storageKey);
  await openCircle(p);
  await shot(p, 'circle', { settle: 800 });
  await clickText(p, EN ? 'Contribute' : 'Cotiser');
  await shot(p, 'pay', { settle: 2500 });
  await p.close();

  p = await logged(browser, storageKey);
  await openCircle(p);
  await clickText(p, EN ? 'Contributions' : 'Cotisations');
  await shot(p, 'pot-partial', { settle: 2000 });
  await p.close();

  setPot(6);
  p = await logged(browser, storageKey);
  await openCircle(p);
  await clickText(p, EN ? 'Contributions' : 'Cotisations');
  await shot(p, 'pot-full', { settle: 2000 });
  await clickText(p, EN ? 'Distribute' : 'Distribuer');
  await shot(p, 'distribute', { settle: 1000 });
  await p.close();
  restore();

  DB.profiles[0].wallet_balance = 185000;
  DB.wallet_transactions.unshift(tx('f0000000-0000-4000-8000-000000000009', 60000, 'payout_credit', (EN ? 'Payout - ' : 'Encaissement - ') + CIRCLE, 0));
  p = await logged(browser, storageKey);
  await shot(p, 'received', { settle: 2500 });
  await p.close();
  restore();

  // --- Recharger, retirer
  p = await logged(browser, storageKey);
  await clickText(p, EN ? 'Recharge' : 'Recharger');
  await sleep(2000);
  await typeNth(p, 0, '10000');
  await p.evaluate(() => document.activeElement?.blur());
  await shot(p, 'topup-1', { settle: 800 });
  await clickText(p, EN ? 'Continue' : 'Continuer', { last: true });
  await shot(p, 'topup-2', { settle: 1200 });
  await p.close();

  p = await logged(browser, storageKey);
  await clickText(p, EN ? 'Withdraw' : 'Retirer');
  await sleep(2000);
  await typeNth(p, 0, '20000');
  await p.evaluate(() => document.activeElement?.blur());
  await shot(p, 'withdraw-1', { settle: 800 });
  await clickText(p, EN ? 'Continue' : 'Continuer', { last: true });
  await sleep(1000);
  await typeNth(p, 0, '90123456');
  await p.evaluate(() => document.activeElement?.blur());
  await shot(p, 'withdraw-2', { settle: 800 });
  await clickText(p, EN ? 'Continue' : 'Continuer', { last: true });
  await shot(p, 'withdraw-3', { settle: 1200 });
  await clickText(p, EN ? 'Continue' : 'Continuer', { last: true });
  await sleep(1000);
  await typeNth(p, 0, '4821').catch(() => {});
  await p.evaluate(() => document.activeElement?.blur());
  await shot(p, 'withdraw-4', { settle: 800 });
  await p.close();
}

/* ------------------------------ SERVEUR VITE ------------------------------ */
function portOpen() {
  return new Promise((res) => {
    const s = net.connect(PORT, '127.0.0.1');
    s.once('connect', () => { s.destroy(); res(true); });
    s.once('error', () => res(false));
  });
}
function portOpenAny() {
  return new Promise((res) => {
    const s = net.connect(PORT, 'localhost');
    s.once('connect', () => { s.destroy(); res(true); });
    s.once('error', () => res(false));
  });
}

async function main() {
  const exe = BROWSERS.find((b) => fs.existsSync(b));
  if (!exe) throw new Error('Ni Chrome ni Edge trouvés.');
  if ((await portOpen()) || (await portOpenAny())) throw new Error(`Le port ${PORT} est déjà occupé : arrêtez ce processus puis relancez.`);

  const vite = spawn(`npx vite --port ${PORT} --strictPort`, { cwd: PROJECT, shell: true, stdio: 'ignore', windowsHide: true });
  const stopVite = () => {
    try { execSync(`taskkill /PID ${vite.pid} /T /F`, { stdio: 'ignore' }); } catch { /* déjà arrêté */ }
  };
  let browser;
  try {
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { up = await portOpen() || await portOpenAny(); if (!up) await sleep(500); }
    if (!up) throw new Error('Vite n’a pas démarré.');
    browser = await puppeteer.launch({
      executablePath: exe,
      headless: true,
      args: [
        '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1, EXCLUDE fonts.googleapis.com, EXCLUDE fonts.gstatic.com',
        '--no-proxy-server',
        '--disable-background-networking',
        '--disable-component-update',
        '--disable-sync',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-features=DnsOverHttps,Translate,OptimizationHints',
      ],
    });
    // Préchauffe : Vite pré-empaquette les dépendances au premier chargement puis recharge la page.
    const warm = await newPage(browser);
    await open(warm, '/');
    await waitText(warm, EN ? 'account' : 'compte', 180000);
    await sleep(3000);
    await warm.close();
    await run(browser);
  } finally {
    if (browser) await browser.close().catch(() => {});
    stopVite();
    netlog.writesAnsweredInMemory = [...new Set(netlog.writesAnsweredInMemory)];
    netlog.unknownTables = [...new Set(netlog.unknownTables)];
    console.log('\nRéseau :', JSON.stringify(netlog));
    await sleep(800);
    console.log((await portOpen()) || (await portOpenAny()) ? `ATTENTION : le port ${PORT} répond encore.` : 'Serveur Vite arrêté.');
  }
}
main().catch((e) => { console.error('ERREUR :', e.message); process.exitCode = 1; });
