import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Photographies d'accueil — vraies photos sous licence Unsplash.
 *
 * Les trois diapos d'accueil utilisaient des images générées : des visages
 * approximatifs, des mains à six doigts et des étals qui ne ressemblent à
 * aucun marché réel. Sur un produit d'épargne communautaire ouest-africain,
 * où la confiance est tout, c'est le premier écran qui décide — autant y
 * montrer de vraies personnes.
 *
 * Licence Unsplash : usage commercial autorisé, sans autorisation préalable
 * et sans attribution obligatoire. Les crédits ci-dessous sont conservés par
 * correction envers les photographes, et repris dans public/PHOTO-CREDITS.md.
 *
 * Ces photos sont commitées dans public/ : ce script sert à les régénérer ou
 * à en changer, pas à tourner au build.
 *
 *   node scripts/fetch-onboarding-photos.mjs
 */

const OUT = 'public/onboarding';

// Cadre portrait : les diapos s'affichent en `object-cover` plein écran sur
// des téléphones. Une source paysage y serait rognée sauvagement sur les
// côtés, d'où le recadrage portrait fait ici plutôt que par le navigateur.
const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1620;

const PHOTOS = {
  // Diapo 1 — « la tontine des mamans ». Un vrai marché, de vraies
  // commerçantes : c'est exactement le public d'eganyé.
  'mamas': {
    id: 'cnVn4Gg4b00',
    credit: 'Ifeoluwa A. — Unsplash',
    alt: 'Commerçantes sur un marché ouest-africain',
  },
  // Diapo 2 — les jeunes épargnantes, téléphone en main : l'épargne qui
  // passe par le mobile, sans passer par une agence.
  'young-savers': {
    id: '_t15AWPJNmg',
    credit: 'Sandisk — Unsplash',
    alt: 'Deux jeunes femmes regardant un téléphone en souriant',
  },
  // Diapo 3 — la vendeuse qui réussit. Le smartphone dans sa main raconte
  // l'histoire du produit mieux qu'une légende.
  //
  // `attention` échoue ici : il verrouille sur le visage et cale le cadre si
  // loin à droite que la joue sort de l'image ; un cadrage gauche la fait
  // sortir de l'autre côté. Elle est en fait à peu près au milieu de
  // l'original — le cadrage centré est le bon.
  'vendor': {
    id: '5dFuO02OHh0',
    credit: 'Francis Odeyemi — Unsplash',
    alt: 'Commerçante souriante tenant un téléphone dans sa boutique',
    position: 'centre',
  },
};

async function download(id) {
  // Large source : on recadre ensuite en portrait, donc il faut de la marge
  // sur les côtés pour ne pas finir en dessous de 1080 px de large.
  const url = `https://unsplash.com/photos/${id}/download?force=true&w=2400`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Téléchargement ${id} : HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });

  const lines = [
    '# Crédits photo',
    '',
    'Photographies des écrans d’accueil, sous [licence Unsplash](https://unsplash.com/license)',
    '(usage commercial autorisé, attribution non obligatoire — créditée ici par correction).',
    '',
  ];

  for (const [name, photo] of Object.entries(PHOTOS)) {
    const buffer = await download(photo.id);
    const outPath = path.join(OUT, `${name}.webp`);

    await sharp(buffer)
      .resize({
        width: TARGET_WIDTH,
        height: TARGET_HEIGHT,
        fit: 'cover',
        // `attention` choisit la zone la plus saillante — en pratique le
        // visage. Quand il se trompe (voir 'vendor'), la photo impose son
        // propre cadrage.
        position: photo.position ?? sharp.strategy.attention,
      })
      .webp({ quality: 80, effort: 6 })
      .toFile(outPath);

    const stat = await fs.stat(outPath);
    console.log(`${name.padEnd(14)} ${String(Math.round(stat.size / 1024) + 'KB').padStart(7)}  ${photo.credit}`);

    lines.push(`- **${name}.webp** — ${photo.credit} · https://unsplash.com/photos/${photo.id}`);
  }

  lines.push('');
  await fs.writeFile('public/PHOTO-CREDITS.md', lines.join('\n'), 'utf8');
  console.log('\npublic/PHOTO-CREDITS.md mis à jour.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
