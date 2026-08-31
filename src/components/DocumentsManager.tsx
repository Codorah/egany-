import React, { useEffect, useState, useCallback } from 'react';
import { supabase, createChannel } from '@/lib/supabase';
import { mapGroupDocumentRow } from '@/lib/mappers';
import { Group, GroupDocument, UserProfile } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Upload, Loader2, Trash2, Download, File } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface DocumentsManagerProps {
  group: Group;
  user: UserProfile;
}

const categoryLabels: Record<GroupDocument['category'], string> = {
  statuts: 'Statuts',
  contrat: 'Contrat',
  pv: 'PV de réunion',
  justificatif: 'Justificatif',
  autre: 'Autre'
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const BUCKET = 'group-documents';

export function DocumentsManager({ group, user }: DocumentsManagerProps) {
  const [documents, setDocuments] = useState<GroupDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<GroupDocument['category']>('autre');
  const [uploading, setUploading] = useState(false);
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
      toast.error('Le fichier dépasse la taille maximale de 10 Mo.');
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

      toast.success('Document partagé avec le cercle !');
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error("Erreur lors de l'envoi du document.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (document: GroupDocument) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(document.storagePath, 60);
    if (error || !data) {
      toast.error("Erreur lors de la génération du lien de téléchargement.");
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const handleDelete = async (document: GroupDocument) => {
    if (!confirm(`Supprimer "${document.name}" ?`)) return;
    try {
      await supabase.storage.from(BUCKET).remove([document.storagePath]);
      const { error } = await supabase.from('group_documents').delete().eq('id', document.id);
      if (error) throw error;
      toast.success('Document supprimé.');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Erreur lors de la suppression.');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="w-4 h-4" />
          Documents du cercle
        </CardTitle>
        <CardDescription>Statuts, contrats, PV de réunion et justificatifs partagés entre membres.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={category} onValueChange={(v) => setCategory(v as GroupDocument['category'])}>
            <SelectTrigger className="sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(categoryLabels) as GroupDocument['category'][]).map((key) => (
                <SelectItem key={key} value={key}>{categoryLabels[key]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="sm:w-auto">
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Partager un document
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : documents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Aucun document partagé pour ce cercle.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((document) => (
              <div key={document.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground shrink-0">
                    <File className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{document.name}</p>
                    <p className="text-[13px] text-muted-foreground">
                      {categoryLabels[document.category]} • {formatSize(document.size)} • par {document.uploaderName} • {format(new Date(document.uploadedAt), 'dd/MM/yyyy')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant="outline" className="hidden sm:inline-flex text-[13px]">{categoryLabels[document.category]}</Badge>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDownload(document)} title="Télécharger">
                    <Download className="w-4 h-4" />
                  </Button>
                  {(document.uploaderId === user.uid || user.uid === group.creatorId || user.role === 'admin') && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-danger" onClick={() => handleDelete(document)} title="Supprimer">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
