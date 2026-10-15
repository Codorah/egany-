import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LEGAL_DOCUMENTS, LEGAL_LAST_UPDATED, type LegalDocId } from '@/lib/legalDocuments';

interface LegalDocumentDialogProps {
  /** Document à afficher ; null ferme la fenêtre. */
  docId: LegalDocId | null;
  onClose: () => void;
}

/**
 * Fenêtre unique d'affichage des documents légaux (inscription, Profil,
 * création de cercle, microcrédit). Le contenu vient de lib/legalDocuments.
 */
export default function LegalDocumentDialog({ docId, onClose }: LegalDocumentDialogProps) {
  const doc = docId ? LEGAL_DOCUMENTS[docId] : null;

  return (
    <Dialog open={doc !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-3xl p-6 bg-card border border-border">
        {doc && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-serif font-black text-foreground">{doc.title}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {doc.audience} — mis à jour le {LEGAL_LAST_UPDATED}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {doc.sections.map((section) => (
                <section key={section.heading} className="space-y-1.5">
                  <h3 className="text-[13px] font-bold text-foreground">{section.heading}</h3>
                  {section.paragraphs.map((paragraph, i) => (
                    <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </section>
              ))}
            </div>

            <div className="pt-3">
              <Button
                onClick={onClose}
                className="w-full rounded-2xl h-10 bg-[#C96F4A] hover:bg-[#B85C36] text-white text-xs font-bold"
              >
                J'ai compris
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
