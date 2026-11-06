import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Group } from '@/types';
import {
  CalendarDays, Check, ChevronDown, ChevronRight, Copy, FileText, HandCoins, Loader2, MessageSquare, QrCode, Settings, Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { enGB, fr } from 'date-fns/locale';
import { MemberManagement } from './MemberManagement';
import { DocumentsManager } from './DocumentsManager';
import { Chat } from './Chat';
import { ContributionsManager } from './ContributionsManager';
import { CalendarView } from './CalendarView';
import { CircleHealth } from './CircleHealth';
import { AmountDisplay } from './ui/AmountDisplay';
import { supabase } from '@/lib/supabase';
import { fetchMemberProfiles } from '@/lib/members';
import { useAuthContext } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { calculateNextPayoutDate, executePayoutDisbursement, drawPayoutBeneficiary } from '@/lib/disbursements';
import { ConfirmationBottomSheet } from './ui/ConfirmationBottomSheet';
import { ScreenBar } from './ui/ScreenBar';
import QRCode from 'qrcode';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { SettingsGroup, SettingsRow } from './ui/SettingsList';
import { EditGroupDialog } from './EditGroupDialog';
import type { UserProfile } from '@/types';

interface GroupDetailsProps {
  group: Group;
  onBack: () => void;
  onNavigateToVerification?: () => void;
}

type Section = 'cotisations' | 'membres' | 'calendrier' | 'discussion' | 'documents' | 'parametres';

function NavRow({ icon: Icon, label, value, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full cursor-pointer items-center gap-3.5 px-4 text-left transition-colors duration-150 first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/50 active:bg-muted"
    >
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
      <span className="flex-1 text-[15px] font-bold text-foreground">{label}</span>
      {value !== undefined && <span className="text-sm tabular-nums text-muted-foreground">{value}</span>}
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );
}

export function GroupDetails({ group, onBack, onNavigateToVerification }: GroupDetailsProps) {
  const { profile } = useAuthContext();
  const { t, language } = useLanguage();
  const dateLocale = language === 'en' ? enGB : fr;
  const [section, setSection] = React.useState<Section | null>(null);
  // Arrivée par « Cotiser » : la déclaration s'ouvre directement.
  const [payNow, setPayNow] = React.useState(false);
  const [showMore, setShowMore] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);

  // Conformité Android / Capacitor : le retour matériel ferme d'abord le niveau du dessus.
  useBackHandler(
    React.useCallback(() => {
      if (inviteOpen) {
        setInviteOpen(false);
        return true;
      }
      if (section !== null) {
        setSection(null);
        setPayNow(false);
        return true;
      }
      onBack();
      return true;
    }, [inviteOpen, section, onBack]),
    true
  );

  const [copiedLink, setCopiedLink] = React.useState(false);
  const [copiedCode, setCopiedCode] = React.useState(false);
  const [members, setMembers] = React.useState<Record<string, UserProfile>>({});
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [isDistributing, setIsDistributing] = React.useState(false);
  const [isConfirmDistributeOpen, setIsConfirmDistributeOpen] = React.useState(false);
  const [distributeError, setDistributeError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [auctionDiscount, setAuctionDiscount] = React.useState('');
  const [treasuryBalance, setTreasuryBalance] = React.useState<number | null>(null);
  const [walletFundsEstimate, setWalletFundsEstimate] = React.useState(0);
  const [myContributed, setMyContributed] = React.useState<number | null>(null);
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  // De l'argent a-t-il déjà circulé ? Décide si le cercle se modifie en entier
  // et se supprime, ou seulement son nom (même règle que la migration 0029).
  const [moneyMoved, setMoneyMoved] = React.useState(true);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const isCreator = profile?.uid === group.creatorId;
  const isAdmin = profile?.role === 'admin';
  const canManage = isCreator || isAdmin;

  React.useEffect(() => {
    const fetchMembers = async () => {
      if (group.members.length === 0) {
        setMembers({});
        return;
      }
      const list = await fetchMemberProfiles(group.members);
      const entries: Record<string, UserProfile> = {};
      for (const member of list) entries[member.uid] = member;
      setMembers(entries);
    };
    fetchMembers();
  }, [group.members]);

  // Lecture pour l'affichage seulement : le pot qui compte est celui du grand livre,
  // que le serveur vérifie au moment de distribuer (migration 0038).
  React.useEffect(() => {
    const fetchTreasury = async () => {
      const [{ data: contribRows, error: contribError }, { data: payoutRows, error: payoutError }] = await Promise.all([
        supabase.from('contributions').select('amount, status, payment_method').eq('group_id', group.id),
        supabase.from('payouts').select('amount').eq('group_id', group.id),
      ]);
      // Échec de lecture : on garde les chiffres précédents plutôt que de
      // conclure à tort que « aucun argent n'a circulé ».
      if (contribError || payoutError) return;
      const paid = (contribRows ?? []).filter((c) => c.status === 'paid');
      const collected = paid.reduce((sum, c) => sum + Number(c.amount), 0);
      const fromWallets = paid.filter((c) => c.payment_method !== 'cash').reduce((sum, c) => sum + Number(c.amount), 0);
      const distributed = (payoutRows ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
      setTreasuryBalance(collected - distributed);
      setWalletFundsEstimate(Math.max(0, fromWallets - distributed));
      setMoneyMoved(paid.length > 0 || (payoutRows ?? []).length > 0);
    };
    fetchTreasury();
    // Relu au retour sur l'accueil de la fiche : un paiement ou une
    // distribution fait dans une sous-section change ces chiffres.
  }, [group.id, section, refreshKey]);

  React.useEffect(() => {
    if (!profile) return;
    const fetchMine = async () => {
      const { data, error } = await supabase
        .from('contributions')
        .select('amount, status')
        .eq('group_id', group.id)
        .eq('user_id', profile.uid);
      if (error) return;
      const total = (data ?? [])
        .filter((c) => c.status === 'paid')
        .reduce((sum, c) => sum + Number(c.amount), 0);
      setMyContributed(total);
    };
    fetchMine();
  }, [group.id, profile?.uid, section]);

  // Génération locale du QR code (plus de dépendance à api.qrserver.com,
  // qui exposait le lien d'invitation à un tiers et ne fonctionnait pas hors-ligne).
  React.useEffect(() => {
    if (!group.joinCode) return;
    QRCode.toDataURL(`${window.location.origin}/?join=${group.joinCode}`, {
      width: 180,
      margin: 1,
      color: { dark: '#2B2622', light: '#00000000' },
    })
      .then(setQrDataUrl)
      .catch((err) => console.error('QR code generation failed:', err));
  }, [group.joinCode]);

  const memberName = (uid: string) => members[uid]?.displayName || `${t('member')} ${uid.slice(0, 6)}`;

  const scheduledBeneficiaryId = group.payoutOrder[group.currentPayoutIndex];
  const totalPot = group.contributionAmount * group.members.length;
  const myPositionIdx = profile ? group.payoutOrder.indexOf(profile.uid) : -1;

  const collected = Math.max(0, treasuryBalance ?? 0);
  const potMissing = Math.max(0, totalPot - collected);
  const potProgress = totalPot > 0 ? Math.min(100, Math.round((collected / totalPot) * 100)) : 0;
  // Comme le serveur : la part en espèces est ce que les portefeuilles ne couvrent pas.
  const cashPart = potMissing === 0 ? Math.max(0, totalPot - walletFundsEstimate) : 0;

  const handleDraw = async () => {
    if (!navigator.onLine) {
      toast.error(t('gd_offline_draw_error'));
      return;
    }
    setIsDrawing(true);
    try {
      const result = await drawPayoutBeneficiary(group.id);
      if (!result.success) throw new Error(result.message);
      // The realtime `groups` subscription (useGroups) refetches and updates
      // `group.drawnBeneficiaryId` — no local state to set here.
    } catch (error: any) {
      toast.error(error.message || t('gd_draw_error_generic'));
    } finally {
      setIsDrawing(false);
    }
  };

  const beneficiaryToDistribute = group.distributionMethod === 'draw' ? group.drawnBeneficiaryId : scheduledBeneficiaryId;

  const handleConfirmDistribution = async () => {
    if (!profile || !beneficiaryToDistribute) return;
    if (!navigator.onLine) {
      toast.error(t('gd_offline_distribute_error'));
      return;
    }
    setIsDistributing(true);
    setDistributeError(null);
    try {
      const result = await executePayoutDisbursement({
        groupId: group.id,
        beneficiaryId: beneficiaryToDistribute,
        discountAmount: group.distributionMethod === 'auction' ? (Number(auctionDiscount) || 0) : 0,
        adminUserId: profile.uid
      });
      if (!result.success) {
        throw new Error(result.message);
      }
      toast.success(result.message);
      const handedInCash = Number((result as { cashPart?: number }).cashPart ?? 0);
      if (handedInCash > 0) {
        toast.info(`${handedInCash.toLocaleString()} ${group.currency} ${t('cir_pot_cash_suffix')}`);
      }
      setAuctionDiscount('');
      setRefreshKey((key) => key + 1);
    } catch (error: any) {
      console.error('Distribution error:', error);
      // Le message du serveur reste affiché : il dit ce qui manque.
      setDistributeError(error.message || t('gd_distribute_error_generic'));
    } finally {
      setIsDistributing(false);
      setIsConfirmDistributeOpen(false);
    }
  };

  const handleCompleteGroup = async () => {
    if (!canManage) return;

    setIsCompleting(true);
    try {
      const { error } = await supabase.from('groups').update({ status: 'completed' }).eq('id', group.id);
      if (error) throw error;
      toast.success(t('gd_group_completed_toast'));
    } catch (error) {
      console.error("Error completing group:", error);
      toast.error(t('gd_complete_error_generic'));
    } finally {
      setIsCompleting(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!isCreator && !isAdmin) return;
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.from('groups').delete().eq('id', group.id).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error(t('gd_delete_refused'));
      toast.success(t('gd_delete_done'));
      setIsDeleteOpen(false);
      onBack();
    } catch (error: any) {
      console.error('Error deleting group:', error);
      toast.error(error?.message || t('gd_delete_refused'));
    } finally {
      setIsDeleting(false);
    }
  };

  const closeSection = () => {
    setSection(null);
    setPayNow(false);
  };

  /* -------------------------------------------------------------------- */
  /* Discussion : tout l'écran, par-dessus les barres de navigation.        */
  /* -------------------------------------------------------------------- */
  if (section === 'discussion') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background pt-[env(safe-area-inset-top)]">
        <div className="shrink-0 border-b border-border bg-card px-4 py-1">
          <ScreenBar title={group.name} onBack={closeSection} />
        </div>
        {profile && (
          <Chat
            groupId={group.id}
            user={profile}
            groupName={group.name}
            creatorId={group.creatorId}
          />
        )}
      </div>
    );
  }

  /* -------------------------------------------------------------------- */
  /* Cotisations et tours                                                   */
  /* -------------------------------------------------------------------- */
  if (section === 'cotisations') {
    // Les dates à venir se déduisent du prochain versement et du rythme.
    const turnDates: string[] = [];
    let cursor = group.nextPayoutDate;
    for (let idx = group.currentPayoutIndex; idx < group.payoutOrder.length; idx += 1) {
      turnDates[idx] = cursor;
      cursor = calculateNextPayoutDate(cursor, group.frequency);
    }

    const contributionsList = profile && (
      <ContributionsManager
        group={group}
        user={profile}
        onBack={closeSection}
        onNavigateToVerification={onNavigateToVerification}
        embedded
        autoDeclare={payNow}
      />
    );

    const turns = (
      <section className="space-y-2">
        <h2 className="px-1 text-sm font-bold text-foreground">{t('gd_soft_who_receives')}</h2>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {/* Le pot du tour en cours : réuni ou non, en espèces ou non, avant le bouton. */}
          <div className="space-y-3 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] text-muted-foreground">
                {t('cir_pot_title')} · {t('gd_tour_word')} {group.currentPayoutIndex + 1} / {group.members.length}
              </p>
              <p className="text-[15px] font-bold tabular-nums text-foreground">{totalPot.toLocaleString()} {group.currency}</p>
            </div>

            <div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={potProgress} aria-valuemin={0} aria-valuemax={100} aria-label={t('cir_pot_collected')}>
                <div className="h-full rounded-full bg-secondary transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${potProgress}%` }} />
              </div>
              <p className="mt-1.5 text-[13px] text-foreground">
                {t('cir_pot_collected')} : <span className="font-bold tabular-nums">{collected.toLocaleString()} {group.currency}</span>
                {potMissing > 0 && <> · {t('cir_pot_missing')} <span className="font-bold tabular-nums">{potMissing.toLocaleString()} {group.currency}</span></>}
              </p>
              {potMissing > 0 && <p className="text-[13px] text-muted-foreground">{t('cir_pot_missing_hint')}</p>}
              {cashPart > 0 && (
                <p className="text-[13px] text-muted-foreground">
                  {t('cir_pot_cash_prefix')} {cashPart.toLocaleString()} {group.currency} {t('cir_pot_cash_suffix')}
                </p>
              )}
            </div>

            {distributeError && (
              <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-[13px] font-bold text-danger">{distributeError}</p>
            )}

            {group.distributionMethod === 'auction' && canManage && group.status === 'active' && beneficiaryToDistribute && (
              <div className="space-y-1.5">
                <Label htmlFor="auction_discount" className="text-[13px] font-bold text-foreground">
                  {t('gd_auction_discount_label')}
                </Label>
                <Input
                  id="auction_discount"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="0"
                  value={auctionDiscount}
                  onChange={(e) => setAuctionDiscount(e.target.value)}
                  className="h-11 rounded-xl text-base"
                />
                <p className="text-[13px] text-muted-foreground">{t('gd_auction_discount_desc')}</p>
              </div>
            )}

            {!beneficiaryToDistribute && (
              <div className="space-y-2">
                <p className="text-sm font-bold text-foreground">{t('gd_draw_required_title')}</p>
                <p className="text-[13px] text-muted-foreground">{t('gd_no_beneficiary_desc')}</p>
                {canManage && (
                  <Button onClick={handleDraw} disabled={isDrawing} className="h-12 w-full cursor-pointer rounded-xl font-bold">
                    {isDrawing ? t('gd_drawing_in_progress') : t('gd_draw_button')}
                  </Button>
                )}
              </div>
            )}

            {canManage && group.status === 'active' && beneficiaryToDistribute && (
              <Button
                onClick={() => setIsConfirmDistributeOpen(true)}
                variant={potMissing > 0 ? 'outline' : 'default'}
                className="h-12 w-full cursor-pointer rounded-xl font-bold"
              >
                {t('gd_distribute_funds_button')}
              </Button>
            )}
          </div>

          <ul className="divide-y divide-border">
            {group.payoutOrder.map((memberId, idx) => {
              const isPast = idx < group.currentPayoutIndex;
              const isCurrent = idx === group.currentPayoutIndex;
              return (
                <li key={memberId} className="flex min-h-12 items-center gap-3 px-4 py-2.5">
                  <span className={`w-6 shrink-0 text-center text-[13px] font-bold tabular-nums ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {idx + 1}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-sm ${isCurrent ? 'font-bold text-foreground' : isPast ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {memberName(memberId)}
                  </span>
                  <span className={`shrink-0 text-[13px] font-bold ${isPast ? 'text-secondary' : isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {isPast
                      ? t('cir_turn_received')
                      : turnDates[idx] ? format(new Date(turnDates[idx]), 'd MMM yyyy', { locale: dateLocale }) : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    );

    return (
      <div className="space-y-5">
        <ScreenBar title={t('gd_nav_cotisations')} onBack={closeSection} />

        {canManage ? <>{turns}{contributionsList}</> : <>{contributionsList}{turns}</>}

        <ConfirmationBottomSheet
          isOpen={isConfirmDistributeOpen}
          onClose={() => setIsConfirmDistributeOpen(false)}
          onConfirm={handleConfirmDistribution}
          title={t('gd_confirm_distribution_title')}
          description={beneficiaryToDistribute ? `${t('gd_distribute_desc_prefix')} ${totalPot.toLocaleString()} ${group.currency} ${t('gd_distribute_desc_to')} ${memberName(beneficiaryToDistribute)} ${t('gd_distribute_desc_for_cycle')} ${group.currentPayoutIndex + 1}. ${t('gd_action_irreversible')}` : ''}
          amount={totalPot}
          currency={group.currency}
          type="generic"
          isLoading={isDistributing}
        />
      </div>
    );
  }

  /* -------------------------------------------------------------------- */
  /* Membres                                                                */
  /* -------------------------------------------------------------------- */
  if (section === 'membres') {
    const inviteUrl = `${window.location.origin}/?join=${group.joinCode}`;
    return (
      <div className="space-y-5">
        <ScreenBar title={t('gd_nav_membres')} onBack={closeSection} />

        {profile && <MemberManagement group={group} currentUserId={profile.uid} canManage={canManage} />}

        <Button onClick={() => setInviteOpen(true)} className="h-12 w-full cursor-pointer rounded-xl font-bold">
          {t('cir_invite')}
        </Button>

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent className="gap-3">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">{t('gd_soft_invite_title')}</DialogTitle>
              <DialogDescription>{t('gd_soft_invite_desc')}</DialogDescription>
            </DialogHeader>

            <button
              type="button"
              onClick={() => {
                if (!group.joinCode) return;
                navigator.clipboard.writeText(group.joinCode);
                setCopiedCode(true);
                toast.success(t('gd_code_copied_toast'));
                setTimeout(() => setCopiedCode(false), 2000);
              }}
              aria-label={t('gd_copy_code_title')}
              className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/70"
            >
              <span>
                <span className="block text-[13px] text-muted-foreground">{t('gd_unique_code_label')}</span>
                <span className="block font-mono text-2xl font-bold tracking-[0.2em] text-foreground">{group.joinCode}</span>
              </span>
              {copiedCode ? <Check className="h-5 w-5 shrink-0 text-secondary" /> : <Copy className="h-5 w-5 shrink-0 text-muted-foreground" />}
            </button>

            <Button
              className="h-12 w-full cursor-pointer rounded-xl font-bold"
              onClick={() => {
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`${t('gd_whatsapp_share_text')} ${inviteUrl}`)}`, '_blank');
              }}
            >
              WhatsApp
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full cursor-pointer gap-2 rounded-xl font-bold"
              onClick={() => {
                navigator.clipboard.writeText(inviteUrl);
                setCopiedLink(true);
                toast.success(t('gd_invite_link_copied_toast'));
                setTimeout(() => setCopiedLink(false), 2000);
              }}
            >
              {copiedLink ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              {copiedLink ? t('gd_copied_label') : t('gd_soft_copy_link')}
            </Button>

            <details>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-1.5 text-[13px] font-bold text-muted-foreground">
                <QrCode className="h-4 w-4" />
                {t('gd_soft_show_qr')}
              </summary>
              <div className="flex flex-col items-center gap-2 pt-2">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt={t('gd_qr_code_alt')} className="h-40 w-40 rounded-xl bg-white p-2" />
                ) : (
                  <div className="flex h-40 w-40 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                <span className="text-[13px] text-muted-foreground">{t('gd_scan_to_join')}</span>
              </div>
            </details>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (section === 'calendrier') {
    return (
      <div className="space-y-5">
        <ScreenBar title={t('calendar')} onBack={closeSection} />
        <CalendarView groups={[group]} onSelectGroup={() => {}} />
      </div>
    );
  }

  if (section === 'documents') {
    return (
      <div className="space-y-5">
        <ScreenBar title={t('gd_nav_documents')} onBack={closeSection} />
        {profile && <DocumentsManager group={group} user={profile} />}
      </div>
    );
  }

  if (section === 'parametres') {
    return (
      <div className="space-y-5">
        <ScreenBar title={t('gd_nav_parametres')} onBack={closeSection} />

        <SettingsGroup title={t('gd_soft_rules_title')}>
          <SettingsRow
            icon="cotisation"
            tone="sage"
            label={t('gd_soft_per_member')}
            value={`${group.contributionAmount.toLocaleString()} ${group.currency}`}
          />
          <SettingsRow icon="calendar-finance" tone="gold" label={t('frequency')} value={t(`freq_${group.frequency}`)} />
          <SettingsRow
            icon="distribution"
            tone="brand"
            label={t('gd_soft_who_receives')}
            value={t(`cgd_dist_${group.distributionMethod || 'sequential'}`)}
          />
          <SettingsRow icon="members" tone="sand" label={t('gd_soft_places')} value={group.maxMembers ?? group.members.length} />
          <SettingsRow
            icon="lock"
            tone="info"
            label={t('gd_soft_access')}
            value={group.isPrivate === false ? t('gd_public') : t('gd_private')}
          />
        </SettingsGroup>

        {(group.description || group.rules) && (
          <SettingsGroup title={t('gd_circle_rules_title')}>
            {group.description && <p className="px-4 py-3.5 text-sm text-muted-foreground">{group.description}</p>}
            {group.rules && <p className="whitespace-pre-line px-4 py-3.5 text-sm text-muted-foreground">{group.rules}</p>}
          </SettingsGroup>
        )}

        {canManage && (
          <SettingsGroup title={t('gd_soft_manage_title')}>
            {group.status === 'active' && (
              <SettingsRow
                icon="settings"
                tone="brand"
                label={t('gd_edit_circle')}
                hint={moneyMoved ? t('gd_edit_hint_locked') : t('gd_edit_hint_free')}
                onClick={() => setIsEditOpen(true)}
              />
            )}
            {group.status === 'active' && (
              <SettingsRow
                icon="completed"
                tone="sage"
                label={isCompleting ? t('gd_soft_closing') : t('gd_mark_completed')}
                hint={t('gd_close_hint')}
                onClick={isCompleting ? undefined : handleCompleteGroup}
              />
            )}
            {!moneyMoved ? (
              <SettingsRow
                icon="close"
                danger
                label={t('gd_delete_circle')}
                hint={t('gd_delete_hint')}
                onClick={() => setIsDeleteOpen(true)}
              />
            ) : (
              <SettingsRow icon="info" tone="muted" label={t('gd_delete_circle')} hint={t('gd_delete_locked_hint')} />
            )}
          </SettingsGroup>
        )}

        <EditGroupDialog group={group} moneyMoved={moneyMoved} open={isEditOpen} onOpenChange={setIsEditOpen} />

        <ConfirmationBottomSheet
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={handleDeleteGroup}
          title={t('gd_delete_confirm_title')}
          description={`« ${group.name} » ${t('gd_delete_confirm_desc')}`}
          type="destructive"
          confirmLabel={t('gd_delete_circle')}
          isLoading={isDeleting}
        />
      </div>
    );
  }

  /* -------------------------------------------------------------------- */
  /* Écran principal : combien, quand, mon tour. Le reste à un toucher.     */
  /* -------------------------------------------------------------------- */
  const daysRemaining = Math.max(0, Math.ceil((new Date(group.nextPayoutDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="space-y-5 pb-16">
      <ScreenBar title={group.name} onBack={onBack} />

      <CircleHealth groupId={group.id} />

      {group.status === 'active' ? (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <p className="text-[13px] text-muted-foreground">
            {t('gd_next_contribution')} · {t('gd_in_prefix')} {daysRemaining} {daysRemaining > 1 ? t('gd_days') : t('gd_day')}
          </p>
          <div>
            <AmountDisplay amount={group.contributionAmount} currency={group.currency} size="lg" />
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {t('dash_due_prefix')} {format(new Date(group.nextPayoutDate), 'dd MMMM yyyy', { locale: dateLocale })}
            </p>
          </div>
          <Button
            onClick={() => {
              setPayNow(true);
              setSection('cotisations');
            }}
            className="h-12 w-full cursor-pointer rounded-xl font-bold"
          >
            {t('dash_contribute_cta')}
          </Button>
        </section>
      ) : (
        <p className="rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-bold text-foreground">{t('gd_status_finished')}</p>
      )}

      <p className="px-1 text-sm text-foreground">
        {t('gd_my_total')} : <span className="font-bold tabular-nums">{(myContributed ?? 0).toLocaleString()} {group.currency}</span>
        {myPositionIdx >= 0 && <> · {t('gd_cycle_position')} : <span className="font-bold tabular-nums">{myPositionIdx + 1} {t('gd_out_of')} {group.members.length}</span></>}
      </p>

      <nav className="divide-y divide-border rounded-2xl border border-border bg-card" aria-label={group.name}>
        <NavRow icon={HandCoins} label={t('gd_nav_cotisations')} onClick={() => setSection('cotisations')} />
        <NavRow icon={Users} label={t('gd_nav_membres')} value={group.members.length} onClick={() => setSection('membres')} />
        <NavRow icon={MessageSquare} label={t('gd_nav_discussion')} onClick={() => setSection('discussion')} />
        <button
          type="button"
          onClick={() => setShowMore((value) => !value)}
          aria-expanded={showMore}
          className="flex min-h-12 w-full cursor-pointer items-center justify-between px-4 text-left text-[13px] font-bold text-muted-foreground last:rounded-b-2xl"
        >
          {t('cir_more')}
          <ChevronDown className={`h-5 w-5 transition-transform duration-200 motion-reduce:transition-none ${showMore ? 'rotate-180' : ''}`} />
        </button>
        {showMore && (
          <>
            <NavRow icon={CalendarDays} label={t('calendar')} onClick={() => setSection('calendrier')} />
            <NavRow icon={FileText} label={t('gd_nav_documents')} onClick={() => setSection('documents')} />
            <NavRow icon={Settings} label={t('gd_nav_parametres')} onClick={() => setSection('parametres')} />
          </>
        )}
      </nav>
    </div>
  );
}
