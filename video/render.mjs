// Rend video/promo.html en MP4, image par image.
//
//   node video/render.mjs                    → public/video/eganye-presentation.mp4 + affiche .jpg
//   node video/render.mjs --stills 3,16,40   → captures PNG de contrôle dans video/stills/
//
// Chaque image est obtenue en plaçant l'horloge de la composition à t
// (window.__seek), puis en faisant une capture : le résultat ne dépend pas de
// la vitesse de la machine. Les polices viennent de Google Fonts, il faut donc
// être en ligne pendant le rendu.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const FPS = 30;
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', 'public', 'video');
const out = path.join(outDir, 'eganye-presentation.mp4');
const poster = path.join(outDir, 'eganye-presentation.jpg');
const POSTER_T = 17.5;

const args = process.argv.slice(2);
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;

const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(path.join(here, 'promo.html')).href + '?render=1');
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
});
await page.waitForTimeout(500);
const duration = await page.evaluate(() => window.__duration);

const shot = async (t, opts) => {
  await page.evaluate((t) => window.__seek(t), t);
  return page.screenshot(opts);
};

if (stillsArg) {
  const dir = path.join(here, 'stills');
  mkdirSync(dir, { recursive: true });
  for (const t of stillsArg.split(',').map(Number)) {
    await shot(t, { path: path.join(dir, `t${String(t).replace('.', '_')}.png`) });
  }
  console.log('captures dans', dir);
} else {
  mkdirSync(outDir, { recursive: true });
  const ff = spawn('ffmpeg', [
    '-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const frames = Math.round(duration * FPS);
  const started = Date.now();
  for (let f = 0; f < frames; f++) {
    const buf = await shot(f / FPS, { type: 'jpeg', quality: 94 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 150 === 0) console.log(`${f}/${frames} images (${Math.round((Date.now() - started) / 1000)} s)`);
  }
  ff.stdin.end();
  await new Promise((r, j) => ff.on('close', (c) => (c ? j(new Error('ffmpeg ' + c)) : r())));
  await shot(POSTER_T, { path: poster, type: 'jpeg', quality: 82 });
  console.log('vidéo :', out);
}
await browser.close();
