import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createAvatar } from '@dicebear/core';
import {
  notionists,
  avataaars,
  adventurer,
  openPeeps,
  micah,
  personas,
} from '@dicebear/collection';
import { Upload, Shuffle, Loader2 } from 'lucide-react';
import { CustomAvatar, AvatarConfig } from './CustomAvatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface AvatarWorkshopProps {
  value?: AvatarConfig;
  onChange?: (value: AvatarConfig) => void;
  name?: string;
  userId?: string;
  /** Real photo upload needs an authenticated Supabase session (Storage RLS
   * checks auth.uid()) — not available yet during onboarding, before the
   * account exists. Defaults to true for the post-signup Profile screen. */
  allowPhotoUpload?: boolean;
}

// Each DiceBear style has its own distinct Options type, so a homogeneous
// array can't stay precisely typed style-by-style — we only ever pass the
// universal `seed` option, so `any` here is a deliberate, narrow trade-off.
const ILLUSTRATED_STYLES: { id: string; label: string; style: any }[] = [
  { id: 'notionists', label: 'Notionists', style: notionists },
  { id: 'avataaars', label: 'Avataaars', style: avataaars },
  { id: 'adventurer', label: 'Aventurier', style: adventurer },
  { id: 'openPeeps', label: 'Peeps', style: openPeeps },
  { id: 'micah', label: 'Micah', style: micah },
  { id: 'personas', label: 'Personas', style: personas },
];

function generateIllustratedAvatar(styleId: string, seed: string): string {
  const entry = ILLUSTRATED_STYLES.find((s) => s.id === styleId) || ILLUSTRATED_STYLES[0];
  return createAvatar(entry.style, { seed }).toDataUri();
}

export function AvatarWorkshop({ value, onChange, name = 'User', userId, allowPhotoUpload = true }: AvatarWorkshopProps) {
  const [mode, setMode] = useState<'illustrated' | 'photo'>('illustrated');
  const [styleId, setStyleId] = useState<string>(ILLUSTRATED_STYLES[0].id);
  const [seed, setSeed] = useState<string>(name || 'eganye');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const illustratedPreview = useMemo(() => generateIllustratedAvatar(styleId, seed), [styleId, seed]);

  // The default style/seed is generated and shown immediately, but onChange
  // only fires on explicit interaction — without this, a user who never
  // touches the picker ends up with no avatar saved at all, despite one
  // being visibly previewed the whole time.
  useEffect(() => {
    if (!value) onChange?.(illustratedPreview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePickStyle = (id: string) => {
    setStyleId(id);
    onChange?.(generateIllustratedAvatar(id, seed));
  };

  const handleShuffle = () => {
    const newSeed = Math.random().toString(36).slice(2, 10);
    setSeed(newSeed);
    onChange?.(generateIllustratedAvatar(styleId, newSeed));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image valide (JPG, PNG).');
      return;
    }
    if (!userId) {
      toast.error("Impossible d'identifier votre compte pour l'envoi.");
      return;
    }

    setIsUploading(true);
    try {
      const path = `${userId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      onChange?.(data.publicUrl);
      toast.success('Photo de profil mise à jour !');
    } catch (err: any) {
      toast.error(err.message || "Échec de l'envoi de la photo.");
    } finally {
      setIsUploading(false);
    }
  };

  const currentPreview = value || (mode === 'illustrated' ? illustratedPreview : undefined);

  return (
    <div className="flex flex-col items-center text-center space-y-4 py-2">
      <div className="relative">
        <CustomAvatar photoURL={currentPreview} name={name} size={96} />
        {isUploading && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}
      </div>

      {allowPhotoUpload && (
        <div className="flex gap-1 bg-muted p-1 rounded-full border border-border">
          <button
            type="button"
            onClick={() => setMode('illustrated')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${mode === 'illustrated' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}
          >
            Avatar illustré
          </button>
          <button
            type="button"
            onClick={() => setMode('photo')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${mode === 'photo' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}
          >
            Ma photo
          </button>
        </div>
      )}

      {(mode === 'illustrated' || !allowPhotoUpload) ? (
        <div className="w-full space-y-3">
          <div className="flex flex-wrap justify-center gap-2">
            {ILLUSTRATED_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handlePickStyle(s.id)}
                className={`px-2.5 py-1.5 rounded-xl text-[13px] font-bold border transition-colors cursor-pointer ${
                  styleId === s.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-foreground border-border hover:bg-muted'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <Button
            onClick={handleShuffle}
            variant="outline"
            size="sm"
            className="rounded-xl text-xs font-bold border-border text-foreground hover:bg-muted cursor-pointer flex items-center gap-1.5 mx-auto"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Essayer une autre variante</span>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            size="sm"
            disabled={isUploading}
            className="rounded-xl text-xs font-bold border-border text-foreground hover:bg-muted cursor-pointer flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isUploading ? 'Envoi en cours...' : 'Téléverser une photo'}</span>
          </Button>
          <p className="text-[13px] text-muted-foreground max-w-xs">
            Votre photo est stockée de façon sécurisée et reste associée à votre profil.
          </p>
        </div>
      )}
    </div>
  );
}
