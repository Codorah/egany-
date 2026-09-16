import fs from 'node:fs/promises';
import sharp from 'sharp';

/**
 * Déploie la pièce eganyé (brand-sources/logo.png) comme logo de l'app.
 *
 * Un rendu 3D portant le mot « eganyé » écrit à l'intérieur ne survit pas aux
 * petites tailles : testé à 16 px, le mot devient une bouillie illisible ; à
 * 32 px il est à la limite ; à partir de 48 px il est net. On sert donc deux
 * marques issues de la même identité plutôt qu'une seule qui échoue à moitié :
 *
 *   >= 48 px  ->  la pièce complète (rendu)
 *   <  48 px  ->  la même pièce réduite à un « e » (SVG ci-dessous)
 *
 * Couleurs prélevées directement dans le rendu pour que les deux coïncident.
 */

const COIN = 'brand-sources/logo.png';

const C = {
  discTop: '#C84F12',
  discBottom: '#9D320A',
  ringLight: '#E8DDC9',
  ringShade: '#D0BEA3',
  letter: '#F2E7D2',
};

/** Pièce simplifiée : lisible à 16 px, là où le mot complet ne l'est plus. */
function coinMarkSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Eganyé">
  <defs>
    <linearGradient id="coinDisc" x1="20" y1="14" x2="44" y2="50" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.discTop}"/>
      <stop offset="1" stop-color="${C.discBottom}"/>
    </linearGradient>
    <linearGradient id="coinRing" x1="14" y1="10" x2="50" y2="54" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.ringLight}"/>
      <stop offset="1" stop-color="${C.ringShade}"/>
    </linearGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="url(#coinRing)"/>
  <circle cx="32" cy="32" r="30" fill="none" stroke="${C.ringShade}" stroke-width="1.5"/>
  <circle cx="32" cy="32" r="22" fill="url(#coinDisc)"/>
  <text x="32" y="43" text-anchor="middle" font-family="Trebuchet MS, Arial Rounded MT Bold, Arial, sans-serif"
        font-size="30" font-weight="700" fill="${C.letter}">e</text>
</svg>`;
}

async function main() {
  const mark = coinMarkSvg();
  await fs.writeFile('public/brand-visuals/coin-mark.svg', mark, 'utf8');
  await fs.writeFile('public/favicon.svg', mark, 'utf8');
  await fs.writeFile('public/icons/icon.svg', mark, 'utf8');

  const coin = await sharp(COIN).trim({ threshold: 8 }).toBuffer();
  const markBuf = Buffer.from(mark);

  // Sous 48 px on sert la marque simplifiée, au-dessus la pièce rendue.
  for (const size of [16, 32]) {
    await sharp(markBuf).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toFile(`public/icons/icon-${size}.png`);
  }
  await sharp(markBuf).resize(32, 32).png().toFile('public/favicon.png');

  for (const size of [48, 72, 96, 128, 144, 152, 180, 192, 384, 512]) {
    await sharp(coin)
      // Marge interne : une icône maskable peut être rognée jusqu'à ~20 %
      // par Android, et la pièce touche déjà ses propres bords.
      .resize(Math.round(size * 0.82), Math.round(size * 0.82), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({
        top: Math.round(size * 0.09), bottom: size - Math.round(size * 0.82) - Math.round(size * 0.09),
        left: Math.round(size * 0.09), right: size - Math.round(size * 0.82) - Math.round(size * 0.09),
        background: '#F8F0E4',
      })
      .flatten({ background: '#F8F0E4' })
      .png()
      .toFile(`public/icons/icon-${size}.png`);
  }

  // Logos PNG servis ailleurs dans l'app
  for (const out of ['public/logo.png', 'public/logo-mark.png', 'public/logo-emblem.png']) {
    await sharp(coin).resize(512, 512, { fit: 'inside' }).png().toFile(out);
  }
  await fs.copyFile('public/icons/icon-512.png', 'resources/icon.png');

  console.log('Logo pièce déployé : marque simplifiée < 48 px, rendu complet au-delà.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
