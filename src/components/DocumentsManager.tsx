import React, { useEffect, useState, useCallback } from 'react';
import { Check, Download, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase, createChannel } from '@/lib/supabase';
import { mapGroupDocumentRow } from '@/lib/mappers';
import { Group, GroupDocument, UserProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmationBottomSheet } from './ui/ConfirmationBottomSheet';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';

interface DocumentsManagerProps {
  group: Group;
  user: UserProfile;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const BUCKET = 'group-documents';

export function DocumentsManager({ group, user }: DocumentsManagerProps) {
  const { t } = useLanguage();
  const categoryLabels: Record<GroupDocument['category'], string> = {
    statuts: t('doc_cat_statuts'),
    contrat: t('doc_cat_contrat'),
    pv: t('doc_cat_pv'),
    justificatif: t('doc_cat_justificatif'),
    autre: t('doc_cat_autre'),
  };

  const [documents, setDocuments] = useState<GroupDocument[]>([]);
  const [loading, setLoading] = useState(true);
  // Le fichier choisi attend sa catégorie : on la demande après, pas avant.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [category, setCategory] = useState<GroupDocument['category']>('autre');
  const [uploading, setUploading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<GroupDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useBackHandler(
    React.useCallback(() => {
      setPendingFile(null);
      return true;
    }, []),
    pendingFile !== null
  );

  const fetchDocuments = useCallback(async () => {
    const { data, error } = await supabase
      .from('group_documents')
      .select('*')
      .eq('group_id', group.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching documents:', error);
      setLoading(false);
      return;
    }
    setDocuments((data ?? []).map(mapGroupDocumentRow));
    setLoading(false);
  }, [group.id]);

  useEffect(() => {
    fetchDocuments();
    const channel = createChannel(`group-documents-${group.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_documents', filter: `group_id=eq.${group.id}` }, () => fetchDocuments())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [group.id, fetchDocuments]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('doc_file_too_large_error'));
      return;
    }
    setCategory('autre');
    setPendingFile(file);
  };

  const handleUpload = async () => {
    const file = pendingFile;
    if (!file) return;
    setUploading(true);
    try {
      const storagePath = `${group.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file);
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('group_documents').insert({
        group_id: group.id,
        uploader_id: user.uid,
        uploader_name: user.displayName,
        name: file.name,
        category,
        storage_path: storagePath,
        size: file.size,
        content_type: file.type || 'application/octet-stream',
      });
      if (insertError) throw insertError;

      toast.success(t('doc_shared_success'));
      setPendingFile(null);
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error(t('doc_upload_error'));
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (document: GroupDocument) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(document.storagePath, 60);
    if (error || !data) {
      toast.error(t('doc_download_link_error'));
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await supabase.storage.from(BUCKET).remove([pendingDelete.storagePath]);
      const { error } = await supabase.from('group_documents').delete().eq('id', pendingDelete.id);
      if (error) throw error;
      toast.success(t('doc_deleted_success'));
      setPendingDelete(null);
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error(t('doc_delete_error'));
    } finally {
      setDeleting(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : documents.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('doc_empty_state')}</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {documents.map((document) => (
            <li key={document.id} className="flex items-center gap-1 py-1 pl-4 pr-1">
              <div className="min-w-0 flex-1 py-1.5">
                <p className="truncate text-sm font-bold text-foreground">{document.name}</p>
                <p className="text-[13px] text-muted-foreground">
                  {categoryLabels[document.category]} · {formatSize(document.size)} · {document.uploaderName} · {format(new Date(document.uploadedAt), 'dd/MM/yyyy')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(document)}
                aria-label={t('doc_download_title')}
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted"
              >
                <Download className="h-5 w-5" />
              </button>
              {(document.uploaderId === user.uid || user.uid === group.creatorId || user.role === 'admin') && (
                <button
                  type="button"
                  onClick={() => setPendingDelete(document)}
                  aria-label={t('bank_delete_cta')}
                  className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-danger"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
      <Button onClick={() => fileInputRef.current?.click()} className="h-12 w-full cursor-pointer gap-2 rounded-xl font-bold">
        <Upload className="h-5 w-5" />
        {t('doc_share_button')}
      </Button>

      <Dialog open={pendingFile !== null} onOpenChange={(open) => { if (!open && !uploading) setPendingFile(null); }}>
        <DialogContent className="gap-3">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{t('cir_doc_choose_category')}</DialogTitle>
            <DialogDescription className="truncate">{pendingFile?.name}</DialogDescription>
          </DialogHeader>
          <div className="divide-y divide-border rounded-2xl border border-border">
            {(Object.keys(categoryLabels) as GroupDocument['category'][]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                aria-pressed={category === key}
                className="flex min-h-12 w-full cursor-pointer items-center justify-between px-4 text-left text-sm font-bold text-foreground transition-colors duration-150 first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/50"
              >
                {categoryLabels[key]}
                {category === key && <Check className="h-5 w-5 text-primary-ink" />}
              </button>
            ))}
          </div>
          <Button onClick={handleUpload} disabled={uploading} className="h-12 w-full cursor-pointer gap-2 rounded-xl font-bold">
            {uploading && <Loader2 className="h-5 w-5 animate-spin" />}
            {t('doc_share_button')}
          </Button>
        </DialogContent>
      </Dialog>

      <ConfirmationBottomSheet
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
        title={t('doc_delete_confirm_title')}
        description={t('doc_delete_confirm_desc')}
        type="destructive"
        isLoading={deleting}
      />
    </div>
  );
}
