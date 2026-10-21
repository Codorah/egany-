// Extrait les icônes Lucide utilisées par l'app vers video/icons.js, pour que
// la composition (une page HTML sans bundler) dessine les mêmes pictos.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const NAMES = [
  'users', 'smartphone', 'hand-coins', 'piggy-bank', 'bell-ring', 'messages-square',
  'calendar-days', 'trophy', 'gift', 'lock-keyhole', 'shield-check', 'fingerprint',
  'link', 'qr-code', 'hash', 'check', 'arrow-right', 'video', 'shuffle', 'list-ordered',
  'gavel', 'trending-up', 'wallet', 'chevron-left', 'server', 'eye', 'message-circle',
  'sparkles', 'plus',
];

const root = fileURLToPath(new URL('../node_modules/lucide-react/dist/esm/icons/', import.meta.url));
const icons = {};
for (const name of NAMES) {
  const src = readFileSync(root + name + '.js', 'utf8');
  const body = src.match(/const __iconNode = (\[[\s\S]*?\]);\n/)[1];
  const nodes = Function('return ' + body)();
  icons[name] = nodes
    .map(([tag, attrs]) => '<' + tag + Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => ` ${k}="${v}"`).join('') + '/>')
    .join('');
}
writeFileSync(new URL('./icons.js', import.meta.url), 'window.ICONS = ' + JSON.stringify(icons, null, 1) + ';\n');
console.log('icons:', Object.keys(icons).length);
