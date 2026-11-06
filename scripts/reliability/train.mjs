// Entraîne le score de fiabilité eganyé : régression logistique, sans dépendance.
//
//   node scripts/reliability/train.mjs             données de départ simulées
//   node scripts/reliability/train.mjs export.json données réelles anonymisées
//
// Sortie : scripts/reliability/model.json et le SQL de public._reliability_model().
//
// HONNÊTETÉ : sans fichier en argument, le modèle apprend sur des membres SIMULÉS,
// selon les hypothèses de simulate() ci-dessous. Sa précision mesure alors sa capacité
// à retrouver ces hypothèses, PAS sa capacité à prédire de vrais retards. Il faudra le
// réentraîner et le mesurer sur l'historique réel d'eganyé quand il sera suffisant.
//
// Format de export.json : [{ "on_time_rate": 0.9, "recent_late_rate": 0, "open_late": 0,
//   "experience": 2.3, "late_after_payout": 0, "label": 0 }] ; label = 1 si la cotisation
// suivante a été en retard. Aucune donnée personnelle n'est nécessaire.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Comportement de cotisation uniquement. Exclus volontairement : solde, montants, genre,
// âge, lieu, langue, opérateur, niveau KYC, nom. Ils n'entrent pas dans le modèle.
export const FEATURES = ['on_time_rate', 'recent_late_rate', 'open_late', 'experience', 'late_after_payout'];

// Générateur reproductible (mulberry32) : même graine, même modèle.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

/**
 * Hypothèses de départ :
 *  - chaque membre a une régularité propre, stable dans le temps ;
 *  - les difficultés arrivent par périodes : un retard rend le suivant plus probable ;
 *  - après avoir reçu sa part, une partie des membres se relâche ;
 *  - tout le monde a parfois un imprévu, même les plus réguliers.
 */
function simulate(count, seed) {
  const random = rng(seed);
  const rows = [];
  for (let m = 0; m < count; m++) {
    const discipline = -3.2 + random() * 3.6; // log-cote de base d'être en retard
    const slackAfterPayout = random() < 0.25 ? 0.4 + random() * 1.2 : 0;
    const history = 3 + Math.floor(random() * 34);
    const payoutAt = Math.floor(random() * (history + 4));
    const lates = [];
    let lateAfter = 0;
    let countAfter = 0;
    let previousLate = false;
    for (let i = 0; i <= history; i++) {
      const after = i > payoutAt;
      const p = sigmoid(discipline + (previousLate ? 1.1 : 0) + (after ? slackAfterPayout : 0) + (random() - 0.5) * 0.6);
      const late = random() < p;
      if (i === history) {
        const n = lates.length;
        const lateCount = lates.filter(Boolean).length;
        const recent = lates.slice(-3);
        // Un retard encore ouvert : le plus récent, s'il n'a pas été rattrapé.
        const open = lates[n - 1] && random() < 0.35 ? 1 + Math.floor(random() * 2) : 0;
        rows.push({
          on_time_rate: (n - lateCount) / n,
          recent_late_rate: recent.filter(Boolean).length / recent.length,
          open_late: open,
          experience: Math.log(1 + Math.min(n, 36)),
          late_after_payout: countAfter ? lateAfter / countAfter : 0,
          label: late ? 1 : 0,
        });
        break;
      }
      lates.push(late);
      if (after) {
        countAfter++;
        if (late) lateAfter++;
      }
      previousLate = late;
    }
  }
  return rows;
}

function train(rows, { epochs = 3000, rate = 0.3, l2 = 0.001 } = {}) {
  const means = FEATURES.map((f) => rows.reduce((s, r) => s + r[f], 0) / rows.length);
  const stds = FEATURES.map((f, j) => Math.sqrt(rows.reduce((s, r) => s + (r[f] - means[j]) ** 2, 0) / rows.length) || 1);
  const X = rows.map((r) => FEATURES.map((f, j) => (r[f] - means[j]) / stds[j]));
  const y = rows.map((r) => r.label);
  const w = FEATURES.map(() => 0);
  let b = 0;
  for (let e = 0; e < epochs; e++) {
    const gw = w.map(() => 0);
    let gb = 0;
    for (let i = 0; i < X.length; i++) {
      const err = sigmoid(b + X[i].reduce((s, x, j) => s + x * w[j], 0)) - y[i];
      gb += err;
      for (let j = 0; j < w.length; j++) gw[j] += err * X[i][j];
    }
    b -= (rate * gb) / X.length;
    for (let j = 0; j < w.length; j++) w[j] -= rate * (gw[j] / X.length + l2 * w[j]);
  }
  // Retour aux unités d'origine, pour que SQL calcule sans normaliser.
  const coefficients = Object.fromEntries(FEATURES.map((f, j) => [f, w[j] / stds[j]]));
  const intercept = b - FEATURES.reduce((s, f, j) => s + (w[j] * means[j]) / stds[j], 0);
  return { intercept, coefficients };
}

export const predict = (model, row) =>
  sigmoid(model.intercept + FEATURES.reduce((s, f) => s + model.coefficients[f] * row[f], 0));

function auc(model, rows) {
  const scored = rows.map((r) => [predict(model, r), r.label]).sort((a, b) => a[0] - b[0]);
  let rank = 0;
  let sumPositive = 0;
  let positives = 0;
  for (const [, label] of scored) {
    rank++;
    if (label) {
      sumPositive += rank;
      positives++;
    }
  }
  const negatives = scored.length - positives;
  return (sumPositive - (positives * (positives + 1)) / 2) / (positives * negatives);
}

function calibration(model, rows) {
  const scored = rows.map((r) => [predict(model, r), r.label]).sort((a, b) => a[0] - b[0]);
  const size = Math.floor(scored.length / 5);
  return Array.from({ length: 5 }, (_, i) => {
    const part = scored.slice(i * size, i === 4 ? scored.length : (i + 1) * size);
    return {
      predit: +(part.reduce((s, x) => s + x[0], 0) / part.length).toFixed(3),
      observe: +(part.reduce((s, x) => s + x[1], 0) / part.length).toFixed(3),
    };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  const data = file ? JSON.parse(readFileSync(file, 'utf8')) : simulate(6000, 20261106);
  const cut = Math.floor(data.length * 0.8);
  const model = train(data.slice(0, cut));
  const test = data.slice(cut);
  const round = (v) => +v.toFixed(4);

  const output = {
    version: file ? 'reel-1' : 'depart-1',
    trainedOn: file ? 'historique réel anonymisé' : 'membres simulés (voir simulate)',
    trainedAt: new Date().toISOString().slice(0, 10),
    examples: data.length,
    intercept: round(model.intercept),
    coefficients: Object.fromEntries(Object.entries(model.coefficients).map(([k, v]) => [k, round(v)])),
    test: { auc: +auc(model, test).toFixed(3), lateRate: +(test.reduce((s, r) => s + r.label, 0) / test.length).toFixed(3), calibration: calibration(model, test) },
  };

  const here = dirname(fileURLToPath(import.meta.url));
  writeFileSync(join(here, 'model.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  console.log(`
-- À mettre dans une nouvelle migration après chaque réentraînement :
create or replace function public._reliability_model()
returns jsonb language sql immutable set search_path = public
as $$ select '${JSON.stringify({ version: output.version, intercept: output.intercept, coefficients: output.coefficients })}'::jsonb $$;`);
}
