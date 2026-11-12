import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Explication de la plateforme : les deux vidéos et le lexique, au même endroit.
 * Montée dans Profil (toujours là une fois connecté) et sur l'accueil quand on est
 * déconnecté, parce que la vitrine du site ne s'affiche que sur ordinateur.
 *
 * Les vidéos existent en français et en anglais ; les autres langues reçoivent le français.
 */

interface Term {
  fr: [string, string];
  en: [string, string];
}

// Mots employés partout dans l'application, expliqués une fois.
const GLOSSARY: Term[] = [
  {
    fr: ['Tontine', 'Un groupe de personnes qui cotisent la même somme à chaque tour. À chaque tour, l’une d’elles reçoit tout le pot.'],
    en: ['Tontine', 'A group of people who each put in the same amount every round. Each round, one of them receives the whole pot.'],
  },
  {
    fr: ['Cercle', 'Votre groupe dans eganyé : ses membres, son montant, son rythme et ses règles.'],
    en: ['Circle', 'Your group in eganyé: its members, its amount, its schedule and its rules.'],
  },
  {
    fr: ['Cotisation', 'La somme que chaque membre verse à chaque tour. Elle part de votre portefeuille à la date prévue si le solde suffit.'],
    en: ['Contribution', 'The amount each member pays every round. It leaves your wallet on the due date if your balance is enough.'],
  },
  {
    fr: ['Pot', 'L’argent réuni par le cercle pour un tour. Il est versé au bénéficiaire quand tout le monde a cotisé.'],
    en: ['Pot', 'The money the circle has collected for one round. It is paid to the beneficiary once everyone has contributed.'],
  },
  {
    fr: ['Tour', 'Le moment où un membre reçoit le pot. L’ordre est visible dans la page du cercle.'],
    en: ['Turn', 'The moment a member receives the pot. The order is shown on the circle’s page.'],
  },
  {
    fr: ['Portefeuille', 'Votre argent dans eganyé. On le recharge par Mobile Money (Flooz, Mixx) et on peut le retirer vers son numéro.'],
    en: ['Wallet', 'Your money in eganyé. You top it up with Mobile Money (Flooz, Mixx) and can withdraw it to your number.'],
  },
  {
    fr: ['Mon Épargne et coffre', 'Un coffre met de l’argent de côté pour un projet. Vous choisissez la date à partir de laquelle il se débloque.'],
    en: ['My Savings and vault', 'A vault sets money aside for a project. You choose the date from which it unlocks.'],
  },
  {
    fr: ['Code PIN', 'Quatre chiffres demandés à chaque retrait. Ne les donnez à personne.'],
    en: ['PIN code', 'Four digits asked for at every withdrawal. Never share them with anyone.'],
  },
  {
    fr: ['Score de fiabilité', 'Une estimation, calculée à partir de vos seules cotisations, du risque d’un prochain retard. Elle peut se tromper et ne décide rien.'],
    en: ['Reliability score', 'An estimate, based only on your contributions, of the risk of a late payment next time. It can be wrong and decides nothing.'],
  },
  {
    fr: ['Assistant', 'Il vous prévient avant un retard, vous explique votre score et répond sur vos cotisations, à partir de vos données.'],
    en: ['Assistant', 'It warns you before a late payment, explains your score and answers about your contributions, using your own data.'],
  },
];

export function PlatformGuide() {
  const { language } = useLanguage();
  const en = language === 'en';
  const videos = en
    ? [
        { name: 'eganye-presentation-en', title: 'eganyé in 49 seconds', hint: 'The idea, in short.' },
        { name: 'eganye-how-it-works-en', title: 'How it works, screen by screen', hint: 'From signing up to creating a circle, contributing and withdrawing.' },
      ]
    : [
        { name: 'eganye-presentation-fr', title: 'eganyé en 49 secondes', hint: 'L’idée, en bref.' },
        { name: 'eganye-comment-ca-marche-fr', title: 'Comment ça marche, écran par écran', hint: 'De l’inscription à la création d’un cercle, la cotisation et le retrait.' },
      ];

  return (
    <div className="space-y-8">
      <section className="space-y-5" aria-label={en ? 'Videos' : 'Vidéos'}>
        {videos.map((video) => (
          <div key={video.name} className="space-y-2">
            <div>
              <h2 className="text-base font-bold text-foreground">{video.title}</h2>
              <p className="text-[13px] text-muted-foreground">{video.hint}</p>
            </div>
            <video
              key={video.name}
              className="w-full aspect-video rounded-xl bg-foreground"
              src={`/video/${video.name}.mp4`}
              poster={`/video/${video.name}.jpg`}
              controls
              playsInline
              preload="none"
            >
              {en ? 'Your browser cannot play this video.' : 'Votre navigateur ne lit pas cette vidéo.'}
            </video>
          </div>
        ))}
      </section>

      <section aria-label={en ? 'Glossary' : 'Lexique'}>
        <h2 className="mb-1 text-base font-bold text-foreground">{en ? 'Words used in eganyé' : 'Les mots d’eganyé'}</h2>
        <dl className="divide-y divide-border">
          {GLOSSARY.map((term) => {
            const [word, meaning] = en ? term.en : term.fr;
            return (
              <div key={word} className="py-3">
                <dt className="text-sm font-bold text-foreground">{word}</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{meaning}</dd>
              </div>
            );
          })}
        </dl>
      </section>
    </div>
  );
}

/** Même contenu dans une fenêtre, pour l'écran d'accueil quand on n'a pas encore de compte. */
export function PlatformGuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { language } = useLanguage();
  const en = language === 'en';
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">{en ? 'Discover eganyé' : 'Découvrir eganyé'}</DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">
            {en ? 'Two short videos and the words you will meet.' : 'Deux courtes vidéos et les mots que vous allez rencontrer.'}
          </DialogDescription>
        </DialogHeader>
        <PlatformGuide />
        <Button onClick={onClose} className="h-11 w-full rounded-xl font-bold">
          {en ? 'Close' : 'Fermer'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
