// Voix off des vidéos, avec les voix neuronales de Microsoft (edge-tts, en ligne).
//
//   pip install edge-tts
//   node video/build-voice.mjs            → les quatre versions
//   node video/build-voice.mjs tutorial fr
//
// Écrit video/voix/<vidéo>-<langue>/*.mp3, repliques.json et repliques.js (lu par les pages).
// Les .mp3 sont versionnés : refaire la vidéo ne demande ni réseau ni edge-tts, seulement
// si l'on change une réplique. Les répliques du tutoriel dictent la durée de ses étapes.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BAR, PRESENTATION, PRESENTATION_BARS, TUTORIAL, VOICES, speak } from './scripts.mjs';

const synth = (text, lang, rate, file) => {
  let r;
  // le service décroche parfois : quelques nouvelles tentatives avant d'abandonner
  for (let essai = 0; essai < 5; essai++) {
    r = spawnSync('python', ['-m', 'edge_tts', '--voice', VOICES[lang].voice, '--rate=' + rate, '--text', speak(text, lang), '--write-media', file], { stdio: ['ignore', 'ignore', 'pipe'] });
    if (!r.status) break;
    spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 3000)']);
  }
  if (r.status) { console.error(r.stderr.toString().trim().split(/\r?\n/).pop()); process.exit(r.status); }
  return parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).stdout);
};

const build = (video, lang) => {
  const dir = fileURLToPath(new URL(`./voix/${video}-${lang}/`, import.meta.url));
  mkdirSync(dir, { recursive: true });
  const rate = VOICES[lang][video];
  const out = [];
  let warned = 0;

  if (video === 'presentation') {
    const idx = lang === 'fr' ? 1 : 2;
    PRESENTATION.forEach((line, i) => {
      const t = line[0] * BAR;
      const file = String(i + 1).padStart(2, '0') + '.mp3';
      const duree = synth(line[idx], lang, rate, path.join(dir, file));
      const next = PRESENTATION[i + 1] ? PRESENTATION[i + 1][0] * BAR : PRESENTATION_BARS * BAR;
      const over = t + duree - (next - 0.1);
      if (over > 0) { warned++; console.log(`  ⚠ ${video}-${lang} ${i + 1} déborde de ${over.toFixed(2)} s : ${line[idx]}`); }
      out.push({ t: +t.toFixed(3), text: line[idx], file, duree });
    });
  } else {
    // Le tutoriel se cale sur la voix : chaque étape dure sa réplique, plus un temps pour regarder.
    let t = 0.6;
    TUTORIAL.forEach((step, i) => {
      const file = String(i + 1).padStart(2, '0') + '.mp3';
      const duree = synth(step[lang], lang, rate, path.join(dir, file));
      out.push({ t: +t.toFixed(3), text: step[lang], file, duree, step: i });
      t += duree + (step.end ? 2.4 : 0.85);
    });
  }
  writeFileSync(path.join(dir, 'repliques.json'), JSON.stringify(out, null, 1));
  writeFileSync(path.join(dir, 'repliques.js'), `window.__LINES = ${JSON.stringify(out)};\n`);
  const last = out[out.length - 1];
  console.log(`${video}-${lang} : ${out.length} répliques, fin de voix à ${(last.t + last.duree).toFixed(1)} s${warned ? `, ${warned} débordement(s)` : ''}`);
};

const [video, lang] = process.argv.slice(2);
for (const v of video ? [video] : ['presentation', 'tutorial']) {
  for (const l of lang ? [lang] : ['fr', 'en']) build(v, l);
}
