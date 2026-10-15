import React, { useRef, useState } from 'react';
import { CustomAvatar, AvatarConfig } from './CustomAvatar';
import { EganyeIcon } from './ui/EganyeIcon';
import { EGANYE_EMOJIS, isEmojiAvatar, getEmojiAvatar, toEmojiAvatarValue } from './ui/EganyeAvatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface AvatarWorkshopProps {
  value?: AvatarConfig;
  onChange?: (value: AvatarConfig) => void;
  name?: string;
  userId?: string;
  allowPhotoUpload?: boolean;
}

export function AvatarWorkshop({
  value,
  onChange,
  name = 'Membre',
  userId,
  allowPhotoUpload = true,
}: AvatarWorkshopProps) {
  const { t } = useLanguage();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedEmoji = isEmojiAvatar(value) ? getEmojiAvatar(value) : '';
  const hasCustomPhoto =
    value &&
    !selectedEmoji &&
    (value.startsWith('http') || value.startsWith('data:') || value.startsWith('blob:'));

  const handleSelectEmoji = (emoji: string) => {
    onChange?.(toEmojiAvatarValue(emoji));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      toast.error(t('avw_invalid_image'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('avw_image_too_big'));
      return;
    }

    if (!userId) {
      // Local preview if not yet authenticated
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onChange?.(reader.result);
          toast.success(t('avw_photo_selected'));
        }
      };
      reader.readAsDataURL(file);
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const path = `${userId}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      onChange?.(data.publicUrl);
      toast.success(t('avw_photo_updated'));
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      toast.error(err.message || t('avw_upload_error'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleUseInitials = () => {
    onChange?.('');
    toast.success(t('avw_initials_restored'));
  };

  return (
    <div className="flex flex-col items-center text-center space-y-5 py-3">
      {/* Aperçu en direct */}
      <div className="relative">
        <div className="ring-4 ring-[#C96F4A]/20 dark:ring-primary/20 rounded-full p-1 bg-card shadow-soft">
          <CustomAvatar photoURL={value} name={name} size={104} />
        </div>
        {isUploading && (
          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
            <EganyeIcon name="loading" size={28} className="text-white animate-spin" />
          </div>
        )}
      </div>

      <div>
        <h3 className="text-base font-serif font-black text-foreground">
          {name}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-xs mx-auto">
          {t('avw_intro')}
        </p>
      </div>

      {/* Sélection d'un emoji */}
      <div className="w-full max-w-xs space-y-2">
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide text-left">
          {t('avw_choose_emoji')}
        </p>
        <div className="grid grid-cols-8 gap-1.5 max-h-40 overflow-y-auto pr-0.5">
          {EGANYE_EMOJIS.map((emoji) => {
            const selected = selectedEmoji === emoji;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => handleSelectEmoji(emoji)}
                aria-label={`${t('avw_choose_emoji_aria')} ${emoji}`}
                aria-pressed={selected}
                className={`aspect-square rounded-xl flex items-center justify-center text-lg cursor-pointer transition-all ${
                  selected
                    ? 'bg-[#C96F4A]/15 ring-2 ring-[#C96F4A]'
                    : 'bg-muted/60 hover:bg-muted ring-1 ring-transparent'
                }`}
              >
                <span>{emoji}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 w-full max-w-xs text-muted-foreground/60">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] font-bold uppercase tracking-wide">ou</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Boutons d'action */}
      {allowPhotoUpload && (
        <div className="w-full max-w-xs space-y-2 pt-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full rounded-2xl h-11 bg-[#C96F4A] hover:bg-[#B85C36] text-white font-bold text-xs gap-2 shadow-xs cursor-pointer"
          >
            <EganyeIcon name="camera" size={16} />
            <span>{hasCustomPhoto ? t('avw_change_photo') : t('avw_import_photo')}</span>
          </Button>

          {(hasCustomPhoto || selectedEmoji) && (
            <Button
              type="button"
              variant="outline"
              onClick={handleUseInitials}
              disabled={isUploading}
              className="w-full rounded-2xl h-10 border-[#EFE2D0] dark:border-border text-xs font-semibold text-muted-foreground hover:text-danger cursor-pointer"
            >
              <EganyeIcon name="trash" size={14} className="mr-1.5" />
              <span>{t('avw_back_to_initials')}</span>
            </Button>
          )}
        </div>
      )}

      {/* Note de réassurance */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/60 text-[11px] text-muted-foreground max-w-xs">
        <EganyeIcon name="shield" size={14} className="text-[#718A68] shrink-0" />
        <span>{t('avw_privacy_note')}</span>
      </div>
    </div>
  );
}
