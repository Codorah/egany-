import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Les visuels livrés sont des rendus 3D exportés en pleine toile : le sujet
 * n'occupe parfois que 2 % des pixels (2400x1350 pour un personnage de
 * 151x350), le reste étant du transparent. Servir ça tel quel ferait passer
 * ~2,2 Mo sur des connexions mobiles ouest-africaines pour afficher des
 * images qui, à l'écran, tiennent dans 300 px.
 *
 * Ce script recadre sur le contenu réel, redimensionne à une taille d'affichage
 * raisonnable et réencode en WebP. Les originaux restent dans brand-sources/, hors du dossier servi : Vite copie
 * public/ tel quel, et ces 2,2 Mo seraient sinon déployés sans jamais servir.
 */

const SRC = 'brand-sources';
const OUT = 'public/brand-visuals';

// nom de sortie -> { fichier source, hauteur cible, recadrage optionnel }
//
// `centerCrop` : coche.png et « Design sans titre.png » ont un panneau
// blanc cassé incrusté dans le rendu, qui se voit comme un rectangle sur le
// fond crème de l'app. On resserre sur le personnage et son badge (le halo
// coloré est conservé), et le composant les affiche dans une carte blanche
// où le reste du panneau se fond.
const JOBS = {
  'logo-coin': { src: 'logo.png', height: 512, fit: 'inside' },
  'mascot-welcome': { src: 'avatarmainsimple.png', height: 640 },
  'mascot-signup': { src: 'page_inscription2.png', height: 640 },
  'mascot-tablet': { src: 'inscription.png', height: 640 },
  'mascot-error': { src: 'avatar_page_erreur2.png', height: 560 },
  'mascot-success': { src: 'coche.png', height: 560, centerCrop: [0.3, 0.42] },
  'mascot-failed': { src: 'Design sans titre.png', height: 560, centerCrop: [0.3, 0.42] },
};

async function main() {
  await fs.mkdir(OUT, { recursive: true });

  let before = 0;
  let after = 0;

  for (const [name, job] of Object.entries(JOBS)) {
    const srcPath = path.join(SRC, job.src);
    const srcStat = await fs.stat(srcPath);
    before += srcStat.size;

    const outPath = path.join(OUT, `${name}.webp`);

    // threshold bas : garde l'ombre douce sous le personnage, qui fait
    // partie du rendu et donne son assise à la figure.
    const trimmed = sharp(srcPath).trim({ threshold: 8 });
    let pipeline = sharp(await trimmed.toBuffer());

    if (job.centerCrop) {
      const { info } = await trimmed.toBuffer({ resolveWithObject: true });
      const [startRatio, widthRatio] = job.centerCrop;
      pipeline = pipeline.extract({
        left: Math.round(info.width * startRatio),
        top: 0,
        width: Math.round(info.width * widthRatio),
        height: info.height,
      });
    }

    await pipeline
      .resize({ height: job.height, fit: job.fit || 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 6 })
      .toFile(outPath);

    const outStat = await fs.stat(outPath);
    after += outStat.size;
    const meta = await sharp(outPath).metadata();
    console.log(
      `${name.padEnd(16)} ${String(meta.width + 'x' + meta.height).padEnd(11)} ` +
        `${String(Math.round(srcStat.size / 1024) + 'KB').padStart(7)} -> ` +
        `${String(Math.round(outStat.size / 1024) + 'KB').padStart(6)}`
    );
  }

  console.log(
    `\nTotal : ${Math.round(before / 1024)}KB -> ${Math.round(after / 1024)}KB ` +
      `(-${Math.round((1 - after / before) * 100)} %)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
