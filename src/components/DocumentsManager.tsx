import React, { useEffect, useState, useCallback } from 'react';
import { supabase, createChannel } from '@/lib/supabase';
import { mapGroupDocumentRow } from '@/lib/mappers';
import { Group, GroupDocument, UserProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmationBottomSheet } from './ui/ConfirmationBottomSheet';
import { FileText, Upload, Loader2, Trash2, Download, File } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const [category, setCategory] = useState<GroupDocument['category']>('autre');
  const [uploading, setUploading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<GroupDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('doc_file_too_large_error'));
      return;
    }

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
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error(t('doc_upload_error'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
    <div className="glass-card rounded-3xl shadow-soft border border-border/70 p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="text-base font-serif font-black text-foreground flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          {t('doc_section_title')}
        </h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">{t('doc_section_desc')}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={category} onValueChange={(v) => setCategory(v as GroupDocument['category'])}>
          <SelectTrigger className="sm:w-[180px] rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(categoryLabels) as GroupDocument['category'][]).map((key) => (
              <SelectItem key={key} value={key}>{categoryLabels[key]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
        <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="sm:w-auto rounded-xl gap-1.5 cursor-pointer active:scale-95 transition-transform">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {t('doc_share_button')}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : documents.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">{t('doc_empty_state')}</p>
      ) : (
        <div className="space-y-2">
          {documents.map((document) => (
            <div key={document.id} className="flex items-center justify-between p-3 rounded-2xl border border-border/70">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                  <File className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{document.name}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {categoryLabels[document.category]} • {formatSize(document.size)} • {t('doc_uploaded_by_prefix')} {document.uploaderName} • {format(new Date(document.uploadedAt), 'dd/MM/yyyy')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Badge variant="outline" className="hidden sm:inline-flex text-[13px] rounded-full">{categoryLabels[document.category]}</Badge>
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl cursor-pointer" onClick={() => handleDownload(document)} title={t('doc_download_title')}>
                  <Download className="w-4 h-4" />
                </Button>
                {(document.uploaderId === user.uid || user.uid === group.creatorId || user.role === 'admin') && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl text-danger cursor-pointer" onClick={() => setPendingDelete(document)} title={t('bank_delete_cta')}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
