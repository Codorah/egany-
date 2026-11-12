// Sous-titres WebVTT des quatre vidéos, à partir des répliques de la voix off
// (video/voix/*/repliques.json : instant de départ et durée réels de chaque phrase).
//
//   node video/build-captions.mjs   →   public/video/<nom>.vtt
//
// WCAG 1.2.2 : une vidéo avec voix off doit avoir des sous-titres. Le texte est celui
// prononcé, avec « eganyé » écrit normalement (la voix anglaise reçoit une graphie
// phonétique que le lecteur ne doit pas voir).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'public', 'video');
mkdirSync(out, { recursive: true });

const VIDEOS = {
  'eganye-presentation-fr': 'presentation-fr',
  'eganye-presentation-en': 'presentation-en',
  'eganye-comment-ca-marche-fr': 'tutorial-fr',
  'eganye-how-it-works-en': 'tutorial-en',
};

const stamp = (seconds) => {
  const ms = Math.round(seconds * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}.${p(ms % 1000, 3)}`;
};

for (const [name, dir] of Object.entries(VIDEOS)) {
  const lines = JSON.parse(readFileSync(path.join(here, 'voix', dir, 'repliques.json'), 'utf8'));
  const cues = lines.map((line, i) => {
    const next = lines[i + 1]?.t ?? Infinity;
    // Le sous-titre reste un peu après la voix, sans chevaucher la phrase suivante.
    const end = Math.min(line.t + line.duree + 0.35, next - 0.05);
    const text = line.text.replace(/Egan-yay/g, 'eganyé').trim();
    return `${i + 1}\n${stamp(line.t)} --> ${stamp(Math.max(end, line.t + 0.5))}\n${text}\n`;
  });
  writeFileSync(path.join(out, `${name}.vtt`), `WEBVTT\n\n${cues.join('\n')}`);
  console.log(`${name}.vtt : ${cues.length} sous-titres`);
}
