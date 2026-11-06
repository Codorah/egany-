import type { ReadyReliability, Reliability, ReliabilityFactor } from './reliability';
import { reliabilityLevel } from './reliability';

/**
 * Assistant eganyé : des règles, sans modèle de langue ni service externe.
 *
 * Il ne répond qu'à partir des données réelles de la personne et n'invente aucun
 * chiffre : s'il ne comprend pas, il le dit et propose ce qu'il sait faire. Il tourne
 * dans le téléphone, donc rien de ce qui est tapé ne sort de l'appareil.
 *
 * Textes en français seulement : aucune traduction éwé n'est publiée tant qu'une
 * personne de langue maternelle ne l'a pas relue (docs/TRADUCTION-EWE.md).
 */

export interface AssistantContribution {
  groupName: string;
  amount: number;
  penalty: number;
  currency: string;
  dueDate: string;
  status: 'pending' | 'late';
}

export interface AssistantCircle {
  name: string;
  nextPayoutDate: string;
  potAmount: number;
  currency: string;
  /** La personne reçoit-elle le prochain versement ? */
  isNextBeneficiary: boolean;
}

export interface AssistantContext {
  firstName: string;
  walletBalance: number;
  contributions: AssistantContribution[];
  circles: AssistantCircle[];
  reliability: Reliability | null;
}

export type AssistantIntent =
  | 'score_change'
  | 'score_explain'
  | 'score_improve'
  | 'score_privacy'
  | 'next_payment'
  | 'late'
  | 'balance'
  | 'next_payout'
  | 'human'
  | 'greeting'
  | 'help'
  | 'unknown';

const fcfa = (value: number, currency = 'FCFA') => `${Math.round(value).toLocaleString('fr-FR')} ${currency}`;
const dateFr = (value: string) => new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Ordre important : le plus précis d'abord.
const RULES: [AssistantIntent, RegExp][] = [
  ['score_privacy', /(qui|est ce qu).*(voit|voir|acces).*(score)|score.*(prive|confidentiel|voit)|mes donnees|donnees personnelles|discrimin|equitable/],
  ['score_change', /(pourquoi|comment).*(score|note).*(baiss|mont|bouge|change|chut|augment|diminu)|(score|note).*(baiss|bouge|change|chut|monte|augment|diminu)/],
  ['score_improve', /(ameliorer|augmenter|remonter|monter|faire monter|gagner).*(score|note|fiabilite)|(score|note|fiabilite).*(ameliorer|remonter)/],
  ['score_explain', /score|fiabilite|ma note|fiable/],
  ['late', /retard|penalite|en retard|impaye/],
  ['next_payout', /(quand|combien).*(recoi|recev|toucher|touche|mon tour|ma part)|mon tour|prochain tour|ma part|le pot/],
  ['next_payment', /(prochaine?|quand|combien).*(cotis|payer|paiement|dois|echeance)|je dois|rappel|echeance/],
  ['balance', /solde|portefeuille|combien j ai|combien ai je|argent disponible/],
  ['human', /humain|conseiller|support|parler a|appeler|contact|reclamation|plainte|erreur/],
  ['help', /aide|que sais tu|que peux tu|tu sais faire|comment ca marche/],
  ['greeting', /^(bonjour|bonsoir|salut|hello|coucou|bjr|slt|ca va)\b/],
];

export function detectIntent(text: string): AssistantIntent {
  const value = normalize(text);
  if (!value) return 'unknown';
  for (const [intent, pattern] of RULES) {
    if (pattern.test(value)) return intent;
  }
  return 'unknown';
}

const CHANGE_REASON: Record<ReliabilityFactor, { up: string; down: string }> = {
  on_time_rate: {
    down: 'une plus grande part de vos cotisations a été payée en retard',
    up: 'une plus grande part de vos cotisations a été payée à l’heure',
  },
  recent_late_rate: {
    down: 'vous avez eu des retards sur vos 3 dernières cotisations',
    up: 'vos 3 dernières cotisations ont moins de retards',
  },
  open_late: {
    down: 'une cotisation échue n’est pas encore payée',
    up: 'vous avez réglé une cotisation en retard',
  },
  experience: {
    down: 'votre historique a changé',
    up: 'votre historique de cotisations est plus long',
  },
  late_after_payout: {
    down: 'vous avez eu des retards après avoir reçu votre part',
    up: 'vous cotisez mieux après avoir reçu votre part',
  },
};

/** Pourquoi le score a bougé, à partir des facteurs réels du calcul. */
export function explainChange(r: ReadyReliability): string {
  if (r.previousScore === null) {
    return `Votre score est de ${r.score}/100. C’est votre premier calcul : la prochaine fois, je pourrai vous dire ce qui a changé.`;
  }
  const since = r.previousDay ? ` depuis le ${dateFr(r.previousDay)}` : '';
  if (r.score === r.previousScore) {
    return `Votre score n’a pas bougé${since} : il reste à ${r.score}/100.`;
  }
  const down = r.score < r.previousScore;
  // impact > 0 augmente le risque, donc fait baisser le score.
  const causes = r.changes
    .filter((c) => (down ? c.impact > 0 : c.impact < 0))
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 2)
    .map((c) => CHANGE_REASON[c.factor][down ? 'down' : 'up']);
  const head = `Votre score est passé de ${r.previousScore} à ${r.score}${since}.`;
  if (causes.length === 0) return head;
  const why = causes.length === 2 ? `${causes[0]}, et ${causes[1]}` : causes[0];
  return `${head} Principale raison : ${why}.`;
}

export function explainScore(r: ReadyReliability): string {
  const lines = [
    `Votre score est de ${r.score}/100 : ${reliabilityLevel(r.score)}.`,
    `• ${r.onTimeCount} cotisations à l’heure sur ${r.dueCount}.`,
    `• ${r.recentLate} en retard parmi les ${r.recentCount} dernières.`,
  ];
  if (r.openLate > 0) lines.push(`• ${r.openLate} échue${r.openLate > 1 ? 's' : ''} pas encore payée${r.openLate > 1 ? 's' : ''}.`);
  if (r.afterPayoutCount > 0) lines.push(`• ${r.lateAfterPayout} en retard sur ${r.afterPayoutCount} après avoir reçu votre part.`);
  lines.push('Le score regarde uniquement vos cotisations. Il estime le risque d’un prochain retard : c’est une estimation, pas un jugement.');
  return lines.join('\n');
}

function improveScore(r: ReadyReliability): string {
  const tips: string[] = [];
  if (r.openLate > 0) tips.push('Réglez d’abord votre cotisation en retard : c’est ce qui compte le plus aujourd’hui.');
  if (r.recentLate > 0) tips.push('Vos 3 dernières cotisations pèsent lourd : payez les prochaines à l’heure.');
  if (r.lateAfterPayout > 0) tips.push('Continuez de cotiser à l’heure après avoir reçu votre part.');
  if (tips.length === 0) tips.push('Vous n’avez aucun retard récent : continuez ainsi.');
  tips.push('Gardez le montant sur votre portefeuille avant la date : le prélèvement se fait tout seul.');
  return tips.join('\n');
}

function nextPayment(ctx: AssistantContext): string {
  const upcoming = [...ctx.contributions].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (upcoming.length === 0) return 'Vous n’avez aucune cotisation à payer pour le moment.';
  const first = upcoming[0];
  const total = first.amount + first.penalty;
  const missing = total - ctx.walletBalance;
  const head = `Prochaine cotisation : ${fcfa(total, first.currency)} pour ${first.groupName}, le ${dateFr(first.dueDate)}.`;
  return missing > 0
    ? `${head} Il vous manque ${fcfa(missing, first.currency)} sur votre portefeuille.`
    : `${head} Votre solde suffit, le prélèvement se fera tout seul.`;
}

export function answer(text: string, ctx: AssistantContext): { intent: AssistantIntent; text: string } {
  const intent = detectIntent(text);
  const r = ctx.reliability;
  const ready = r?.status === 'ready' ? r : null;
  const noScore = r?.status === 'building'
    ? `Votre score n’est pas encore calculé : il faut au moins ${r.needed} cotisations échues, vous en avez ${r.dueCount}. Je ne vous juge pas sur si peu.`
    : 'Je n’arrive pas à lire votre score pour le moment. Réessayez dans un instant.';

  const reply = (body: string) => ({ intent, text: body });

  switch (intent) {
    case 'score_change':
      return reply(ready ? explainChange(ready) : noScore);
    case 'score_explain':
      return reply(ready ? explainScore(ready) : noScore);
    case 'score_improve':
      return reply(ready ? improveScore(ready) : 'Payez vos cotisations à l’heure : votre score apparaîtra après 3 cotisations échues.');
    case 'score_privacy':
      return reply('Votre score n’est visible que par vous et par l’équipe eganyé, jamais par les membres de vos cercles. Il n’utilise ni votre solde, ni les montants, ni votre genre, votre âge ou votre lieu. Il ne refuse rien tout seul : une personne décide toujours. Vous pouvez demander une vérification au support.');
    case 'next_payment':
      return reply(nextPayment(ctx));
    case 'late': {
      const today = new Date().toISOString().slice(0, 10);
      const late = ctx.contributions.filter((c) => c.status === 'late' && c.dueDate.slice(0, 10) < today);
      if (late.length === 0) return reply('Vous n’avez aucune cotisation en retard.');
      const total = late.reduce((sum, c) => sum + c.amount + c.penalty, 0);
      return reply(`${late.length} cotisation${late.length > 1 ? 's' : ''} en retard, pour ${fcfa(total)} au total, pénalités comprises : ${late.map((c) => c.groupName).join(', ')}.`);
    }
    case 'balance':
      return reply(`Votre portefeuille contient ${fcfa(ctx.walletBalance)}.`);
    case 'next_payout': {
      const mine = ctx.circles.find((c) => c.isNextBeneficiary);
      if (mine) return reply(`Vous êtes le prochain bénéficiaire de ${mine.name} : ${fcfa(mine.potAmount, mine.currency)} prévus le ${dateFr(mine.nextPayoutDate)}, une fois que tout le monde aura cotisé.`);
      if (ctx.circles.length === 0) return reply('Vous n’êtes dans aucun cercle actif pour le moment.');
      return reply('Ce n’est pas encore votre tour dans vos cercles actifs. L’ordre est affiché dans la page de chaque cercle.');
    }
    case 'human':
      return reply('Pour parler à une personne, ouvrez Aide et support. C’est aussi là que vous pouvez contester votre score ou demander sa vérification.');
    case 'greeting':
      return reply(`Bonjour ${ctx.firstName} ! Je peux vous expliquer votre score, vous dire votre prochaine cotisation ou votre solde.`);
    case 'help':
      return reply('Je peux vous expliquer votre score et ses variations, vous dire comment le faire monter, votre prochaine cotisation, vos retards, votre solde et votre prochain tour.');
    default:
      return reply('Je n’ai pas compris. Je sais répondre sur votre score, vos cotisations, vos retards, votre solde et votre tour. Essayez une des questions proposées.');
  }
}
