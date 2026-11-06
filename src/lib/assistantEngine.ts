import type { CircleHealth, ReadyReliability, Reliability, ReliabilityFactor } from './reliability';
import { reliabilityLevel, tr } from './reliability';

/**
 * Assistant eganyé : des règles, sans modèle de langue ni service externe.
 *
 * Il ne répond qu'à partir des données réelles de la personne et n'invente aucun
 * chiffre : s'il ne comprend pas, il le dit et propose ce qu'il sait faire. Il tourne
 * dans le téléphone, donc rien de ce qui est tapé ne sort de l'appareil.
 *
 * Textes en français et en anglais : aucune traduction éwé n'est publiée tant qu'une
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
  /** Estimation agrégée du modèle, si elle a été chargée. */
  health?: CircleHealth;
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
  | 'ai_about'
  | 'circle_health'
  | 'next_payment'
  | 'late'
  | 'balance'
  | 'next_payout'
  | 'human'
  | 'greeting'
  | 'help'
  | 'unknown';

const locale = () => tr('fr-FR', 'en-GB');
const fcfa = (value: number, currency = 'FCFA') => `${Math.round(value).toLocaleString(locale())} ${currency}`;
const dateFr = (value: string) => new Date(value).toLocaleDateString(locale(), { day: 'numeric', month: 'long' });

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
  ['ai_about', /\b(l ia|ia|intelligence artificielle|le modele)\b/],
  ['circle_health', /sante.*cercle|cercle.*(sante|risque|va bien)|risque.*(cercle|tour)|mon cercle va/],
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

// Les mêmes intentions, pour une question posée en anglais.
const RULES_EN: [AssistantIntent, RegExp][] = [
  ['ai_about', /\b(ai|a i|artificial intelligence|the model)\b/],
  ['circle_health', /circle.*(health|risk|doing)|health.*circle|risk.*(circle|round)/],
  ['score_privacy', /who.*(see|sees|access).*score|score.*(private|see)|my data|personal data|fair/],
  ['score_change', /(why|how).*score.*(drop|fall|fell|moved|move|change|went|rise|rose)|score.*(drop|fell|moved|changed|went)/],
  ['score_improve', /(raise|improve|increase|boost|better).*score|score.*(raise|improve|increase|better)/],
  ['score_explain', /score|reliab/],
  ['late', /late|penalt|overdue/],
  ['next_payout', /(when|how much).*(receive|get|my turn|my share)|my turn|next round|my share|the pot/],
  ['next_payment', /(next|when|how much).*(contribut|pay|due)|i owe|reminder|due date/],
  ['balance', /balance|wallet|how much do i have|available money/],
  ['human', /human|advisor|support|talk to|call|contact|complaint|mistake/],
  ['help', /help|what can you|how does it work/],
  ['greeting', /^(hi|hey|hello|good morning|good evening)\b/],
];

export function detectIntent(text: string): AssistantIntent {
  const value = normalize(text);
  if (!value) return 'unknown';
  for (const [intent, pattern] of RULES) {
    if (pattern.test(value)) return intent;
  }
  for (const [intent, pattern] of RULES_EN) {
    if (pattern.test(value)) return intent;
  }
  return 'unknown';
}

const CHANGE_REASON: Record<ReliabilityFactor, { up: [string, string]; down: [string, string] }> = {
  on_time_rate: {
    down: ['une plus grande part de vos cotisations a été payée en retard', 'more of your contributions were paid late'],
    up: ['une plus grande part de vos cotisations a été payée à l’heure', 'more of your contributions were paid on time'],
  },
  recent_late_rate: {
    down: ['vous avez eu des retards sur vos 3 dernières cotisations', 'you were late on your last 3 contributions'],
    up: ['vos 3 dernières cotisations ont moins de retards', 'your last 3 contributions were later less often'],
  },
  open_late: {
    down: ['une cotisation échue n’est pas encore payée', 'a contribution past its due date is still unpaid'],
    up: ['vous avez réglé une cotisation en retard', 'you settled a late contribution'],
  },
  experience: {
    down: ['votre historique a changé', 'your history changed'],
    up: ['votre historique de cotisations est plus long', 'your contribution history is longer'],
  },
  late_after_payout: {
    down: ['vous avez eu des retards après avoir reçu votre part', 'you were late after receiving your share'],
    up: ['vous cotisez mieux après avoir reçu votre part', 'you pay in more reliably after receiving your share'],
  },
};
const reason = (factor: ReliabilityFactor, dir: 'up' | 'down') => tr(CHANGE_REASON[factor][dir][0], CHANGE_REASON[factor][dir][1]);

/** Pourquoi le score a bougé, à partir des facteurs réels du calcul. */
export function explainChange(r: ReadyReliability): string {
  if (r.previousScore === null) {
    return tr(`Votre score est de ${r.score}/100. C’est votre premier calcul : la prochaine fois, je pourrai vous dire ce qui a changé.`, `Your score is ${r.score}/100. This is your first estimate: next time, I can tell you what changed.`);
  }
  const since = r.previousDay ? tr(` depuis le ${dateFr(r.previousDay)}`, ` since ${dateFr(r.previousDay)}`) : '';
  if (r.score === r.previousScore) {
    return tr(`Votre score n’a pas bougé${since} : il reste à ${r.score}/100.`, `Your score hasn’t moved${since}: it stays at ${r.score}/100.`);
  }
  const down = r.score < r.previousScore;
  // impact > 0 augmente le risque, donc fait baisser le score.
  const causes = r.changes
    .filter((c) => (down ? c.impact > 0 : c.impact < 0))
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 2)
    .map((c) => reason(c.factor, down ? 'down' : 'up'));
  const head = tr(`Votre score est passé de ${r.previousScore} à ${r.score}${since}.`, `Your score went from ${r.previousScore} to ${r.score}${since}.`);
  if (causes.length === 0) return head;
  const why = causes.length === 2 ? tr(`${causes[0]}, et ${causes[1]}`, `${causes[0]}, and ${causes[1]}`) : causes[0];
  return tr(`${head} Principale raison : ${why}.`, `${head} Main reason: ${why}.`);
}

export function explainScore(r: ReadyReliability): string {
  const lines = [
    tr(`Votre score est de ${r.score}/100 : ${reliabilityLevel(r.score)}.`, `Your score is ${r.score}/100: ${reliabilityLevel(r.score)}.`),
    tr(`• ${r.onTimeCount} cotisations à l’heure sur ${r.dueCount}.`, `• ${r.onTimeCount} of ${r.dueCount} contributions on time.`),
    tr(`• ${r.recentLate} en retard parmi les ${r.recentCount} dernières.`, `• ${r.recentLate} late among the last ${r.recentCount}.`),
  ];
  if (r.openLate > 0) lines.push(tr(`• ${r.openLate} échue${r.openLate > 1 ? 's' : ''} pas encore payée${r.openLate > 1 ? 's' : ''}.`, `• ${r.openLate} past due and still unpaid.`));
  if (r.afterPayoutCount > 0) lines.push(tr(`• ${r.lateAfterPayout} en retard sur ${r.afterPayoutCount} après avoir reçu votre part.`, `• ${r.lateAfterPayout} of ${r.afterPayoutCount} late after receiving your share.`));
  lines.push(tr('Le score regarde uniquement vos cotisations. Il estime le risque d’un prochain retard : c’est une estimation, pas un jugement.', 'The score only looks at your contributions. It estimates the risk of your next payment being late: an estimate, not a judgement.'));
  return lines.join('\n');
}

function improveScore(r: ReadyReliability): string {
  const tips: string[] = [];
  if (r.openLate > 0) tips.push(tr('Réglez d’abord votre cotisation en retard : c’est ce qui compte le plus aujourd’hui.', 'Settle your late contribution first: that matters most today.'));
  if (r.recentLate > 0) tips.push(tr('Vos 3 dernières cotisations pèsent lourd : payez les prochaines à l’heure.', 'Your last 3 contributions count the most: pay the next ones on time.'));
  if (r.lateAfterPayout > 0) tips.push(tr('Continuez de cotiser à l’heure après avoir reçu votre part.', 'Keep paying on time after receiving your share.'));
  if (tips.length === 0) tips.push(tr('Vous n’avez aucun retard récent : continuez ainsi.', 'You have no recent late payments: keep it up.'));
  tips.push(tr('Gardez le montant sur votre portefeuille avant la date : le prélèvement se fait tout seul.', 'Keep the amount in your wallet before the due date: the payment goes out on its own.'));
  return tips.join('\n');
}

function nextPayment(ctx: AssistantContext): string {
  const upcoming = [...ctx.contributions].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (upcoming.length === 0) return tr('Vous n’avez aucune cotisation à payer pour le moment.', 'You have no contribution to pay for now.');
  const first = upcoming[0];
  const total = first.amount + first.penalty;
  const missing = total - ctx.walletBalance;
  const head = tr(`Prochaine cotisation : ${fcfa(total, first.currency)} pour ${first.groupName}, le ${dateFr(first.dueDate)}.`, `Next contribution: ${fcfa(total, first.currency)} for ${first.groupName}, on ${dateFr(first.dueDate)}.`);
  return missing > 0
    ? tr(`${head} Il vous manque ${fcfa(missing, first.currency)} sur votre portefeuille.`, `${head} You’re ${fcfa(missing, first.currency)} short in your wallet.`)
    : tr(`${head} Votre solde suffit, le prélèvement se fera tout seul.`, `${head} Your balance covers it, the payment will go out on its own.`);
}

const healthLabel = (level: 'low' | 'medium' | 'high') => ({
  low: tr('risque de retard faible', 'low risk of delay'),
  medium: tr('risque de retard moyen', 'medium risk of delay'),
  high: tr('risque de retard élevé', 'high risk of delay'),
})[level];

function circleHealth(ctx: AssistantContext): string {
  if (ctx.circles.length === 0) return tr('Vous n’êtes dans aucun cercle actif pour le moment.', 'You’re not in any active circle for now.');
  const lines = ctx.circles.map((circle) => {
    const health = circle.health;
    if (health?.status === 'ok') return `• ${circle.name}${tr(' :', ':')} ${healthLabel(health.level)}.`;
    if (health?.status === 'not_enough') return tr(`• ${circle.name} : pas encore assez de membres avec un score.`, `• ${circle.name}: not enough members with a score yet.`);
    return tr(`• ${circle.name} : estimation indisponible.`, `• ${circle.name}: estimate unavailable.`);
  });
  return `${lines.join('\n')}\n${tr('C’est une estimation pour tout le cercle, sans nom ni score individuel. Elle ne dit pas qui sera en retard.', 'This is an estimate for the whole circle, with no names or individual scores. It doesn’t say who will be late.')}`;
}

const aiAbout = () => tr('L’IA d’eganyé est un modèle de fiabilité. À partir de vos seules cotisations, il estime le risque d’un prochain retard, pour vous prévenir à temps. Il peut vous envoyer un rappel de plus si votre score passe sous 60, donner une estimation pour tout un cercle, et aider notre équipe à savoir qui contacter d’abord.\nIl ne décide rien : il ne refuse aucune demande et n’applique aucune pénalité. Il a appris sur des données simulées, pas encore sur de vrais membres, et il peut se tromper. Moi, je suis l’assistant : je réponds avec des règles écrites, à partir de vos données.', 'eganyé’s AI is a reliability model. From your contributions alone, it estimates the risk of your next payment being late, so it can warn you in time. It can send you an extra reminder if your score drops below 60, give an estimate for a whole circle, and help our team know who to contact first.\nIt decides nothing: it refuses no request and applies no penalty. It learned on simulated data, not yet on real members, and it can be wrong. I’m the assistant: I answer with written rules, from your own data.');

/**
 * La phrase la plus utile du moment, ou null s'il n'y a rien d'utile à dire.
 * Dans l'ordre : ce qui coûte déjà, ce qui va coûter, ce qui a changé, puis ce qui va bien.
 */
/** Pour l'accueil : ce qui a bougé et la première raison. */
function shortChange(r: ReadyReliability): string {
  const down = r.score < (r.previousScore as number);
  const top = r.changes
    .filter((c) => (down ? c.impact > 0 : c.impact < 0))
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))[0];
  const head = tr(`Votre score est passé de ${r.previousScore} à ${r.score}.`, `Your score went from ${r.previousScore} to ${r.score}.`);
  if (!top) return head;
  const why = reason(top.factor, down ? 'down' : 'up');
  return `${head} ${why.charAt(0).toUpperCase()}${why.slice(1)}.`;
}

export function momentInsight(ctx: AssistantContext, now: Date = new Date()): string | null {
  const today = now.toISOString().slice(0, 10);
  const byDate = [...ctx.contributions].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const late = byDate.filter((c) => c.dueDate.slice(0, 10) < today);
  if (late.length > 0) {
    const total = late.reduce((sum, c) => sum + c.amount + c.penalty, 0);
    const where = late.length === 1 ? tr(` pour ${late[0].groupName}`, ` for ${late[0].groupName}`) : '';
    return tr(`Vous avez ${fcfa(total, late[0].currency)} de retard${where}. Réglez-les d’abord : c’est ce qui pèse le plus sur votre score.`, `You’re ${fcfa(total, late[0].currency)} behind${where}. Settle this first: it weighs most on your score.`);
  }

  const inAWeek = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const soon = byDate.find((c) => c.dueDate.slice(0, 10) <= inAWeek);
  if (soon) {
    const missing = soon.amount + soon.penalty - ctx.walletBalance;
    if (missing > 0) {
      return tr(`Il manque ${fcfa(missing, soon.currency)} pour votre cotisation ${soon.groupName} du ${dateFr(soon.dueDate)}. Rechargez à temps et elle partira toute seule.`, `You’re ${fcfa(missing, soon.currency)} short for your ${soon.groupName} contribution on ${dateFr(soon.dueDate)}. Top up in time and it will go out on its own.`);
    }
  }

  const r = ctx.reliability;
  if (r?.status === 'ready') {
    if (r.previousScore !== null && r.previousScore !== r.score) return shortChange(r);
    if (r.openLate === 0 && r.recentLate === 0) {
      return tr(`Aucun retard récent : votre score de fiabilité est de ${r.score}/100.`, `No recent late payments: your reliability score is ${r.score}/100.`);
    }
  }
  return null;
}

export function answer(text: string, ctx: AssistantContext): { intent: AssistantIntent; text: string } {
  const intent = detectIntent(text);
  const r = ctx.reliability;
  const ready = r?.status === 'ready' ? r : null;
  const noScore = r?.status === 'building'
    ? tr(`Votre score n’est pas encore calculé : il faut au moins ${r.needed} cotisations échues, vous en avez ${r.dueCount}. Je ne vous juge pas sur si peu.`, `Your score isn’t calculated yet: it takes at least ${r.needed} contributions past their due date, and you have ${r.dueCount}. I won’t judge you on so little.`)
    : tr('Je n’arrive pas à lire votre score pour le moment. Réessayez dans un instant.', 'I can’t read your score right now. Try again in a moment.');

  const reply = (body: string) => ({ intent, text: body });

  switch (intent) {
    case 'score_change':
      return reply(ready ? explainChange(ready) : noScore);
    case 'score_explain':
      return reply(ready ? explainScore(ready) : noScore);
    case 'score_improve':
      return reply(ready ? improveScore(ready) : tr('Payez vos cotisations à l’heure : votre score apparaîtra après 3 cotisations échues.', 'Pay your contributions on time: your score will appear after 3 contributions past their due date.'));
    case 'score_privacy':
      return reply(tr('Votre score n’est visible que par vous et par l’équipe eganyé, jamais par les membres de vos cercles. Il n’utilise ni votre solde, ni les montants, ni votre genre, votre âge ou votre lieu. Il ne refuse rien tout seul : une personne décide toujours. Vous pouvez demander une vérification au support.', 'Only you and the eganyé team can see your score, never the members of your circles. It doesn’t use your balance, the amounts, your gender, your age or your location. It refuses nothing on its own: a person always decides. You can ask support to review it.'));
    case 'ai_about':
      return reply(aiAbout());
    case 'circle_health':
      return reply(circleHealth(ctx));
    case 'next_payment':
      return reply(nextPayment(ctx));
    case 'late': {
      const today = new Date().toISOString().slice(0, 10);
      const late = ctx.contributions.filter((c) => c.status === 'late' && c.dueDate.slice(0, 10) < today);
      if (late.length === 0) return reply(tr('Vous n’avez aucune cotisation en retard.', 'You have no late contributions.'));
      const total = late.reduce((sum, c) => sum + c.amount + c.penalty, 0);
      return reply(tr(`${late.length} cotisation${late.length > 1 ? 's' : ''} en retard, pour ${fcfa(total)} au total, pénalités comprises : ${late.map((c) => c.groupName).join(', ')}.`, `${late.length} late contribution${late.length > 1 ? 's' : ''}, ${fcfa(total)} in total including penalties: ${late.map((c) => c.groupName).join(', ')}.`));
    }
    case 'balance':
      return reply(tr(`Votre portefeuille contient ${fcfa(ctx.walletBalance)}.`, `Your wallet holds ${fcfa(ctx.walletBalance)}.`));
    case 'next_payout': {
      const mine = ctx.circles.find((c) => c.isNextBeneficiary);
      if (mine) return reply(tr(`Vous êtes le prochain bénéficiaire de ${mine.name} : ${fcfa(mine.potAmount, mine.currency)} prévus le ${dateFr(mine.nextPayoutDate)}, une fois que tout le monde aura cotisé.`, `You’re next to receive in ${mine.name}: ${fcfa(mine.potAmount, mine.currency)} planned for ${dateFr(mine.nextPayoutDate)}, once everyone has paid in.`));
      if (ctx.circles.length === 0) return reply(tr('Vous n’êtes dans aucun cercle actif pour le moment.', 'You’re not in any active circle for now.'));
      return reply(tr('Ce n’est pas encore votre tour dans vos cercles actifs. L’ordre est affiché dans la page de chaque cercle.', 'It’s not your turn yet in your active circles. Each circle’s page shows the order.'));
    }
    case 'human':
      return reply(tr('Pour parler à une personne, ouvrez Aide et support. C’est aussi là que vous pouvez contester votre score ou demander sa vérification.', 'To talk to a person, open Help and support. That’s also where you can dispute your score or ask for a review.'));
    case 'greeting':
      return reply(tr(`Bonjour ${ctx.firstName} ! Je peux vous expliquer votre score, vous dire votre prochaine cotisation ou votre solde.`, `Hello ${ctx.firstName}! I can explain your score, or tell you your next contribution or your balance.`));
    case 'help':
      return reply(tr('Je peux vous expliquer votre score et ses variations, vous dire comment le faire monter, votre prochaine cotisation, vos retards, votre solde, votre prochain tour et l’estimation de vos cercles.', 'I can explain your score and how it moves, how to raise it, your next contribution, your late payments, your balance, your next turn and the estimate for your circles.'));
    default:
      return reply(tr('Je n’ai pas compris. Je sais répondre sur votre score, vos cotisations, vos retards, votre solde et votre tour. Essayez une des questions proposées.', 'I didn’t understand. I can answer about your score, contributions, late payments, balance and turn. Try one of the suggested questions.'));
  }
}
