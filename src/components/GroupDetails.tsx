import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Group, UserProfile } from '@/types';
import {
  ArrowLeft, Clock, CheckCircle, MessageSquare, Loader2, QrCode, Copy, ExternalLink, Check,
  Shuffle, Gift, Trophy, RotateCcw, Landmark, Circle, ChevronRight, Users, FileText, Settings,
  CalendarDays,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MemberManagement } from './MemberManagement';
import { DocumentsManager } from './DocumentsManager';
import { Chat } from './Chat';
import { ContributionsManager } from './ContributionsManager';
import { CalendarView } from './CalendarView';
import { AmountDisplay } from './ui/AmountDisplay';
import { supabase } from '@/lib/supabase';
import { fetchMemberProfiles } from '@/lib/members';
import { useAuthContext } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { executePayoutDisbursement, drawPayoutBeneficiary } from '@/lib/disbursements';
import { ConfirmationBottomSheet } from './ui/ConfirmationBottomSheet';
import { MemberCard } from './ui/MemberCard';
import { StatusBadge } from './ui/StatusBadge';
import { EganyeIcon, type EganyeIconName } from './ui/EganyeIcon';
import QRCode from 'qrcode';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { SettingsGroup, SettingsRow } from './ui/SettingsList';
import { EditGroupDialog } from './EditGroupDialog';

interface GroupDetailsProps {
  group: Group;
  onBack: () => void;
  onNavigateToVerification?: () => void;
}

type Section = 'cotisations' | 'membres' | 'calendrier' | 'discussion' | 'documents' | 'parametres';

export function GroupDetails({ group, onBack, onNavigateToVerification }: GroupDetailsProps) {
  const { profile } = useAuthContext();
  const { t } = useLanguage();
  const [section, setSection] = React.useState<Section | null>(null);
  const [isCompleting, setIsCompleting] = React.useState(false);

  // Conformité Android / Capacitor : le retour matériel ferme d'abord la sous-section
  useBackHandler(
    React.useCallback(() => {
      if (section !== null) {
        setSection(null);
        return true;
      }
      onBack();
      return true;
    }, [section, onBack]),
    true
  );
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [copiedCode, setCopiedCode] = React.useState(false);
  const [members, setMembers] = React.useState<Record<string, UserProfile>>({});
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [isDistributing, setIsDistributing] = React.useState(false);
  const [isConfirmDistributeOpen, setIsConfirmDistributeOpen] = React.useState(false);
  const [auctionDiscount, setAuctionDiscount] = React.useState('');
  const [treasuryBalance, setTreasuryBalance] = React.useState<number | null>(null);
  const [myContributed, setMyContributed] = React.useState<number | null>(null);
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  // De l'argent a-t-il déjà circulé ? Décide si le cercle se modifie en entier
  // et se supprime, ou seulement son nom (même règle que la migration 0029).
  const [moneyMoved, setMoneyMoved] = React.useState(true);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
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

  // Caisse réelle = cotisations payées - montants déjà distribués, calculée
  // de la même façon que ContributionsManager.tsx (évite d'afficher deux
  // chiffres différents pour "l'argent dans la caisse" selon l'écran).
  React.useEffect(() => {
    const fetchTreasury = async () => {
      const [{ data: contribRows }, { data: payoutRows }] = await Promise.all([
        supabase.from('contributions').select('amount, status').eq('group_id', group.id),
        supabase.from('payouts').select('amount').eq('group_id', group.id),
      ]);
      const collected = (contribRows ?? [])
        .filter((c) => c.status === 'paid')
        .reduce((sum, c) => sum + Number(c.amount), 0);
      const distributed = (payoutRows ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
      setTreasuryBalance(collected - distributed);
      setMoneyMoved(
        (contribRows ?? []).some((c) => c.status === 'paid') || (payoutRows ?? []).length > 0
      );
    };
    fetchTreasury();
  }, [group.id]);

  // "Ma situation" — ce que CETTE personne a cotisé dans CE cercle, pour la
  // carte résumé de l'accueil de la fiche (brief : "35 000 FCFA cotisés").
  React.useEffect(() => {
    if (!profile) return;
    const fetchMine = async () => {
      const { data } = await supabase
        .from('contributions')
        .select('amount, status')
        .eq('group_id', group.id)
        .eq('user_id', profile.uid);
      const total = (data ?? [])
        .filter((c) => c.status === 'paid')
        .reduce((sum, c) => sum + Number(c.amount), 0);
      setMyContributed(total);
    };
    fetchMine();
  }, [group.id, profile?.uid]);

  // Génération locale du QR code (plus de dépendance à api.qrserver.com,
  // qui exposait le lien d'invitation à un tiers et ne fonctionnait pas hors-ligne).
  React.useEffect(() => {
    if (!group.joinCode) return;
    QRCode.toDataURL(`${window.location.origin}/?join=${group.joinCode}`, {
      width: 180,
      margin: 1,
      color: { dark: '#4B2E05', light: '#00000000' },
    })
      .then(setQrDataUrl)
      .catch((err) => console.error('QR code generation failed:', err));
  }, [group.joinCode]);

  const memberName = (uid: string) => members[uid]?.displayName || `${t('member')} ${uid.slice(0, 6)}`;

  const scheduledBeneficiaryId = group.payoutOrder[group.currentPayoutIndex];
  const totalPot = group.contributionAmount * group.members.length;
  const myPositionIdx = profile ? group.payoutOrder.indexOf(profile.uid) : -1;

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
      setAuctionDiscount('');
    } catch (error: any) {
      console.error('Distribution error:', error);
      toast.error(error.message || t('gd_distribute_error_generic'));
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

  /* -------------------------------------------------------------------- */
  /* Sous-écrans — un lien secondaire = un composant existant, pas de      */
  /* nouvelle logique métier. */
  /* -------------------------------------------------------------------- */

  const sectionHeader = (title: string) => (
    <div className="flex items-center gap-3 mb-1">
      <Button variant="ghost" size="icon" onClick={() => setSection(null)} className="rounded-xl shrink-0 cursor-pointer">
        <ArrowLeft className="w-4 h-4" />
      </Button>
      <h2 className="text-lg font-serif font-black text-foreground">{title}</h2>
    </div>
  );

  if (section === 'cotisations') {
    return (
      <div className="space-y-5">
        {sectionHeader(t('gd_nav_cotisations'))}

        {/* La caisse en quatre lignes lisibles, au lieu d'une grille de chiffres */}
        <SettingsGroup title={t('gd_soft_cash_title')}>
          <SettingsRow
            icon="vault"
            tone="brand"
            label={t('gd_soft_in_cash')}
            hint={t('gd_soft_in_cash_hint')}
            value={`${treasuryBalance !== null ? treasuryBalance.toLocaleString() : '…'} ${group.currency}`}
          />
          <SettingsRow
            icon="cotisation"
            tone="sage"
            label={t('gd_soft_per_member')}
            value={`${group.contributionAmount.toLocaleString()} ${group.currency}`}
          />
          <SettingsRow
            icon="members"
            tone="sand"
            label={t('gd_soft_members')}
            value={group.members.length}
          />
          <SettingsRow
            icon="gift"
            tone="gold"
            label={t('gd_soft_pot')}
            hint={t('gd_soft_pot_hint')}
            value={`${totalPot.toLocaleString()} ${group.currency}`}
          />
        </SettingsGroup>

        {/* Qui reçoit quand ? */}
        <Card className="glass-card rounded-3xl overflow-hidden border border-border/80 shadow-soft">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center gap-3">
              <CardTitle className="text-base font-serif font-bold">
                {t('gd_soft_who_receives')}
              </CardTitle>
              <span className="text-[13px] font-bold text-muted-foreground shrink-0">
                {t('gd_tour_word')} {group.currentPayoutIndex + 1} / {group.members.length}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            {beneficiaryToDistribute ? (
              <div className="gradient-sunset p-4 rounded-2xl text-white shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="space-y-0.5">
                  <span className="text-[13px] font-bold uppercase tracking-wider text-white/80 flex items-center gap-1">
                    <Trophy className="w-3 h-3" /> {t('gd_next_beneficiary_label')} ({t('gd_tour_word')} {group.currentPayoutIndex + 1})
                  </span>
                  <h4 className="text-lg font-serif font-black">{memberName(beneficiaryToDistribute)}</h4>
                  <p className="text-xs text-white/90">
                    {t('gd_date_label')} {format(new Date(group.nextPayoutDate), 'dd MMMM yyyy', { locale: fr })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[13px] font-bold uppercase tracking-wider text-white/80">{t('gd_net_amount_label')}</span>
                  <AmountDisplay amount={totalPot} currency={group.currency} size="lg" className="text-white" currencyClassName="text-white/80" />
                </div>
              </div>
            ) : (
              <div className="bg-muted p-4 rounded-2xl border border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="space-y-0.5">
                  <span className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t('gd_tour_word')} {group.currentPayoutIndex + 1}
                  </span>
                  <h4 className="text-sm font-bold text-foreground">{t('gd_draw_required_title')}</h4>
                  <p className="text-xs text-muted-foreground">{t('gd_no_beneficiary_desc')}</p>
                </div>
                {canManage && (
                  <Button onClick={handleDraw} disabled={isDrawing} className="shrink-0 rounded-xl cursor-pointer">
                    <Shuffle className="w-4 h-4 mr-2" />
                    {isDrawing ? t('gd_drawing_in_progress') : t('gd_draw_button')}
                  </Button>
                )}
              </div>
            )}

            {canManage && group.status === 'active' && beneficiaryToDistribute && (
              <div className="bg-card p-4 rounded-2xl border border-border space-y-3">
                {group.distributionMethod === 'auction' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="auction_discount" className="text-xs font-bold text-foreground">
                      {t('gd_auction_discount_label')}
                    </Label>
                    <Input
                      id="auction_discount"
                      type="number"
                      min={0}
                      placeholder="0"
                      value={auctionDiscount}
                      onChange={(e) => setAuctionDiscount(e.target.value)}
                      className="rounded-xl h-11"
                    />
                    <p className="text-[13px] text-muted-foreground">{t('gd_auction_discount_desc')}</p>
                  </div>
                )}
                <Button
                  onClick={() => setIsConfirmDistributeOpen(true)}
                  className="btn-shine w-full gradient-sunset text-white font-bold rounded-xl h-11 cursor-pointer"
                >
                  <Gift className="w-4 h-4 mr-2" />
                  {t('gd_distribute_funds_button')}
                </Button>
              </div>
            )}

            <div className="space-y-2 pt-2">
              {group.payoutOrder.map((memberId, idx) => {
                const isPast = idx < group.currentPayoutIndex;
                const isCurrent = idx === group.currentPayoutIndex;
                return (
                  <div
                    key={memberId}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-primary/10 border-primary/40 shadow-xs'
                        : isPast
                        ? 'bg-muted/30 border-border/40 opacity-70'
                        : 'bg-card border-border/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                        isCurrent
                          ? 'bg-primary text-primary-foreground'
                          : isPast
                          ? 'bg-success-soft text-secondary'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        #{idx + 1}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          {memberName(memberId)}
                          {isCurrent && <Badge className="bg-primary text-white text-[12px] px-1.5 py-0">{t('status_active')}</Badge>}
                        </p>
                        <p className="text-[13px] text-muted-foreground">
                          {isPast ? t('gd_payout_done_label') : isCurrent ? t('gd_current_turn_label') : t('gd_upcoming_label')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-foreground">
                        {totalPot.toLocaleString()} {group.currency}
                      </span>
                      <span className={`flex items-center justify-end gap-1 text-[13px] font-bold ${
                        isPast ? 'text-secondary' : isCurrent ? 'text-primary' : 'text-muted-foreground'
                      }`}>
                        {isPast ? <CheckCircle className="w-3 h-3" /> : isCurrent ? <Clock className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                        {isPast ? t('status_paid') : isCurrent ? t('gd_next_short_label') : t('gd_waiting_short_label')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {profile && (
          <ContributionsManager
            group={group}
            user={profile}
            onBack={() => setSection(null)}
            onNavigateToVerification={onNavigateToVerification}
          />
        )}

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

  if (section === 'membres') {
    return (
      <div className="space-y-5">
        {sectionHeader(t('gd_nav_membres'))}

        {/* Inviter : le code, WhatsApp, le lien, et le QR code sur demande */}
        <div className="bg-white dark:bg-card rounded-3xl border border-[#EFE2D0] dark:border-border/80 shadow-soft p-5 space-y-4">
          <div className="space-y-1">
            <h3 className="font-serif text-lg font-black text-foreground">{t('gd_soft_invite_title')}</h3>
            <p className="text-[13px] text-muted-foreground">{t('gd_soft_invite_desc')}</p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!group.joinCode) return;
              navigator.clipboard.writeText(group.joinCode);
              setCopiedCode(true);
              toast.success(t('gd_code_copied_toast'));
              setTimeout(() => setCopiedCode(false), 2000);
            }}
            className="w-full flex items-center justify-between gap-3 rounded-2xl bg-muted/50 border border-border px-4 py-3 cursor-pointer hover:bg-muted transition-colors"
            title={t('gd_copy_code_title')}
          >
            <span className="text-left">
              <span className="block text-[13px] text-muted-foreground">{t('gd_unique_code_label')}</span>
              <span className="block font-mono text-2xl font-black tracking-[0.2em] text-foreground">{group.joinCode}</span>
            </span>
            {copiedCode ? <Check className="w-5 h-5 text-secondary shrink-0" /> : <Copy className="w-5 h-5 text-muted-foreground shrink-0" />}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              className="h-12 rounded-full bg-[#25D366] hover:bg-[#20BE5B] text-white font-bold cursor-pointer"
              onClick={() => {
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`${t('gd_whatsapp_share_text')} ${window.location.origin}/?join=${group.joinCode}`)}`, '_blank');
              }}
            >
              WhatsApp
            </Button>
            <Button
              variant="outline"
              className="h-12 rounded-full font-bold cursor-pointer"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/?join=${group.joinCode}`);
                setCopiedLink(true);
                toast.success(t('gd_invite_link_copied_toast'));
                setTimeout(() => setCopiedLink(false), 2000);
              }}
            >
              {copiedLink ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
              {copiedLink ? t('gd_copied_label') : t('gd_soft_copy_link')}
            </Button>
          </div>

          <details className="group/qr">
            <summary className="list-none flex items-center justify-center gap-1.5 text-[13px] font-bold text-muted-foreground cursor-pointer hover:text-foreground">
              <QrCode className="w-4 h-4" />
              {t('gd_soft_show_qr')}
            </summary>
            <div className="flex flex-col items-center gap-2 pt-4">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={t('gd_qr_code_alt')} className="w-40 h-40 rounded-xl border border-border bg-white p-2" />
              ) : (
                <div className="w-40 h-40 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
              <span className="text-[13px] text-muted-foreground">{t('gd_scan_to_join')}</span>
            </div>
          </details>
        </div>

        {group.members.length > 1 && (
          <Card className="glass-card rounded-2xl overflow-hidden shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-serif">
                {t('gd_soft_reliability_title')}
              </CardTitle>
              <CardDescription>{t('gd_soft_reliability_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {[...group.members]
                .sort((a, b) => (members[b]?.reputationScore || 0) - (members[a]?.reputationScore || 0))
                .map((uid, index) => (
                  <div key={uid} className="flex items-center gap-2">
                    <span className={`w-6 shrink-0 text-center text-xs font-black ${index === 0 ? 'text-brand' : 'text-muted-foreground'}`}>#{index + 1}</span>
                    <MemberCard
                      className="flex-1"
                      avatarUrl={members[uid]?.photoURL}
                      name={memberName(uid)}
                      subtitle={uid === profile?.uid ? <StatusBadge tone="info" label={t('gd_you_badge')} /> : undefined}
                      trailing={<StatusBadge tone={index === 0 ? 'warning' : 'neutral'} label={`${members[uid]?.reputationScore ?? '-'} / 100`} />}
                    />
                  </div>
                ))}
            </CardContent>
          </Card>
        )}

        {canManage && profile && <MemberManagement group={group} currentUserId={profile.uid} />}
      </div>
    );
  }

  if (section === 'calendrier') {
    return (
      <div className="space-y-5">
        {sectionHeader(t('calendar'))}
        <CalendarView groups={[group]} onSelectGroup={() => {}} />
      </div>
    );
  }

  if (section === 'discussion') {
    return (
      <div className="space-y-5">
        {sectionHeader(t('gd_nav_discussion'))}
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

  if (section === 'documents') {
    return (
      <div className="space-y-5">
        {sectionHeader(t('gd_nav_documents'))}
        {profile && <DocumentsManager group={group} user={profile} />}
      </div>
    );
  }

  if (section === 'parametres') {
    return (
      <div className="space-y-5">
        {sectionHeader(t('gd_nav_parametres'))}

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

        {group.rules && (
          <SettingsGroup title={t('gd_circle_rules_title')}>
            <p className="px-4 py-3.5 text-sm text-muted-foreground whitespace-pre-line">{group.rules}</p>
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
  /* Écran principal — en-tête + prochaine cotisation + ma situation, puis  */
  /* les 6 accès secondaires. Plus de tout empilé et développé d'un coup.  */
  /* -------------------------------------------------------------------- */

  const daysRemaining = Math.max(0, Math.ceil((new Date(group.nextPayoutDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  const links: { id: Section; label: string; icon: EganyeIconName; bg: string; text: string }[] = [
    { id: 'cotisations', label: t('gd_nav_cotisations') || 'Cotisations', icon: 'cotisation', bg: 'bg-[#EBF5EA]', text: 'text-[#718A68]' },
    { id: 'membres', label: t('gd_nav_membres') || 'Membres', icon: 'members', bg: 'bg-[#F4EFE6]', text: 'text-[#3E2F24]' },
    { id: 'calendrier', label: t('calendar') || 'Calendrier', icon: 'calendar-finance', bg: 'bg-[#FEF6E9]', text: 'text-[#C49A55]' },
    { id: 'discussion', label: t('gd_nav_discussion') || 'Discussion', icon: 'chat', bg: 'bg-info-soft', text: 'text-info' },
    { id: 'documents', label: t('gd_nav_documents') || 'Documents', icon: 'document', bg: 'bg-[#FFF2E8]', text: 'text-[#C96F4A]' },
    { id: 'parametres', label: t('gd_nav_parametres') || 'Paramètres', icon: 'settings', bg: 'bg-muted', text: 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-4 sm:space-y-5 pb-16">
      {/* Bouton Retour */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="rounded-xl shrink-0 cursor-pointer -ml-2 text-xs font-bold">
          <EganyeIcon name="chevron-left" size={16} className="mr-1" />
          <span>{t('gd_back') || 'Retour'}</span>
        </Button>
      </div>

      {/* 1. Header du Cercle */}
      <div className="flex items-center gap-3.5 bg-white dark:bg-card p-4 rounded-3xl border border-[#EFE2D0] dark:border-border/80 shadow-soft">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F8F0E4] to-[#EFE2D0] text-[#718A68] flex items-center justify-center shrink-0 font-serif font-black text-xl border border-[#EFE2D0]">
          {group.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-serif font-black tracking-tight text-foreground truncate">
              {group.name}
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EBF5EA] text-[#718A68] shrink-0">
              {group.status === 'active' ? t('dash_active_badge') : t('gd_status_finished')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            {group.members.length} {group.members.length > 1 ? t('gd_participating_members') : t('gd_participating_member')}
          </p>
          {group.description && (
            <p className="text-xs text-muted-foreground/80 line-clamp-1 mt-0.5">
              {group.description}
            </p>
          )}
        </div>
      </div>

      {/* 2. Bloc Principal : Prochaine Cotisation */}
      <div className="bg-white dark:bg-card rounded-3xl p-5 shadow-soft border border-[#EFE2D0] dark:border-border/80 space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#C96F4A] flex items-center gap-1.5">
            <EganyeIcon name="pending" size={14} />
            <span>{t('gd_next_contribution')}</span>
          </span>
          <span className="text-xs font-bold text-muted-foreground">
            {t('gd_in_prefix')} {daysRemaining} {daysRemaining > 1 ? t('gd_days') : t('gd_day')}
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <div>
            <AmountDisplay amount={group.contributionAmount} currency={group.currency} size="lg" />
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('dash_due_prefix')} {format(new Date(group.nextPayoutDate), 'dd MMMM yyyy', { locale: fr })}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSection('cotisations')}
          className="btn-shine gradient-sunset w-full h-11 rounded-xl text-white font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
        >
          <span>{t('dash_contribute_cta')} — {group.contributionAmount.toLocaleString()} {group.currency}</span>
        </button>
      </div>

      {/* Bannière de vérification progressive (Juste-à-temps) */}
      {profile && (profile.kycLevel ?? 1) < 2 && (
        <div className="bg-[#FFF8F2] dark:bg-card border border-[#C96F4A]/25 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#C96F4A]/10 text-[#C96F4A] flex items-center justify-center shrink-0">
              <EganyeIcon name="shield" size={16} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-xs text-foreground truncate">{t('gd_kyc_banner_title')}</p>
              <p className="text-[11px] text-muted-foreground truncate">{t('gd_kyc_banner_desc')}</p>
            </div>
          </div>
          {onNavigateToVerification && (
            <Button
              size="sm"
              onClick={onNavigateToVerification}
              className="bg-[#C96F4A] hover:bg-[#B8623E] text-white text-xs font-bold rounded-xl h-8 px-3 shrink-0 cursor-pointer"
            >
              {t('gd_kyc_banner_cta')}
            </Button>
          )}
        </div>
      )}

      {/* 3. Ma Situation */}
      <div className="bg-white dark:bg-card rounded-2xl p-4 shadow-soft border border-[#EFE2D0] dark:border-border/80 grid grid-cols-2 gap-3">
        <div>
          <span className="text-[11px] font-bold uppercase text-muted-foreground block">{t('gd_my_total')}</span>
          <p className="text-base font-serif font-black text-foreground mt-0.5">
            {myContributed !== null ? myContributed.toLocaleString() : '0'} {group.currency}
          </p>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-bold uppercase text-muted-foreground block">{t('gd_cycle_position')}</span>
          <p className="text-base font-serif font-black text-[#718A68] mt-0.5">
            {myPositionIdx >= 0 ? `#${myPositionIdx + 1} ${t('gd_out_of')} ${group.members.length}` : '-'}
          </p>
        </div>
      </div>

      {/* 4. Sections Secondaires (6 accès nets) */}
      <div className="space-y-2 pt-1">
        <h3 className="font-serif font-black text-sm text-foreground uppercase tracking-wider px-1">
          {t('gd_management_space')}
        </h3>
        <div className="bg-white dark:bg-card rounded-2xl shadow-soft border border-[#EFE2D0] dark:border-border/80 overflow-hidden divide-y divide-[#EFE2D0]/60 dark:divide-border/60">
          {links.map((link) => (
            <button
              key={link.id}
              onClick={() => setSection(link.id)}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/40 active:bg-muted transition-colors cursor-pointer group"
            >
              <div className={`w-9 h-9 rounded-xl ${link.bg} ${link.text} flex items-center justify-center shrink-0`}>
                <EganyeIcon name={link.icon} size={18} />
              </div>
              <span className="flex-1 font-bold text-sm text-foreground group-hover:text-[#C96F4A] transition-colors">
                {link.label}
              </span>
              <EganyeIcon name="chevron-right" size={16} className="text-muted-foreground group-hover:text-[#C96F4A] transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
