// Rend une vidéo en MP4, image par image, puis y colle sa bande-son.
//
//   node video/render.mjs presentation fr
//   node video/render.mjs tutorial en
//   node video/render.mjs presentation fr --stills 3,16,40   → captures PNG dans video/stills/
//
// Chaque image est obtenue en plaçant l'horloge à t (window.__seek) puis en faisant une
// capture : le résultat ne dépend pas de la vitesse de la machine. Les polices viennent de
// Google Fonts, il faut donc être en ligne pendant le rendu.
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { CHAPTERS, TUTORIAL } from './scripts.mjs';

const FPS = 30;
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', 'public', 'video');

export const OUTPUT = {
  presentation: { fr: 'eganye-presentation-fr', en: 'eganye-presentation-en' },
  tutorial: { fr: 'eganye-comment-ca-marche-fr', en: 'eganye-how-it-works-en' },
};
const POSTER_T = { presentation: 25.5, tutorial: 22 };

const args = process.argv.slice(2);
const video = args[0] === 'tutorial' ? 'tutorial' : 'presentation';
const lang = args[1] === 'en' ? 'en' : 'fr';
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;

// Données du tutoriel pour la page (scripts.mjs reste la seule source).
writeFileSync(path.join(here, 'tutorial-steps.js'), `window.__STEPS = ${JSON.stringify(TUTORIAL)};\nwindow.__CHAPTERS = ${JSON.stringify(CHAPTERS)};\n`);

const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.error('page :', e.message));
await page.goto(`${pathToFileURL(path.join(here, `${video}.html`)).href}?render=1&lang=${lang}`);
await page.waitForFunction(() => typeof window.__seek === 'function', null, { timeout: 60000 });
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
});
await page.waitForTimeout(500);
const duration = await page.evaluate(() => window.__duration);

const shot = async (t, opts) => {
  await page.evaluate((x) => window.__seek(x), t);
  return page.screenshot(opts);
};

if (stillsArg) {
  const dir = path.join(here, 'stills');
  mkdirSync(dir, { recursive: true });
  for (const t of stillsArg.split(',').map(Number)) {
    await shot(t, { path: path.join(dir, `${video}-${lang}-t${String(t).replace('.', '_')}.png`) });
  }
  console.log('captures dans', dir, '(durée', duration, 's)');
} else {
  mkdirSync(outDir, { recursive: true });
  const name = OUTPUT[video][lang];
  const out = path.join(outDir, `${name}.mp4`);
  const ff = spawn('ffmpeg', [
    '-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=out_range=tv:out_color_matrix=bt709,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', video === 'tutorial' ? '24' : '21', '-color_range', 'tv', '-movflags', '+faststart', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const frames = Math.round(duration * FPS);
  const started = Date.now();
  for (let f = 0; f < frames; f++) {
    const buf = await shot(f / FPS, { type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 300 === 0) console.log(`${f}/${frames} images (${Math.round((Date.now() - started) / 1000)} s)`);
  }
  ff.stdin.end();
  await new Promise((r, j) => ff.on('close', (c) => (c ? j(new Error('ffmpeg ' + c)) : r())));
  await shot(POSTER_T[video], { path: path.join(outDir, `${name}.jpg`), type: 'jpeg', quality: 82 });
  console.log('vidéo :', out);
  await browser.close();
  // l'image vient d'être recodée sans son : on remet la bande-son
  const r = spawnSync(process.execPath, [path.join(here, 'build-audio.mjs'), video, lang, String(duration)], { stdio: 'inherit' });
  process.exit(r.status ?? 0);
}
await browser.close();
