// Bande-son de la vidéo de présentation, entièrement synthétisée, puis
// collée sur public/video/eganye-presentation.mp4 (l'image n'est pas recodée).
//
//   node video/build-audio.mjs
//
// Musique : boucle afro-pop à 112 BPM (kalimba, nappe, basse, percussions),
// I–vi–IV–V en do. À 112 BPM une mesure dure 2,143 s : la 7e mesure tombe
// pile sur la scène « Bienvenue » (15 s), où entre la batterie.
// Bruitages calés sur promo.html : volets de transition, pièce qui se pose,
// cotisations qui tombent dans le pot, « Cercle créé ».
import { writeFileSync, renameSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';

const SR = 44100;
const DUR = 100.5;
const N = Math.ceil(DUR * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);

const BEAT = 60 / 112;
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
const FINAL_BAR = 46; // 98,57 s : accord final
for (let b = 0; b < FINAL_BAR; b++) {
  const t0 = b * BAR; const c = CHORDS[b % 4];
  const calm = b >= 39 && b < 43;          // scène Sécurité : on respire
  const drums = (b >= 7 && b < 39) || b >= 43;
  const intro = b < 3;
  pad(t0, c.pad, BAR, intro ? 0.018 + b * 0.006 : 0.03);
  ARP.forEach((k, i) => {
    if (intro && b === 0 && i < 4) return;
    kalimba(t0 + i * BEAT / 2, c.arp[k], calm ? 0.05 : 0.075, (i % 2 ? 0.35 : -0.35));
  });
  if (b >= 3) [0, 1.5, 2, 3.5].forEach((p, i) => bass(t0 + p * BEAT, c.bass - (i === 3 ? 0 : 12) + 12, drums ? 0.2 : 0.12));
  if (b >= 3) for (let s = 0; s < 16; s++) {
    const sw = s % 2 ? BEAT * 0.06 : 0;
    shaker(t0 + s * BEAT / 4 + sw, (s % 4 === 2 ? 0.07 : 0.04) * (calm ? 0.6 : 1), s % 2 ? 0.4 : -0.2);
  }
  if (drums) {
    kick(t0, 0.55); kick(t0 + 2 * BEAT, 0.5); kick(t0 + 2.75 * BEAT, 0.3);
    clap(t0 + BEAT, 0.22); clap(t0 + 3 * BEAT, 0.22);
  } else if (calm) {
    kick(t0, 0.35);
  }
}
// accord final qui résonne
{
  const t = FINAL_BAR * BAR;
  kick(t, 0.6); pad(t, [48, 60, 64, 67, 72], 1.2, 0.035);
  [72, 76, 79, 84].forEach((m, i) => kalimba(t + i * 0.06, m, 0.09, i * 0.3 - 0.45, 1.9));
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

// ouverture : la pièce tourne puis se pose (~1,75 s), le mot apparaît (3 s)
riser(0.1, 1.65, 0.12);
impact(1.75, 0.6);
ding(1.75, 0.08, 0);
[0, 1, 2, 3, 4, 5].forEach((i) => kalimba(3.0 + i * 0.07, [72, 76, 79, 84, 88, 91][i], 0.05, -0.5 + i * 0.2, 0.8));
// volets de transition
[7, 15, 24, 37, 49, 59, 71, 83, 92].forEach((b) => whoosh(b, 0.32));
// les problèmes barrés
[8.3, 9.6, 10.9].forEach((t) => whoosh(t + 0.4, 0.08));
// « Cercle créé ! »
[84, 88, 91, 96].forEach((m, i) => kalimba(28.4 + i * 0.08, m, 0.07, 0.3, 1));
// cotisations qui tombent dans le pot (scène 5 : 37 + 2,6 + i × 0,85)
for (let i = 0; i < 8; i++) ding(37 + 2.6 + i * 0.85, 0.07, 0.3);
// roue du tirage qui s'arrête, puis « Ama reçoit le pot »
ding(55.0, 0.08, 0);
// pièce finale
riser(92.2, 1.2, 0.08);
impact(93.4, 0.45);

// --------------------------------------------------------------- mixage
const fadeOut = (DUR - 1.6) * SR;
let peak = 0;
for (let k = 0; k < N; k++) {
  const f = Math.min(1, k / (0.05 * SR)) * (k > fadeOut ? Math.max(0, 1 - (k - fadeOut) / (1.6 * SR)) : 1);
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
const mp4 = fileURLToPath(new URL('../public/video/eganye-presentation.mp4', import.meta.url));
const out = path.join(tmp, 'avec-son.mp4');
const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', mp4, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
  '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
if (r.status) process.exit(r.status);
renameSync(out, mp4);
console.log('bande-son ajoutée :', mp4, '(wav :', wav + ')');
