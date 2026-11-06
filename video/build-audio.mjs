// Bande-son des vidéos, entièrement synthétisée, puis collée sur le MP4 (l'image n'est pas recodée).
//
//   node video/build-audio.mjs presentation fr <durée en secondes>
//
// Présentation : afro-pop énergique à 124 BPM. Chaque changement de scène de presentation.html
// tombe sur une mesure, avec un impact et un souffle : les coupes sont dans la musique.
// Tutoriel : nappe et kalimba à 96 BPM, sans batterie, pour laisser la voix en avant.
// Dans les deux cas la musique s'efface sous la voix (compression en sidechain).
import { writeFileSync, renameSync, mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';

const VIDEO = process.argv[2] === 'tutorial' ? 'tutorial' : 'presentation';
const LANG = process.argv[3] === 'en' ? 'en' : 'fr';
const DUR = parseFloat(process.argv[4]) || 50;
const FILES = {
  presentation: { fr: 'eganye-presentation-fr', en: 'eganye-presentation-en' },
  tutorial: { fr: 'eganye-comment-ca-marche-fr', en: 'eganye-how-it-works-en' },
};

const SR = 44100;
const N = Math.ceil(DUR * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);

const BEAT = 60 / (VIDEO === 'presentation' ? 124 : 96);
const BAR = BEAT * 4;
const TAU = Math.PI * 2;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 12345;
const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x3fffffff) - 1;

// Ajoute un son de `len` secondes à l'instant t, gain g, pan -1…1.
const add = (t, len, g, pan, fn) => {
  const s0 = Math.floor(t * SR);
  const n = Math.floor(len * SR);
  const gl = g * Math.cos((pan + 1) * Math.PI / 4);
  const gr = g * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < n; i++) {
    const k = s0 + i;
    if (k < 0 || k >= N) continue;
    const v = fn(i / SR, i);
    L[k] += v * gl; R[k] += v * gr;
  }
};

// Filtre passe-bande (RBJ) dont la fréquence peut varier dans le temps.
const bandpass = (q) => {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, b0, b2, a1, a2;
  return (x, f) => {
    const w = TAU * f / SR; const al = Math.sin(w) / (2 * q); const a0 = 1 + al;
    b0 = al / a0; b2 = -al / a0; a1 = -2 * Math.cos(w) / a0; a2 = (1 - al) / a0;
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
};

// ------------------------------------------------------------- instruments
const kalimba = (t, m, g, pan, len = 1.2) => {
  const f = mtof(m);
  add(t, len, g, pan, (x) => {
    const a = Math.min(1, x / 0.003);
    return a * (Math.sin(TAU * f * x) * Math.exp(-x * 5) + 0.25 * Math.sin(TAU * 2 * f * x) * Math.exp(-x * 9) + 0.12 * Math.sin(TAU * 5.4 * f * x) * Math.exp(-x * 30));
  });
};
const pad = (t, notes, len, g) => {
  notes.forEach((m, j) => {
    const f = mtof(m); const pan = (j / (notes.length - 1)) * 1.2 - 0.6;
    let lp = 0;
    add(t, len + 0.6, g, pan, (x) => {
      const env = Math.min(1, x / 0.35) * (x > len ? Math.max(0, 1 - (x - len) / 0.6) : 1);
      let v = 0;
      for (const d of [-0.004, 0.004]) {
        const ff = f * (1 + d);
        v += Math.sin(TAU * ff * x) + 0.4 * Math.sin(TAU * 2 * ff * x) + 0.18 * Math.sin(TAU * 3 * ff * x);
      }
      lp += (v - lp) * 0.12;
      return lp * env * 0.5;
    });
  });
};
const bass = (t, m, g) => {
  const f = mtof(m);
  add(t, 0.5, g, 0, (x) => Math.min(1, x / 0.004) * Math.exp(-x * 5) * (Math.sin(TAU * f * x) + 0.3 * Math.sin(TAU * 2 * f * x)));
};
const kick = (t, g) => {
  let ph = 0;
  add(t, 0.4, g, 0, (x) => { ph += TAU * (45 + 85 * Math.exp(-x * 30)) / SR; return Math.sin(ph) * Math.exp(-x * 9); });
};
const clap = (t, g) => {
  const bp = bandpass(1.2);
  add(t, 0.25, g, 0.1, (x) => {
    const env = [0, 0.011, 0.022].reduce((s, o) => s + (x >= o ? Math.exp(-(x - o) * (o === 0.022 ? 22 : 120)) : 0), 0);
    return bp(noise(), 1500) * env * 2.2;
  });
};
const shaker = (t, g, pan) => {
  let prev = 0;
  add(t, 0.08, g, pan, (x) => { const n = noise(); const hp = n - prev; prev = n; return hp * Math.exp(-x * 70) * Math.min(1, x / 0.006); });
};

// ------------------------------------------------------------------ musique
const CHORDS = [
  { bass: 48, pad: [60, 64, 67, 71], arp: [72, 76, 79, 83] }, // Cmaj7
  { bass: 45, pad: [57, 60, 64, 67], arp: [69, 72, 76, 79] }, // Am7
  { bass: 41, pad: [53, 57, 60, 64], arp: [69, 72, 77, 81] }, // Fmaj7
  { bass: 43, pad: [55, 59, 62, 67], arp: [71, 74, 79, 83] }, // G
];
const ARP = [0, 2, 1, 3, 2, 1, 3, 2];
const bars = Math.ceil(DUR / BAR);

if (VIDEO === 'presentation') {
  const LAST = 25; // mesure de l'accord final
  for (let b = 0; b < Math.min(bars, LAST); b++) {
    const t0 = b * BAR; const c = CHORDS[b % 4];
    const breakdown = b >= 18 && b < 19.75;     // « elle ne décide jamais » : on respire
    const drums = b >= 2 && !breakdown;
    pad(t0, c.pad, BAR, 0.026);
    ARP.forEach((k, i) => {
      if (b === 0 && i < 2) return;
      kalimba(t0 + i * BEAT / 2, c.arp[k], breakdown ? 0.05 : 0.08, i % 2 ? 0.4 : -0.4);
    });
    if (b >= 1) [0, 0.75, 1.5, 2, 2.75, 3.5].forEach((p, i) => bass(t0 + p * BEAT, c.bass + (i === 4 ? 12 : 0), breakdown ? 0.14 : 0.3));
    if (b >= 1) for (let s = 0; s < 16; s++) {
      shaker(t0 + s * BEAT / 4 + (s % 2 ? BEAT * 0.05 : 0), (s % 4 === 2 ? 0.09 : 0.05) * (breakdown ? 0.5 : 1), s % 2 ? 0.4 : -0.2);
    }
    if (drums) {
      [0, 1, 2, 3].forEach((p) => kick(t0 + p * BEAT, p % 2 ? 0.42 : 0.58));
      kick(t0 + 3.5 * BEAT, 0.28);
      clap(t0 + BEAT, 0.24); clap(t0 + 3 * BEAT, 0.28);
    }
  }
  const t = LAST * BAR;
  kick(t, 0.6); pad(t, [48, 60, 64, 67, 72], 0.6, 0.03);
} else {
  for (let b = 0; b < bars; b++) {
    const t0 = b * BAR; const c = CHORDS[b % 4];
    pad(t0, c.pad, BAR, 0.024);
    [0, 2, 3, 5, 6].forEach((i) => kalimba(t0 + i * BEAT / 2, c.arp[ARP[i]], 0.038, i % 2 ? 0.35 : -0.35));
    bass(t0, c.bass, 0.11); bass(t0 + 2.5 * BEAT, c.bass, 0.07);
    for (let s = 0; s < 8; s++) shaker(t0 + s * BEAT / 2, 0.016, s % 2 ? 0.3 : -0.3);
  }
}

// ---------------------------------------------------------------- bruitages
const whoosh = (center, g) => {
  const bp = bandpass(0.9); const len = 1.1; const start = center - 0.62;
  const s0 = Math.floor(start * SR);
  for (let i = 0; i < len * SR; i++) {
    const k = s0 + i; if (k < 0 || k >= N) continue;
    const x = i / (len * SR);
    const env = Math.sin(Math.PI * Math.pow(x, 0.8)) ** 2;
    const v = bp(noise(), 300 + 3800 * x) * env * g;
    const pan = x * 2 - 1;
    L[k] += v * Math.cos((pan + 1) * Math.PI / 4); R[k] += v * Math.sin((pan + 1) * Math.PI / 4);
  }
};
const impact = (t, g) => {
  let ph = 0; let lp = 0;
  add(t, 1.6, g, 0, (x) => {
    ph += TAU * (38 + 60 * Math.exp(-x * 12)) / SR;
    lp += (noise() - lp) * 0.08;
    return Math.sin(ph) * Math.exp(-x * 3) + lp * Math.exp(-x * 10) * 0.8;
  });
};
const riser = (t, len, g) => {
  let prev = 0;
  add(t, len, g, 0, (x) => { const n = noise(); const hp = n - prev; prev = n; return hp * Math.pow(x / len, 2.2); });
};
const ding = (t, g, pan) => {
  [2093, 3136, 4186].forEach((f, i) => add(t, 0.7, g * [1, 0.5, 0.25][i], pan, (x) => Math.sin(TAU * f * x) * Math.exp(-x * (6 + i * 4)) * Math.min(1, x / 0.002)));
};

if (VIDEO === 'presentation') {
  impact(0, 0.42); ding(0, 0.06, 0);
  // coupes : un impact et un souffle sur chaque changement de scène
  [2, 4, 6, 9, 12, 15, 16.5, 18.25, 19.75, 21.5, 23.25].forEach((b) => { whoosh(b * BAR, 0.22); impact(b * BAR, 0.26); });
  // un petit son par membre qui cotise (scène du pot)
  for (let i = 0; i < 6; i++) ding(9 * BAR + BAR * 0.5 + i * BEAT * 1.5, 0.07, 0.3);
  // le pot qui arrive
  [84, 88, 91, 96].forEach((m, i) => kalimba(19.75 * BAR + BEAT + i * 0.09, m, 0.07, 0.3, 1));
  riser(22.2 * BAR, BAR, 0.05);
} else {
  // un souffle discret à chaque étape
  const lines = JSON.parse(readFileSync(fileURLToPath(new URL(`./voix/tutorial-${LANG}/repliques.json`, import.meta.url)), 'utf8'));
  lines.slice(1).forEach((l) => whoosh(l.t, 0.03));
}

// --------------------------------------------------------------- mixage
const fadeOut = (DUR - 1.4) * SR;
let peak = 0;
for (let k = 0; k < N; k++) {
  const f = Math.min(1, k / (0.05 * SR)) * (k > fadeOut ? Math.max(0, 1 - (k - fadeOut) / (1.4 * SR)) : 1);
  L[k] = Math.tanh(L[k] * 1.3) * f; R[k] = Math.tanh(R[k] * 1.3) * f;
  peak = Math.max(peak, Math.abs(L[k]), Math.abs(R[k]));
}
const norm = 0.89 / peak;
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let k = 0; k < N; k++) {
  buf.writeInt16LE(Math.round(L[k] * norm * 32767), 44 + k * 4);
  buf.writeInt16LE(Math.round(R[k] * norm * 32767), 46 + k * 4);
}
const tmp = mkdtempSync(path.join(tmpdir(), 'eganye-audio-'));
const wav = path.join(tmp, 'bande-son.wav');
writeFileSync(wav, buf);

// ------------------------------------------------- collage sur la vidéo
const mp4 = fileURLToPath(new URL(`../public/video/${FILES[VIDEO][LANG]}.mp4`, import.meta.url));
const out = path.join(tmp, 'avec-son.mp4');
// Voix off (video/voix, voir build-voice.mjs) : chaque réplique est posée à
// son instant, et la musique s'efface sous la voix (compression en sidechain).
const voixDir = fileURLToPath(new URL(`./voix/${VIDEO}-${LANG}/`, import.meta.url));
const lines = existsSync(path.join(voixDir, 'repliques.json')) ? JSON.parse(readFileSync(path.join(voixDir, 'repliques.json'), 'utf8')) : [];
const inputs = ['-i', mp4, '-i', wav, ...lines.flatMap((l) => ['-i', path.join(voixDir, l.file)])];
let graph = `[1:a]volume=${VIDEO === 'presentation' ? 0.8 : 0.42}[mus]`;
if (lines.length) {
  graph += ';' + lines.map((l, i) => `[${i + 2}:a]aresample=${SR},aformat=channel_layouts=stereo,adelay=${Math.round(l.t * 1000)}:all=1[v${i}]`).join(';');
  graph += `;${lines.map((_, i) => `[v${i}]`).join('')}amix=inputs=${lines.length}:normalize=0,volume=2.0,apad=whole_dur=${DUR}[voix]`;
  graph += `;[voix]asplit[vo][sc];[mus][sc]sidechaincompress=threshold=0.03:ratio=${VIDEO === 'presentation' ? 3.5 : 5}:attack=25:release=350[fond]`;
  graph += ';[fond][vo]amix=inputs=2:normalize=0,alimiter=limit=0.85:level=disabled[a]';
} else {
  graph += ';[mus]anull[a]';
}
const r = spawnSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', graph, '-map', '0:v', '-map', '[a]', '-c:v', 'copy',
  '-c:a', 'aac', '-b:a', '128k', '-t', String(DUR), '-movflags', '+faststart', out], { stdio: 'inherit' });
if (r.status) process.exit(r.status);
renameSync(out, mp4);
console.log('bande-son ajoutée :', mp4, '(wav :', wav + ')');
