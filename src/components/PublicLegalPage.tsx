import { LEGAL_DOCUMENTS, LEGAL_ENTITY, LEGAL_LAST_UPDATED, type LegalDocId } from '@/lib/legalDocuments';

/**
 * Documents légaux lisibles sans compte, à une adresse web fixe.
 *
 * La console Google Play demande l'URL d'une politique de confidentialité et
 * celle d'une page expliquant comment supprimer son compte sans l'application.
 * Ces pages lisent la même source que l'app (lib/legalDocuments) : un texte
 * corrigé l'est partout.
 */
export const PUBLIC_LEGAL_PATHS: Record<string, LegalDocId | 'suppression'> = {
  '/confidentialite': 'confidentialite',
  '/conditions': 'cgu',
  '/reglement': 'reglement',
  '/conditions-credit': 'credit',
  '/conditions-coup-de-pouce': 'aide',
  '/mentions-legales': 'mentions',
  '/suppression-compte': 'suppression',
};

export function publicLegalPageFor(pathname: string): LegalDocId | 'suppression' | null {
  const clean = pathname.replace(/\/+$/, '').replace(/\.html$/, '') || '/';
  return PUBLIC_LEGAL_PATHS[clean] ?? null;
}

const DELETION_DOC = {
  title: 'Supprimer votre compte eganyé',
  audience: 'Pour toute personne qui a un compte eganyé',
  sections: [
    {
      heading: 'Depuis l’application',
      paragraphs: [
        'Ouvrez eganyé, allez dans Profil, puis touchez « Supprimer mon compte » et confirmez.',
        'Votre profil est anonymisé tout de suite (nom, e-mail, téléphone, photo, date de naissance), vos pièces d’identité et vos notifications sont effacées, puis votre compte de connexion est supprimé par notre équipe.',
      ],
    },
    {
      heading: 'Sans l’application',
      paragraphs: [
        LEGAL_ENTITY.contactEmail
          ? `Écrivez à ${LEGAL_ENTITY.contactEmail} depuis l’adresse e-mail de votre compte, avec pour objet « Suppression de compte ». Nous traitons la demande sous 30 jours et vous confirmons la suppression par e-mail.`
          : 'Contactez notre équipe depuis l’adresse e-mail de votre compte, avec pour objet « Suppression de compte ». Nous traitons la demande sous 30 jours et vous confirmons la suppression par e-mail.',
      ],
    },
    {
      heading: 'Avant de supprimer',
      paragraphs: [
        'Pour protéger votre argent et celui des autres membres, la suppression est refusée tant que votre portefeuille n’est pas vide, que vous participez à un cercle actif ou qu’un crédit est en cours de remboursement. Retirez votre solde et terminez vos engagements d’abord.',
      ],
    },
    {
      heading: 'Ce qui est conservé',
      paragraphs: [
        'Les traces des opérations financières (montants, dates) sont conservées, sans votre nom ni vos coordonnées, le temps exigé par les obligations comptables et de lutte contre le blanchiment, soit jusqu’à 10 ans. Tout le reste est effacé.',
      ],
    },
  ],
};

export function PublicLegalPage({ docId }: { docId: LegalDocId | 'suppression' }) {
  const doc = docId === 'suppression' ? DELETION_DOC : LEGAL_DOCUMENTS[docId];

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-10">
      <article className="max-w-2xl mx-auto space-y-6">
        <header className="space-y-2">
          <a href="/" className="text-2xl font-serif font-black lowercase text-brand">eganyé</a>
          <h1 className="text-3xl font-serif font-black">{doc.title}</h1>
          <p className="text-sm text-muted-foreground">{doc.audience} — mis à jour le {LEGAL_LAST_UPDATED}</p>
        </header>
        {doc.sections.map((section) => (
          <section key={section.heading} className="space-y-2">
            <h2 className="text-lg font-bold">{section.heading}</h2>
            {section.paragraphs.map((paragraph, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">{paragraph}</p>
            ))}
          </section>
        ))}
        <nav className="pt-6 border-t border-border flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <a href="/confidentialite" className="underline">Confidentialité</a>
          <a href="/conditions" className="underline">Conditions d’utilisation</a>
          <a href="/conditions-credit" className="underline">Microcrédit</a>
          <a href="/conditions-coup-de-pouce" className="underline">Coup de pouce</a>
          <a href="/suppression-compte" className="underline">Supprimer mon compte</a>
          <a href="/mentions-legales" className="underline">Mentions légales</a>
        </nav>
      </article>
    </main>
  );
}
