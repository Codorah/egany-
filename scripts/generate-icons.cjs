const sharp = require('sharp');
const path = require('path');

const BRAND = '#4B2E05';
const SIZES = [48, 72, 96, 128, 144, 152, 180, 192, 384, 512];
const SRC = path.join(__dirname, 'assets', 'emblem-master.png');
const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');

async function run() {
  const fs = require('fs');
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const size of SIZES) {
    // 0.62 keeps the shield's corners inside Android's maskable safe-zone circle (80% diameter).
    const emblemDim = Math.round(size * 0.62);
    const emblem = await sharp(SRC)
      .resize({ width: emblemDim, height: emblemDim, fit: 'inside' })
      .toBuffer();
    const emblemMeta = await sharp(emblem).metadata();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: BRAND,
      },
    })
      .composite([
        {
          input: emblem,
          left: Math.round((size - emblemMeta.width) / 2),
          top: Math.round((size - emblemMeta.height) / 2),
        },
      ])
      .png()
      .toFile(path.join(OUT_DIR, `icon-${size}.png`));

    console.log(`icon-${size}.png done`);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
