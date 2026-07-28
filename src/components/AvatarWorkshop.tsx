import React, { useRef, useState } from 'react';
import { Camera, Upload, Trash2, Check, User } from 'lucide-react';
import { CustomAvatar } from './CustomAvatar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface AvatarWorkshopProps {
  value?: any;
  onChange?: (config: any) => void;
  photoURL?: string;
  name?: string;
  onPhotoUploaded?: (url: string) => void;
  onSave?: () => void;
  isSaving?: boolean;
  saveLabel?: string;
}

export function AvatarWorkshop({ 
  value, 
  onChange, 
  photoURL: initialPhotoURL, 
  name = 'User',
  onPhotoUploaded 
}: AvatarWorkshopProps) {
  const [previewURL, setPreviewURL] = useState<string | null>(initialPhotoURL || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Veuillez sélectionner une image valide (JPG, PNG).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setPreviewURL(url);
      if (onPhotoUploaded) onPhotoUploaded(url);
      if (onChange) onChange(url);
      toast.success("Photo de profil mise à jour !");
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPreviewURL(null);
    if (onPhotoUploaded) onPhotoUploaded('');
    if (onChange) onChange('');
    toast.info("Photo supprimée. Première lettre du nom utilisée.");
  };

  return (
    <div className="flex flex-col items-center text-center space-y-4 py-2">
      <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
        <CustomAvatar photoURL={previewURL || undefined} name={name} size={96} />
        <div className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full shadow-md group-hover:scale-110 transition-transform">
          <Camera className="w-4 h-4" />
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex items-center gap-2">
        <Button
          onClick={() => fileInputRef.current?.click()}
          variant="outline"
          size="sm"
          className="rounded-xl text-xs font-bold border-border text-foreground hover:bg-muted cursor-pointer flex items-center gap-1.5"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Téléverser une photo</span>
        </Button>

        {previewURL && (
          <Button
            onClick={handleRemovePhoto}
            variant="ghost"
            size="sm"
            className="rounded-xl text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Supprimer
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {previewURL ? "Photo personnalisée active." : "Si aucune photo n'est choisie, la première lettre de votre nom sera affichée."}
      </p>
    </div>
  );
}
