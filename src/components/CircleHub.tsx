import React, { useState } from 'react';
import { Group, UserProfile } from '@/types';
import { EganyeIcon, type EganyeIconName } from '@/components/ui/EganyeIcon';
import { CreateGroupDialog } from './CreateGroupDialog';
import { EmptyState } from './ui/EmptyState';
import { TopBarAction } from './ui/TopBarAction';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMyDues } from '@/hooks/useMyDues';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { enUS, fr } from 'date-fns/locale';

interface CircleHubProps {
  user: UserProfile;
  groups: Group[];
  onSelectGroup: (id: string) => void;
  onNavigateToVerification: () => void;
  onSearch: () => void;
  onJoinByCode: (code: string) => void;
}

const CREATE_TRIGGER_ID = 'circle-hub-create-trigger';

export function CircleHub({
  user,
  groups,
  onSelectGroup,
  onNavigateToVerification,
  onSearch,
  onJoinByCode,
}: CircleHubProps) {
  const { t, language } = useLanguage();
  const locale = language === 'en' ? enUS : fr;
  const { dues } = useMyDues(user.uid, groups);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [askCode, setAskCode] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  const closeSheet = () => {
    setSheetOpen(false);
    setAskCode(false);
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim();
    if (!code) {
      toast.error(t('cir_join_empty_code_error'));
      return;
    }
    closeSheet();
    onJoinByCode(code);
  };

  // Le formulaire de création vit hors de la feuille : il doit rester monté une fois celle-ci fermée.
  const openCreate = () => {
    closeSheet();
    document.getElementById(CREATE_TRIGGER_ID)?.click();
  };

  /** Ce que le cercle attend de la personne : c'est l'information de cet écran. */
  const circleStatus = (group: Group): { label: string; tone: string } | null => {
    if (group.status === 'completed') return { label: t('cir_status_completed'), tone: 'text-muted-foreground' };
    if (group.status !== 'active') return { label: t('status_pending'), tone: 'text-muted-foreground' };
    if (dues.some((d) => d.groupId === group.id && !d.awaitingApproval)) {
      return { label: t('cir_status_to_pay'), tone: 'text-primary-ink' };
    }
    if (group.payoutOrder.indexOf(user.uid) === group.currentPayoutIndex) {
      return { label: t('cir_your_turn'), tone: 'text-secondary' };
    }
    return null;
  };

  const sheetRow = (icon: EganyeIconName, label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-h-14 flex items-center gap-3 text-left cursor-pointer transition-colors duration-150 active:bg-muted rounded-xl px-1"
    >
      <EganyeIcon name={icon} size={22} className="text-muted-foreground shrink-0" />
      <span className="flex-1 text-base font-semibold text-foreground">{label}</span>
      <EganyeIcon name="chevron-right" size={16} className="text-muted-foreground shrink-0" />
    </button>
  );

  return (
    <div className="pb-4 max-w-lg mx-auto">
      <TopBarAction>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="w-11 h-11 rounded-xl flex items-center justify-center text-primary-ink cursor-pointer transition-colors duration-150 hover:bg-muted"
          aria-label={t('cir_add_aria')}
        >
          <EganyeIcon name="plus" size={24} />
        </button>
      </TopBarAction>

      <Dialog open={sheetOpen} onOpenChange={(open) => { if (open) setSheetOpen(true); else closeSheet(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="text-lg font-bold text-foreground">{t('cir_add_title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('cir_add_title')}</DialogDescription>
          <div className="divide-y divide-border">
            {sheetRow('plus', t('cir_create_circle_cta'), openCreate)}
            {sheetRow('qr-code', t('cir_join_title'), () => setAskCode((v) => !v))}
            {askCode && (
              <form onSubmit={handleJoinSubmit} className="py-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder={t('cir_code_placeholder')}
                    className="flex-1 min-w-0 h-12 px-3.5 rounded-xl border border-input bg-card text-foreground text-base font-mono outline-none focus:border-primary-ink"
                    aria-label={t('cir_join_section_title')}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="off"
                    enterKeyHint="go"
                    autoFocus
                  />
                  <button type="submit" className="h-12 px-5 rounded-xl bg-primary text-primary-foreground font-bold text-sm cursor-pointer">
                    {t('cir_validate')}
                  </button>
                </div>
                <p className="text-[13px] text-muted-foreground">{t('cir_join_hint')}</p>
              </form>
            )}
            {sheetRow('search', t('cir_search_title'), () => { closeSheet(); onSearch(); })}
          </div>
        </DialogContent>
      </Dialog>

      <CreateGroupDialog
            onGroupCreated={onSelectGroup}
        onNavigateToVerification={onNavigateToVerification}
        triggerIsNativeButton
        trigger={<button id={CREATE_TRIGGER_ID} type="button" className="hidden" tabIndex={-1} aria-hidden="true" />}
      />

      {groups.length === 0 ? (
        <div>
          <EmptyState
            illustration="no-circles"
            title={t('no_circle_title')}
            description={t('no_circle_desc')}
            actionText={t('cir_add_title')}
            onAction={() => setSheetOpen(true)}
          />
        </div>
      ) : (
        <div className="rounded-2xl bg-card border border-border divide-y divide-border overflow-hidden">
          {groups.map((group) => {
            const status = circleStatus(group);
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => onSelectGroup(group.id)}
                className="w-full min-h-[68px] px-4 py-3 flex items-center justify-between gap-3 text-left cursor-pointer transition-colors duration-150 active:bg-muted"
              >
                <div className="min-w-0">
                  <p className="font-bold text-foreground text-[15px] truncate">
                    {group.name}
                    {group.isPrivate && <span className="ml-2 text-[13px] font-semibold text-muted-foreground">{t('cir_private_badge')}</span>}
                  </p>
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    {group.members.length} {t('dash_members_word')} · {group.contributionAmount.toLocaleString('fr-FR')} {group.currency} / {group.frequency === 'monthly' ? t('cir_per_month') : t('cir_per_cycle')}
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    {t('dash_next_prefix')} {format(new Date(group.nextPayoutDate), 'd MMM yyyy', { locale })}
                  </p>
                  {status && <p className={`mt-0.5 text-[13px] font-bold ${status.tone}`}>{status.label}</p>}
                </div>
                <EganyeIcon name="chevron-right" size={16} className="text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
