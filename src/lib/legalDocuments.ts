/**
 * Documents légaux d'eganyé — source unique.
 *
 * Avant ce fichier, chaque écran (inscription, Profil) avait sa propre copie
 * de quelques paragraphes, avec des affirmations fausses (« chiffrés de bout
 * en bout ») et un Profil qui listait trois documents sans jamais les ouvrir.
 * Tout texte légal passe désormais par ici et s'affiche via
 * LegalDocumentDialog : on corrige une fois, c'est corrigé partout.
 *
 * Règle de rédaction : ne décrire que ce que l'application fait réellement
 * (voir les migrations Supabase et api/). Un texte légal qui promet plus que
 * le code engage la responsabilité de l'éditeur et peut faire rejeter l'app
 * par les stores.
 */

export type LegalDocId = 'cgu' | 'reglement' | 'credit' | 'aide' | 'confidentialite' | 'mentions';

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDocument {
  id: LegalDocId;
  title: string;
  /** À qui s'adresse le document, affiché sous le titre. */
  audience: string;
  sections: LegalSection[];
}

/** Date de la dernière révision de l'ensemble des textes. */
export const LEGAL_LAST_UPDATED = '21 octobre 2026';

/**
 * Identité de l'éditeur, reprise dans les mentions légales et la politique de
 * confidentialité. Un champ laissé vide n'est simplement pas affiché.
 * Source : carte unique de création d'entreprise (CFE Togo, 15-04-2026).
 */
export const LEGAL_ENTITY = {
  name: 'CODORAH',
  legalForm: 'entreprise individuelle',
  registration: 'RCCM TG-LFW-01-2026-A10-02627',
  address: 'Kégué, Lomé',
  country: 'Togo',
  publicationDirector: 'ATANA Essodom Elodie H.',
  contactEmail: 'codorah@hotmail.com',
};

const entityLines = (): string[] => {
  const e = LEGAL_ENTITY;
  return [
    `Éditeur de l'application eganyé : ${e.name}${e.legalForm ? `, ${e.legalForm}` : ''}.`,
    e.registration && `Immatriculation : ${e.registration}.`,
    e.address && `Siège : ${e.address}${e.country ? `, ${e.country}` : ''}.`,
    e.publicationDirector && `Directeur·rice de la publication : ${e.publicationDirector}.`,
    e.contactEmail
      ? `Contact : ${e.contactEmail}, ou depuis l'application (Profil → Centre d'aide).`
      : `Contact : depuis l'application (Profil → Centre d'aide).`,
  ].filter(Boolean) as string[];
};

const contactLine = () =>
  LEGAL_ENTITY.contactEmail
    ? `écrivez à ${LEGAL_ENTITY.contactEmail} ou passez par Profil → Centre d'aide`
    : `passez par Profil → Centre d'aide`;

export const LEGAL_DOCUMENTS: Record<LegalDocId, LegalDocument> = {
  cgu: {
    id: 'cgu',
    title: "Conditions générales d'utilisation",
    audience: "Pour toute personne qui crée un compte eganyé",
    sections: [
      {
        heading: '1. Le service',
        paragraphs: [
          "eganyé est une application d'épargne en groupe : elle permet d'organiser des tontines (« cercles »), de tenir un portefeuille en FCFA, de mettre de l'argent de côté dans des banques personnelles bloquées dans le temps, et de demander certains services de partenaires, dont le microcrédit.",
          "eganyé est un outil d'organisation et de tenue de comptes. eganyé n'est pas une banque et ne verse aucun intérêt sur les sommes déposées.",
        ],
      },
      {
        heading: '2. Votre compte',
        paragraphs: [
          "Vous devez être majeur·e et fournir des informations exactes. Votre compte est personnel : ne partagez ni votre mot de passe ni votre code PIN de retrait.",
          "Pour créer ou rejoindre un cercle, une vérification d'identité (pièce d'identité) est demandée. Tant qu'elle n'est pas validée, ces fonctions restent fermées.",
          "Après 5 codes PIN erronés, les retraits sont bloqués 15 minutes pour protéger votre argent.",
        ],
      },
      {
        heading: '3. Votre portefeuille',
        paragraphs: [
          "Les dépôts se font par Mobile Money (Mixx, Moov Flooz, Orange Money, MTN MoMo selon les pays) et sont encaissés par notre prestataire de paiement PayDunya. Votre solde n'est crédité qu'une fois le paiement confirmé par PayDunya. Les frais éventuels sont affichés avant que vous ne confirmiez.",
          "Quand vous demandez un retrait, le montant est réservé sur votre solde, puis notre équipe vous l'envoie sur le numéro Mobile Money que vous avez indiqué. Le retrait est marqué effectué une fois l'envoi fait. Si l'envoi échoue, le montant est rendu à votre portefeuille.",
          "Chaque mouvement est inscrit dans un registre comptable à double entrée et apparaît dans votre historique.",
        ],
      },
      {
        heading: '4. Commission',
        paragraphs: [
          "Lors de chaque tour de tontine, eganyé peut prélever une commission sur le pot versé à la bénéficiaire. Son mode de calcul (une part de cotisation ou un pourcentage du pot) est indiqué dans le cercle et dans le détail du versement.",
        ],
      },
      {
        heading: '5. Comportements interdits',
        paragraphs: [
          "Usurper l'identité d'une autre personne, créer un cercle pour tromper ses membres, utiliser eganyé pour blanchir de l'argent ou contourner une sanction, tenter d'accéder au compte d'autrui. Ces comportements entraînent la suspension du compte et peuvent être signalés aux autorités.",
        ],
      },
      {
        heading: '6. Responsabilités',
        paragraphs: [
          "eganyé applique ses règles de calcul et de versement telles qu'elles sont décrites dans le Règlement des cercles. eganyé ne garantit pas qu'un membre honorera ses cotisations ni qu'un emprunteur remboursera : la tontine repose sur la confiance entre ses membres.",
          "Nous faisons de notre mieux pour que le service soit disponible, mais des interruptions (maintenance, panne réseau, panne d'un opérateur Mobile Money) peuvent survenir.",
        ],
      },
      {
        heading: '7. Réclamations',
        paragraphs: [
          "Pour un retrait non reçu, un dépôt absent de votre solde, une cotisation contestée ou tout autre problème, " + contactLine() + ". Indiquez la date, le montant et, si vous l'avez, la référence de l'opération : chaque mouvement est tracé, ce qui nous permet de vérifier.",
          "Si vous pensez que quelqu'un utilise votre compte, changez votre mot de passe et votre code PIN, puis prévenez-nous tout de suite : nous pouvons suspendre le compte le temps de vérifier.",
          "Nous répondons dans les meilleurs délais, et au plus tard sous 30 jours. Pour un désaccord entre membres d'un cercle, voir le Règlement des cercles.",
        ],
      },
      {
        heading: '8. Fermeture du compte',
        paragraphs: [
          "Vous pouvez fermer votre compte depuis Profil, une fois votre solde retiré et vos cercles en cours quittés : fermer le compte plus tôt reviendrait à abandonner votre argent ou à léser les membres de vos cercles. Nous pouvons suspendre un compte qui enfreint ces conditions.",
        ],
      },
      {
        heading: '9. Modifications',
        paragraphs: [
          "Ces conditions peuvent évoluer. La date de dernière mise à jour est indiquée en haut du document ; en cas de changement important, vous serez prévenu·e dans l'application.",
        ],
      },
    ],
  },

  reglement: {
    id: 'reglement',
    title: 'Règlement des cercles',
    audience: 'Pour les cotisant·e·s et les organisatrices de cercles',
    sections: [
      {
        heading: '1. Le principe',
        paragraphs: [
          "Un cercle réunit des membres qui versent chacun le même montant à chaque échéance (quotidienne, hebdomadaire, toutes les deux semaines ou mensuelle). À chaque tour, le pot ainsi réuni est versé à un seul membre, jusqu'à ce que chacun l'ait reçu.",
        ],
      },
      {
        heading: "2. Le rôle de l'organisatrice",
        paragraphs: [
          "La personne qui crée le cercle en fixe les règles : montant, fréquence, nombre de places, mode de tirage, pénalités de retard. Elle accepte ou refuse les demandes d'adhésion, attribue l'ordre de passage et déclenche les versements.",
          "Un cercle privé n'est accessible qu'avec son code d'invitation, et toute adhésion reste soumise à l'accord de l'organisatrice.",
        ],
      },
      {
        heading: '3. Vos engagements de cotisant·e',
        paragraphs: [
          "En rejoignant un cercle, vous vous engagez sur l'honneur à verser chaque cotisation jusqu'à la fin du cycle, y compris après avoir reçu votre pot. Les autres membres ont avancé votre part : abandonner après avoir été servi·e, c'est leur prendre leur argent.",
          "À chaque échéance, la cotisation (et l'éventuelle pénalité) est prélevée automatiquement sur votre portefeuille si le solde suffit. Sinon, elle reste due : gardez un solde suffisant.",
        ],
      },
      {
        heading: '4. Retards et pénalités',
        paragraphs: [
          "Si le cercle prévoit des pénalités, une cotisation non réglée après le délai de grâce donne lieu à une pénalité, fixe ou en pourcentage, selon les règles affichées dans le cercle. La pénalité s'ajoute au montant dû et est réglée avec la cotisation.",
          "Les retards sont visibles par l'organisatrice et par les membres du cercle.",
        ],
      },
      {
        heading: "5. L'ordre de passage",
        paragraphs: [
          "Rotation : les membres reçoivent le pot dans l'ordre établi par l'organisatrice.",
          "Tirage au sort : la bénéficiaire du tour est tirée au sort parmi les membres qui n'ont pas encore été servis.",
          "Enchères : un membre peut proposer de céder une partie du pot (le rabais) pour être servi plus tôt. Ce rabais est partagé à parts égales entre les autres membres actifs ; le reste éventuel de la division revient à la bénéficiaire, de sorte qu'aucun franc ne se perd.",
        ],
      },
      {
        heading: '6. Le versement du pot',
        paragraphs: [
          "Le pot est égal à la cotisation multipliée par le nombre de membres actifs. La bénéficiaire reçoit ce pot, diminué de l'éventuel rabais d'enchère et de la commission eganyé. Le montant net, le rabais et la commission figurent dans son historique.",
          "Un même tour ne peut pas être versé deux fois, et le pot ne peut être versé qu'à un membre actif du cercle.",
        ],
      },
      {
        heading: '7. Quitter un cercle',
        paragraphs: [
          "Vous pouvez demander à quitter un cercle, et l'organisatrice peut exclure un membre. Sortir d'un cercle ne fait pas disparaître ce que vous devez aux autres membres si vous avez déjà reçu votre pot.",
        ],
      },
      {
        heading: '8. En cas de litige',
        paragraphs: [
          "Parlez-en d'abord dans la discussion du cercle. Si le désaccord persiste, " + contactLine() + " : nous pouvons vous transmettre l'historique des cotisations et des versements du cercle.",
        ],
      },
    ],
  },

  credit: {
    id: 'credit',
    title: 'Conditions du microcrédit',
    audience: 'Pour les emprunteuses et emprunteurs',
    sections: [
      {
        heading: '1. Qui peut demander',
        paragraphs: [
          "Certains crédits exigent un score de réputation eganyé minimum, indiqué sur la fiche du service. Une personne ne peut avoir qu'une seule demande ouverte à la fois (en étude, en offre ou en cours de remboursement).",
          "Le montant demandé est plafonné en fonction de votre épargne dans vos cercles. Ce plafond est indicatif : le montant accordé est décidé par notre équipe.",
        ],
      },
      {
        heading: '2. La demande',
        paragraphs: [
          "Vous présentez votre projet : son nom, à quoi servira l'argent, le montant et la durée souhaités. La demande est gratuite : aucun frais n'est prélevé pour l'envoyer ni pour l'étudier.",
          "En envoyant une demande, vous autorisez notre équipe à consulter votre score de réputation et votre historique de cotisations pour l'étudier.",
        ],
      },
      {
        heading: "3. L'offre",
        paragraphs: [
          "Notre équipe refuse la demande en vous expliquant pourquoi, ou vous fait une offre : le montant prêté (il peut être inférieur à votre demande), le taux d'intérêt, la durée en mois et le total à rembourser.",
          "Durée de remboursement : de 3 à 24 mois. Les intérêts sont calculés une seule fois sur le montant prêté (intérêt simple) : total à rembourser = montant prêté + montant prêté × taux. Le taux annuel (intérêt simple) ne dépasse jamais 36 %, et le taux sur toute la durée ne dépasse jamais 24 % du montant prêté (par exemple : 9 % au plus sur 3 mois, 18 % au plus sur 6 mois). Le total et le taux annuel vous sont affichés au franc près avant que vous ne décidiez. Aucun autre frais ne peut vous être réclamé.",
          "Exemple : pour 50 000 FCFA prêtés sur 6 mois à 10 % (taux annuel 20 %), vous remboursez 55 000 FCFA en tout, soit environ 9 166 FCFA par mois.",
          "Vous êtes libre d'accepter ou de refuser l'offre. Rien ne vous est versé, et vous ne devez rien, tant que vous ne l'avez pas acceptée.",
        ],
      },
      {
        heading: '4. Versement et mensualités',
        paragraphs: [
          "Dès que vous acceptez l'offre, le montant prêté est versé sur votre portefeuille eganyé. Le total à rembourser est divisé en mensualités égales (la dernière corrige l'arrondi), la première étant due un mois après le versement.",
          "À chaque date d'échéance, la mensualité est prélevée automatiquement sur votre portefeuille si le solde le permet. Vous pouvez aussi rembourser en avance, en une ou plusieurs fois : toute somme versée solde d'abord la mensualité la plus ancienne. Chaque remboursement apparaît dans votre historique.",
        ],
      },
      {
        heading: '5. Si vous ne remboursez pas',
        paragraphs: [
          "Une mensualité qui n'a pas pu être prélevée passe « en retard » ; vous êtes prévenu·e et elle sera prélevée dès que votre portefeuille le permettra. Les retards sont suivis par notre équipe et peuvent vous fermer l'accès à de nouveaux crédits. Le montant reste dû. Si vous avez une difficulté, prévenez-nous avant l'échéance : " + contactLine() + '.',
        ],
      },
      {
        heading: '6. Empruntez avec prudence',
        paragraphs: [
          "Un crédit engage. N'empruntez que ce que vous êtes certain·e de pouvoir rembourser chaque mois, et gardez sur votre portefeuille de quoi payer chaque mensualité à sa date.",
        ],
      },
    ],
  },

  aide: {
    id: 'aide',
    title: 'Conditions du Coup de pouce',
    audience: 'Pour les personnes qui demandent une aide',
    sections: [
      {
        heading: '1. Ce qu’est le Coup de pouce',
        paragraphs: [
          "Le Coup de pouce est une aide en argent, offerte par eganyé pour soutenir une activité. Ce n'est pas un prêt : une aide accordée n'est jamais à rembourser, et aucun intérêt n'est dû.",
          "Une personne ne peut avoir qu'un seul dossier à l'étude à la fois.",
        ],
      },
      {
        heading: '2. Le dossier',
        paragraphs: [
          "Vous indiquez votre activité, ce que vous ferez de l'argent et le montant dont vous avez besoin. Une vidéo de présentation est obligatoire : envoyée depuis votre téléphone ou sous forme de lien. Une vidéo envoyée est conservée dans un espace privé, visible seulement par vous et notre équipe.",
          "En déposant un dossier, vous autorisez notre équipe à consulter votre score de réputation et votre historique de cotisations pour l'étudier.",
        ],
      },
      {
        heading: "3. Les frais d'étude",
        paragraphs: [
          "Des frais d'étude (1 000 FCFA, ou le montant affiché au moment du dépôt) sont prélevés sur votre portefeuille quand vous déposez le dossier. Ils paient le temps que notre équipe passe à regarder votre vidéo et à étudier votre demande. Ils ne sont pas remboursés, même si l'aide n'est pas accordée.",
          "Ces frais n'achètent pas une chance de gagner : il n'y a ni tirage au sort ni hasard. Chaque dossier est étudié par une personne de notre équipe, qui décide d'après son contenu.",
        ],
      },
      {
        heading: '4. La décision',
        paragraphs: [
          "Notre équipe refuse le dossier en vous expliquant pourquoi, ou accorde une aide. Le montant accordé peut être inférieur à votre demande. Une aide accordée est versée tout de suite sur votre portefeuille eganyé et vous en êtes prévenu·e par notification.",
          "eganyé n'est jamais obligé d'accorder une aide, et le nombre d'aides accordées dépend des moyens disponibles.",
        ],
      },
      {
        heading: '5. Bonne foi',
        paragraphs: [
          "Les informations et la vidéo doivent être vraies et vous concerner. Un dossier mensonger peut être refusé et entraîner la fermeture de l'accès au Coup de pouce. Pour toute question : " + contactLine() + '.',
        ],
      },
    ],
  },

  confidentialite: {
    id: 'confidentialite',
    title: 'Politique de confidentialité',
    audience: 'Pour toute personne qui utilise eganyé',
    sections: [
      {
        heading: '1. Qui est responsable de vos données',
        paragraphs: [
          `Le responsable du traitement est ${LEGAL_ENTITY.name}${LEGAL_ENTITY.legalForm ? `, ${LEGAL_ENTITY.legalForm}` : ''}${LEGAL_ENTITY.registration ? ` (${LEGAL_ENTITY.registration})` : ''}${LEGAL_ENTITY.address ? `, ${LEGAL_ENTITY.address}, ${LEGAL_ENTITY.country}` : ''}, qui édite l'application eganyé.`,
          "Pour toute question ou demande sur vos données, " + contactLine() + '.',
        ],
      },
      {
        heading: '2. Les données que nous collectons',
        paragraphs: [
          "Compte : nom, prénom, adresse e-mail, numéro de téléphone, date de naissance, photo ou avatar si vous en choisissez un, langue et préférences de notification, et la personne de confiance (nom et téléphone) si vous en désignez une.",
          "Vérification d'identité : nom complet, numéro et photo de votre pièce d'identité.",
          "Cercles : les cercles que vous créez ou rejoignez, votre rôle, les invitations, l'ordre de passage, les échéances, l'état de vos cotisations, les retards et pénalités, et les messages échangés dans les discussions de cercle.",
          "Argent : dépôts, retraits, cotisations, versements, épargne bloquée, avec pour chaque opération le montant, la date, le statut et la référence du paiement (voir la section 5).",
          "Microcrédit : la description de votre projet, le montant et la durée demandés, l'offre et les remboursements.",
          "Coup de pouce : la description de votre activité, le montant demandé et votre vidéo de présentation (ou son lien). Une vidéo envoyée est conservée dans un espace privé, visible seulement par vous et notre équipe.",
          "Assistance : vos demandes au Centre d'aide et nos réponses, et les questions que vous posez à l'assistant intelligent.",
          "Données techniques : type d'appareil et adresse IP, enregistrés avec les opérations sensibles (code PIN, mouvements d'argent) dans un journal de sécurité. Pour connaître votre adresse IP, l'application interroge le service ipify.",
          "Votre code PIN et votre mot de passe ne sont jamais conservés en clair : seule une empreinte irréversible est stockée. Nous ne voyons jamais votre code secret Mobile Money.",
        ],
      },
      {
        heading: '3. Pourquoi, et sur quelle base',
        paragraphs: [
          "Pour vous fournir le service que vous avez demandé en créant votre compte (exécution du contrat) : faire fonctionner votre compte, vos cercles, votre portefeuille et votre épargne, envoyer les rappels d'échéance, étudier vos demandes de crédit et de Coup de pouce, et répondre à vos demandes d'aide.",
          "Pour respecter nos obligations légales : vérifier votre identité et conserver les traces des opérations d'argent (comptabilité, lutte contre la fraude et le blanchiment).",
          "Pour notre intérêt légitime à protéger les membres et le service : journal de sécurité, détection des fraudes et des abus, calcul du score de réputation à partir de votre régularité de cotisation.",
          "Avec votre accord : les notifications par SMS ou WhatsApp que vous choisissez d'activer, que vous pouvez couper à tout moment dans Profil.",
          "Nous ne vendons pas vos données et ne les utilisons pas pour de la publicité. L'application n'utilise ni cookie publicitaire, ni outil de mesure d'audience.",
        ],
      },
      {
        heading: '4. Qui y a accès',
        paragraphs: [
          "Les membres de vos cercles voient votre nom, votre avatar et l'état de vos cotisations dans ces cercles. Vos coordonnées (téléphone, e-mail) ne leur sont pas montrées.",
          "Notre équipe y accède pour la vérification d'identité, le support, les retraits et l'étude des demandes de crédit et de Coup de pouce.",
          "Nos prestataires, chacun uniquement pour sa tâche :",
          "• Supabase : base de données, comptes et stockage des fichiers (toutes les données ci-dessus), sur des serveurs situés en Irlande (Union européenne).",
          "• Vercel : hébergement de l'application et de nos serveurs (les données traversent ses serveurs sans y être conservées).",
          "• PayDunya : encaissement des dépôts Mobile Money (nom, e-mail, téléphone, montant, opérateur).",
          "• Twilio : envoi des SMS et messages WhatsApp (numéro de téléphone et texte du message).",
          "• Resend : envoi des e-mails (adresse e-mail et texte du message).",
          "• Anthropic : assistant intelligent (seules les questions que vous lui posez, sans vos coordonnées).",
          "• ipify : détection de l'adresse IP (votre adresse IP uniquement).",
          "Ces prestataires sont situés hors du Togo, dans l'Union européenne (Supabase) et aux États-Unis : vos données sont donc transférées hors du Togo et de l'UEMOA, uniquement pour ces tâches.",
          "Nous pouvons aussi transmettre des données aux autorités lorsque la loi nous y oblige.",
        ],
      },
      {
        heading: '5. Paiements, solde et retraits',
        paragraphs: [
          "Dépôts : quand vous rechargez votre portefeuille, le paiement est encaissé par PayDunya. Pour le traiter, nous lui transmettons votre nom, votre adresse e-mail, votre numéro de téléphone, le montant et l'opérateur choisi. PayDunya traite ces informations selon ses propres conditions et sa propre politique de confidentialité.",
          "Vous validez le paiement sur votre téléphone, auprès de votre opérateur : eganyé ne voit ni ne conserve jamais votre code secret Mobile Money.",
          "Votre solde et votre historique sont tenus dans la base de données d'eganyé. Un dépôt n'est ajouté à votre solde qu'après que nos serveurs ont vérifié directement auprès de PayDunya que le paiement a abouti. Nous gardons la référence PayDunya de chaque paiement pour pouvoir le retrouver en cas de réclamation.",
          "Retraits : nous enregistrons le montant, l'opérateur et le numéro Mobile Money qui doit recevoir l'argent. Notre équipe utilise ces informations pour vous envoyer l'argent, puis marque le retrait comme effectué ou, si l'envoi échoue, comme échoué (le montant vous est alors rendu).",
          "Pour chaque opération sur votre argent, nous enregistrons aussi la date, le statut et l'adresse IP de l'appareil, afin de détecter les fraudes et de traiter les réclamations.",
        ],
      },
      {
        heading: '6. Sécurité',
        paragraphs: [
          "Les échanges entre l'application et nos serveurs sont chiffrés (HTTPS). L'accès aux données est cloisonné : chaque compte ne peut lire que ce qui le concerne, et les opérations d'argent ne passent que par des fonctions contrôlées côté serveur. Les retraits sont protégés par un code PIN, bloqué 15 minutes après 5 erreurs. Vos pièces d'identité sont dans un espace de stockage privé, lisible seulement par vous et l'équipe de vérification.",
          "Si une fuite de données risquait de vous porter préjudice, nous vous préviendrions, ainsi que l'autorité de protection des données.",
        ],
      },
      {
        heading: '7. Combien de temps',
        paragraphs: [
          "Compte, cercles, messages et préférences : tant que votre compte est ouvert.",
          "Pièce d'identité, avatar et vidéos Coup de pouce : tant que votre compte est ouvert ; ces fichiers sont effacés à la fermeture du compte.",
          "Traces des opérations d'argent (montants, dates, références, journal comptable) : 10 ans, comme l'exigent les règles comptables (OHADA) et de lutte contre le blanchiment. Après la fermeture du compte, elles ne sont plus rattachées à votre nom.",
          "Journal de sécurité : conservé avec les traces des opérations d'argent qu'il protège.",
        ],
      },
      {
        heading: '8. Vos droits et la suppression du compte',
        paragraphs: [
          "Vous pouvez consulter et corriger vos informations dans Profil. Vous pouvez aussi demander une copie de vos données, leur correction ou leur effacement, ou vous opposer à un traitement : " + contactLine() + '. Nous répondons sous 30 jours.',
          "Suppression du compte : depuis l'application (Profil), ou sans l'application, depuis la page eganye.codorah.com/suppression-compte. Votre profil est anonymisé immédiatement : nom, coordonnées, date de naissance, photo, pièce d'identité, vidéos et notifications sont effacés, puis le compte est supprimé. Seules les traces des opérations d'argent sont gardées, sans votre nom, pendant la durée indiquée à la section 7.",
          "La suppression est refusée tant que votre portefeuille n'est pas vide, que vous participez à un cercle actif ou qu'un crédit est en cours : retirez d'abord votre solde et terminez vos engagements, pour ne léser personne.",
          "Vous pouvez aussi saisir l'autorité de protection des données personnelles de votre pays (au Togo : l'Instance de Protection des Données à Caractère Personnel, IPDCP).",
        ],
      },
    ],
  },

  mentions: {
    id: 'mentions',
    title: 'Mentions légales',
    audience: "Qui édite et héberge eganyé",
    sections: [
      {
        heading: 'Éditeur',
        paragraphs: entityLines(),
      },
      {
        heading: 'Hébergement',
        paragraphs: [
          "Application web : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.",
          "Base de données et fichiers : Supabase Inc., 970 Toa Payoh North #07-04, Singapour 318992.",
        ],
      },
      {
        heading: 'Propriété intellectuelle',
        paragraphs: [
          "Le nom eganyé, son logo, ses icônes et ses textes appartiennent à leur éditeur. Toute reproduction sans autorisation est interdite.",
        ],
      },
    ],
  },
};

/** Ordre d'affichage dans la liste « Conditions & Légal » du Profil. */
export const LEGAL_DOC_ORDER: LegalDocId[] = ['cgu', 'reglement', 'credit', 'aide', 'confidentialite', 'mentions'];
