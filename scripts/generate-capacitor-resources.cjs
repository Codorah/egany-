const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const BRAND = '#4B2E05';
const SRC = path.join(__dirname, 'assets', 'emblem-master.png');
const OUT_DIR = path.join(__dirname, '..', 'resources');

async function run() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Icône source 1024x1024 pour @capacitor/assets (mêmes proportions que
  // public/icons/icon-*.png, cf. scripts/generate-icons.cjs)
  const iconSize = 1024;
  const emblemDim = Math.round(iconSize * 0.62);
  const emblem = await sharp(SRC).resize({ width: emblemDim, height: emblemDim, fit: 'inside' }).toBuffer();
  const emblemMeta = await sharp(emblem).metadata();
  await sharp({ create: { width: iconSize, height: iconSize, channels: 4, background: BRAND } })
    .composite([{ input: emblem, left: Math.round((iconSize - emblemMeta.width) / 2), top: Math.round((iconSize - emblemMeta.height) / 2) }])
    .png()
    .toFile(path.join(OUT_DIR, 'icon.png'));
  console.log('resources/icon.png done');

  // Splash 2732x2732 : fond de marque + emblème centré, plus discret que
  // l'icône (l'écran de démarrage est bref, pas besoin qu'il occupe tout l'espace)
  const splashSize = 2732;
  const splashEmblemDim = Math.round(splashSize * 0.32);
  const splashEmblem = await sharp(SRC).resize({ width: splashEmblemDim, height: splashEmblemDim, fit: 'inside' }).toBuffer();
  const splashEmblemMeta = await sharp(splashEmblem).metadata();
  await sharp({ create: { width: splashSize, height: splashSize, channels: 4, background: BRAND } })
    .composite([{ input: splashEmblem, left: Math.round((splashSize - splashEmblemMeta.width) / 2), top: Math.round((splashSize - splashEmblemMeta.height) / 2) }])
    .png()
    .toFile(path.join(OUT_DIR, 'splash.png'));
  console.log('resources/splash.png done');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
