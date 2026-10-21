// Voix off de la vidéo de présentation : une réplique par moment de l'image,
// synthétisée avec les voix neuronales de Microsoft (edge-tts, en ligne).
//
//   pip install edge-tts
//   node video/build-voice.mjs        → video/voix/*.mp3, puis build-audio.mjs les mixe
//
// Les fichiers .mp3 sont versionnés : refaire la bande-son ne demande ni
// réseau ni edge-tts, seulement si l'on change une réplique.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const VOICE = 'fr-FR-VivienneMultilingualNeural';
const RATE = '+4%';

// [instant de départ (s), texte]. Chaque réplique doit finir avant la suivante.
export const LINES = [
  [3.3, 'eganyé. La tontine et l’épargne, réinventées.'],
  [7.4, 'Le cahier qui se perd. Les cotisations oubliées. Qui a payé, qui manque ?'],
  [12.6, 'Et si tout tenait dans votre poche ?'],
  [15.6, 'Bienvenue sur eganyé : vos tontines, enfin dans votre poche. Avec Flooz ou T-Money, entre proches.'],
  [24.5, 'Créez votre cercle en trente secondes, avec vos propres règles.'],
  [29.0, 'Invitez vos proches, par lien, par code ou par QR code.'],
  [33.5, 'Et voilà vos proches, réunis dans un seul cercle.'],
  [37.6, 'Cotisez depuis votre téléphone, en quelques secondes.'],
  [41.4, 'Chaque versement remplit le pot du cercle.'],
  [46.4, 'Et chaque franc est visible par tout le cercle.'],
  [49.5, 'Trois façons de choisir qui reçoit le pot : tour par tour, tirage au sort, ou enchères.'],
  [55.9, 'Le pot arrive sur votre portefeuille eganyé.'],
  [59.5, 'Et aussi : Ma Banque, pour mettre de côté sans y toucher. Des rappels avant chaque échéance. Une discussion et un calendrier pour le cercle. Et un score qui récompense votre régularité.'],
  [71.5, 'Besoin d’argent pour votre activité ? Avec le Coup de pouce, présentez votre projet en vidéo : c’est une aide, rien à rembourser.'],
  [78.6, 'Ou demandez un microcrédit, remboursable de trois à vingt-quatre mois.'],
  [83.6, 'Votre argent est protégé à chaque étape : code PIN, empreinte, et des opérations vérifiées côté serveur.'],
  [93.6, 'Votre premier cercle, en deux minutes. eganyé : épargner ensemble.'],
];

const dir = fileURLToPath(new URL('./voix/', import.meta.url));
mkdirSync(dir, { recursive: true });
const durations = [];
LINES.forEach(([t, text], i) => {
  const file = path.join(dir, String(i + 1).padStart(2, '0') + '.mp3');
  // le service décroche parfois : quelques nouvelles tentatives avant d'abandonner
  let r;
  for (let essai = 0; essai < 5; essai++) {
    r = spawnSync('python', ['-m', 'edge_tts', '--voice', VOICE, '--rate=' + RATE, '--text', text, '--write-media', file], { stdio: ['ignore', 'ignore', 'pipe'] });
    if (!r.status) break;
    spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 3000)']);
  }
  if (r.status) { console.error(r.stderr.toString().trim().split(/\r?\n/).pop()); process.exit(r.status); }
  const d = parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).stdout);
  durations.push(d);
  const next = LINES[i + 1]?.[0] ?? 100.5;
  const warn = t + d > next - 0.15 ? `  ⚠ déborde de ${(t + d - next).toFixed(2)} s` : '';
  console.log(`${String(i + 1).padStart(2)}  ${t.toFixed(1)} → ${(t + d).toFixed(1)} s${warn}`);
});
writeFileSync(path.join(dir, 'repliques.json'), JSON.stringify(LINES.map(([t, text], i) => ({ t, text, file: String(i + 1).padStart(2, '0') + '.mp3', duree: +durations[i].toFixed(2) })), null, 1));
