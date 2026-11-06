// Répliques des deux vidéos, en français et en anglais. Source unique : la voix off
// (build-voice.mjs) et les sous-titres du tutoriel partent de ce fichier.
//
// Interdits : Coup de pouce (masqué), « banque », « intérêt » entre membres, promesse de
// rendement, durée inventée, partenaire nommé, chiffre d'utilisateurs. L'IA « estime »,
// « prévient », « explique » : elle ne décide pas, ne garantit pas.

export const BPM = 124;
export const BAR = (60 / BPM) * 4;

export const VOICES = {
  fr: { voice: 'fr-FR-VivienneMultilingualNeural', presentation: '+12%', tutorial: '+3%' },
  en: { voice: 'en-US-AvaMultilingualNeural', presentation: '+10%', tutorial: '+2%' },
};

// La voix anglaise lit « eganyé » de travers : on lui écrit le son attendu.
export const speak = (text, lang) => (lang === 'en' ? text.replace(/eganyé/g, 'Egan-yay') : text);

// Présentation : [mesure de départ, français, anglais]. Une réplique doit finir avant la suivante.
export const PRESENTATION_BARS = 25;
export const PRESENTATION = [
  [0.25, 'eganyé. La tontine, sur votre téléphone.', 'eganyé. Your tontine, on your phone.'],
  [2, 'Le cahier qui se perd. Qui a payé ? Qui manque ?', 'Lost notebooks. Who paid? Who’s missing?'],
  [4, 'Vos cercles, votre argent. Tout est là.', 'Your circles, your money. All in one place.'],
  [6, 'Créez votre cercle. Invitez vos proches, par lien ou par code.', 'Start your circle. Invite your people, by link or by code.'],
  [9, 'Cotisez par Flooz ou Mixx. Chaque franc se voit, et le pot se remplit.', 'Pay in with Flooz or Mixx. Every franc is visible, and the pot fills up.'],
  [12, 'Au cœur d’eganyé, une IA. Elle estime votre fiabilité, et vous explique votre score.', 'At eganyé’s heart: AI. It estimates your reliability, and explains your score.'],
  [15, 'Elle vous prévient avant un retard.', 'It warns you before you’re late.'],
  [16.5, 'Elle estime le risque du tour, sans nommer personne.', 'It estimates each round’s risk, without naming anyone.'],
  [18.5, 'Et elle ne décide jamais à votre place.', 'And it never decides for you.'],
  [19.75, 'À votre tour, le pot arrive sur votre portefeuille.', 'When it’s your turn, the pot lands in your wallet.'],
  [21.5, 'Mettez de côté dans vos coffres. Retirez avec votre code PIN.', 'Put money aside in your vaults. Withdraw with your PIN.'],
  [23.35, 'eganyé. Épargnons ensemble.', 'eganyé. Let’s save together.'],
];

// Tutoriel : une étape, un écran, une phrase. tap = repère [x, y] en fraction de l'écran.
export const TUTORIAL = [
  { ch: 0, screen: 'welcome', tap: [0.5, 0.884], fr: 'Ouvrez eganyé, et touchez Créer un compte.', en: 'Open eganyé and tap Create an account.' },
  { ch: 0, screen: 'register', tap: [0.5, 0.565], fr: 'Entrez votre nom, votre e-mail et un mot de passe.', en: 'Enter your name, your email and a password.' },
  { ch: 0, screen: 'code', tap: [0.5, 0.298], fr: 'Vous recevez un code par e-mail. Entrez-le ici.', en: 'You get a code by email. Type it in here.' },
  { ch: 0, screen: 'intent', tap: [0.5, 0.19], fr: 'Dites ce que vous voulez faire. Ici : créer une tontine.', en: 'Choose what you want to do. Here, start a tontine.' },
  { ch: 1, screen: 'home', fr: 'Voici votre accueil : votre solde, vos cercles, vos derniers mouvements.', en: 'This is your home screen: your balance, your circles, your latest activity.' },
  { ch: 1, screen: 'home', tap: [0.5, 0.325], fr: 'L’assistant vous dit ce qui compte aujourd’hui. Par exemple, pourquoi votre score a bougé.', en: 'The assistant tells you what matters today. For example, why your score moved.' },
  { ch: 1, screen: 'assistant-answer', fr: 'Posez-lui vos questions : il répond à partir de vos cotisations.', en: 'Ask it your questions: it answers from your own contributions.' },
  { ch: 2, screen: 'circles-add', tap: [0.5, 0.8], fr: 'Dans Cercles, touchez le plus, puis Créer un cercle.', en: 'In Circles, tap the plus, then Create a circle.' },
  { ch: 2, screen: 'create-1', tap: [0.5, 0.953], fr: 'Donnez un nom au cercle, le montant de la cotisation et le nombre de participants.', en: 'Name your circle, then set the contribution and the number of members.' },
  { ch: 2, screen: 'create-2', tap: [0.5, 0.953], fr: 'Choisissez le rythme, la date de départ, et comment désigner qui reçoit le pot.', en: 'Pick how often you pay, the start date, and how to choose who gets the pot.' },
  { ch: 2, screen: 'create-3', tap: [0.5, 0.953], fr: 'Relisez le récapitulatif, acceptez, et signez.', en: 'Check the summary, accept, and sign.' },
  { ch: 2, screen: 'invite', fr: 'Votre cercle est prêt. Partagez le code, ou invitez vos proches sur WhatsApp.', en: 'Your circle is ready. Share the code, or invite your people on WhatsApp.' },
  { ch: 3, screen: 'circle', tap: [0.5, 0.33], fr: 'Quand vient le moment de cotiser, ouvrez votre cercle et touchez Cotiser.', en: 'When it’s time to pay in, open your circle and tap Contribute.' },
  { ch: 3, screen: 'circle', tap: [0.5, 0.115], fr: 'L’IA estime aussi le risque de retard du tour, sans nommer personne.', en: 'The AI also estimates the risk of delay for the round, without naming anyone.' },
  { ch: 3, screen: 'pay', fr: 'La cotisation part toute seule de votre portefeuille dès que le solde suffit. Déjà payé autrement ? Déclarez-le ici.', en: 'Your contribution goes out from your wallet as soon as your balance covers it. Already paid another way? Declare it here.' },
  { ch: 3, screen: 'pot-partial', tap: [0.5, 0.19], fr: 'Le pot se remplit à chaque cotisation, et chacun peut le voir.', en: 'The pot fills up with every contribution, and everyone can see it.' },
  { ch: 4, screen: 'pot-full', tap: [0.5, 0.27], fr: 'Quand tout le monde a cotisé, l’organisateur distribue le pot.', en: 'Once everyone has paid in, the organizer distributes the pot.' },
  { ch: 4, screen: 'received', tap: [0.5, 0.795], fr: 'À votre tour, l’argent arrive sur votre portefeuille.', en: 'When it’s your turn, the money lands in your wallet.' },
  { ch: 5, screen: 'topup-1', tap: [0.5, 0.955], fr: 'Pour recharger votre portefeuille, choisissez le montant.', en: 'To recharge your wallet, choose the amount.' },
  { ch: 5, screen: 'topup-2', tap: [0.5, 0.955], fr: 'Vérifiez les frais, payez, puis confirmez sur votre téléphone.', en: 'Check the fees, pay, then confirm on your phone.' },
  { ch: 5, screen: 'withdraw-1', tap: [0.5, 0.955], fr: 'Pour retirer, choisissez le montant.', en: 'To withdraw, choose the amount.' },
  { ch: 5, screen: 'withdraw-2', tap: [0.5, 0.33], fr: 'Vérifiez bien le numéro : un envoi réussi ne peut pas être annulé.', en: 'Double-check the number: a completed transfer can’t be reversed.' },
  { ch: 5, screen: 'withdraw-3', tap: [0.5, 0.955], fr: 'Relisez le récapitulatif.', en: 'Check the summary.' },
  { ch: 5, screen: 'withdraw-4', fr: 'Entrez votre code PIN, et c’est parti.', en: 'Enter your PIN, and you’re done.' },
  { ch: 6, end: true, fr: 'Vous savez tout. Bienvenue sur eganyé.', en: 'That’s all you need. Welcome to eganyé.' },
];

export const CHAPTERS = {
  fr: ['Votre compte', 'L’accueil et l’assistant', 'Créer un cercle', 'Cotiser', 'Recevoir sa part', 'Recharger et retirer', ''],
  en: ['Your account', 'Home and the assistant', 'Create a circle', 'Contribute', 'Get your share', 'Top up and withdraw', ''],
};
