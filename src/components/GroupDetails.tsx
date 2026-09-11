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
import { mapProfileRow } from '@/lib/mappers';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { executePayoutDisbursement, drawPayoutBeneficiary } from '@/lib/disbursements';
import { ConfirmationBottomSheet } from './ui/ConfirmationBottomSheet';
import { MemberCard } from './ui/MemberCard';
import { StatusBadge } from './ui/StatusBadge';
import QRCode from 'qrcode';
import { useLanguage } from '@/contexts/LanguageContext';

interface GroupDetailsProps {
  group: Group;
  onBack: () => void;
}

type Section = 'cotisations' | 'membres' | 'calendrier' | 'discussion' | 'documents' | 'parametres';

export function GroupDetails({ group, onBack }: GroupDetailsProps) {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [section, setSection] = React.useState<Section | null>(null);
  const [isCompleting, setIsCompleting] = React.useState(false);
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

  const isCreator = profile?.uid === group.creatorId;
  const isAdmin = profile?.role === 'admin';
  const canManage = isCreator || isAdmin;

  React.useEffect(() => {
    const fetchMembers = async () => {
      if (group.members.length === 0) {
        setMembers({});
        return;
      }
      const { data, error } = await supabase.from('profiles').select('*').in('id', group.members);
      if (error) {
        console.error('Error fetching members:', error);
        return;
      }
      const entries: Record<string, UserProfile> = {};
      for (const row of data ?? []) {
        entries[row.id] = mapProfileRow(row);
      }
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

        {/* Carnet de Tontine Numérique & Transparence de Caisse */}
        <Card className="glass-card rounded-2xl overflow-hidden shadow-soft">
          <CardHeader className="pb-3 bg-muted/20">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base font-serif font-bold flex items-center gap-2">
                <Landmark className="w-5 h-5 text-primary" />
                {t('gd_ledger_card_title')}
              </CardTitle>
              <Badge className="bg-success-soft text-secondary border-secondary/20 text-[13px]">
                {t('gd_full_transparency_badge')}
              </Badge>
            </div>
            <CardDescription className="text-xs">{t('gd_ledger_card_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-muted/30 p-3 rounded-xl">
                <span className="text-[13px] font-bold uppercase text-muted-foreground block">{t('gd_current_treasury_label')}</span>
                <p className="text-lg font-serif font-black text-primary mt-0.5">
                  {treasuryBalance !== null ? treasuryBalance.toLocaleString() : '...'} {group.currency}
                </p>
              </div>
              <div className="bg-muted/30 p-3 rounded-xl">
                <span className="text-[13px] font-bold uppercase text-muted-foreground block">{t('contribution_label')} / {t('member')}</span>
                <p className="text-lg font-serif font-black text-foreground mt-0.5">
                  {group.contributionAmount.toLocaleString()} {group.currency}
                </p>
              </div>
              <div className="bg-muted/30 p-3 rounded-xl">
                <span className="text-[13px] font-bold uppercase text-muted-foreground block">{t('gd_active_members_label')}</span>
                <p className="text-lg font-serif font-black text-foreground mt-0.5">
                  {group.members.length} {t('participants')}
                </p>
              </div>
              <div className="bg-card p-3.5 rounded-2xl border border-border/60">
                <span className="text-[13px] font-bold uppercase text-muted-foreground block">{t('gd_pot_per_cycle_label')}</span>
                <p className="text-lg font-serif font-black text-secondary mt-0.5">
                  {totalPot.toLocaleString()} {group.currency}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Visual Rotation Timeline: "Qui reçoit quand ?" */}
        <Card className="glass-card rounded-3xl overflow-hidden border border-border/80 shadow-soft">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base font-serif font-bold flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-secondary" />
                {t('gd_distribution_tour_title')}
              </CardTitle>
              <Badge className="bg-primary text-primary-foreground font-black text-xs px-3 py-1 rounded-xl">
                {t('gd_tour_word')} {group.currentPayoutIndex + 1} / {group.members.length}
              </Badge>
            </div>
            <CardDescription className="text-xs">{t('gd_distribution_tour_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
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

        {profile && <ContributionsManager group={group} user={profile} onBack={() => setSection(null)} />}

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

        {/* Share & QR Code Card */}
        <Card className="rounded-2xl border-brand/20 bg-brand/10 overflow-hidden shadow-soft">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-8 space-y-4">
                <div className="space-y-1">
                  <Badge className="bg-brand text-white font-black tracking-widest text-[13px] uppercase">{t('gd_quick_share_badge')}</Badge>
                  <h3 className="text-xl font-serif font-extrabold text-foreground tracking-tight">{t('gd_invite_link_title')}</h3>
                  <p className="text-muted-foreground text-xs">{t('gd_invite_link_desc')}</p>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[13px] font-bold uppercase text-muted-foreground">{t('gd_custom_link_label')}</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      title={t('gd_invite_link_aria')}
                      aria-label={t('gd_invite_link_aria')}
                      value={`${window.location.origin}/?join=${group.joinCode}`}
                      className="flex-1 bg-card border border-border text-foreground text-xs px-3.5 py-2 rounded-xl focus:outline-none"
                    />
                    <Button
                      size="sm"
                      variant={copiedLink ? "default" : "outline"}
                      className={`rounded-xl transition-all cursor-pointer ${copiedLink ? 'bg-secondary text-white border-secondary' : 'bg-card border-border hover:bg-muted'}`}
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/?join=${group.joinCode}`);
                        setCopiedLink(true);
                        toast.success(t('gd_invite_link_copied_toast'));
                        setTimeout(() => setCopiedLink(false), 2000);
                      }}
                    >
                      {copiedLink ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
                      {copiedLink ? t('gd_copied_label') : t('gd_copy_label')}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-1">
                  <div className="space-y-1">
                    <span className="text-[13px] font-bold uppercase text-muted-foreground block">{t('gd_unique_code_label')}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black tracking-wider text-foreground bg-chip px-2.5 py-1 rounded-lg border border-border">
                        {group.joinCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (group.joinCode) {
                            navigator.clipboard.writeText(group.joinCode);
                            setCopiedCode(true);
                            toast.success(t('gd_code_copied_toast'));
                            setTimeout(() => setCopiedCode(false), 2000);
                          }
                        }}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer"
                        title={t('gd_copy_code_title')}
                      >
                        {copiedCode ? <Check className="w-4 h-4 text-secondary" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[13px] font-bold uppercase text-muted-foreground block">{t('gd_share_channels_label')}</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[13px] font-bold text-brand bg-brand/10 hover:bg-brand/20 rounded-lg px-2.5 cursor-pointer"
                        onClick={() => {
                          window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`${t('gd_whatsapp_share_text')} ${window.location.origin}/?join=${group.joinCode}`)}`, '_blank');
                        }}
                      >
                        WhatsApp
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[13px] font-bold text-secondary bg-secondary/10 hover:bg-secondary/20 rounded-lg px-2.5 cursor-pointer"
                        onClick={() => {
                          window.open(`https://telegram.me/share/url?url=${encodeURIComponent(`${window.location.origin}/?join=${group.joinCode}`)}&text=${encodeURIComponent(t('gd_telegram_share_text'))}`, '_blank');
                        }}
                      >
                        Telegram
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-4 flex flex-col items-center justify-center bg-card p-4 rounded-2xl border border-border/60 shadow-inner space-y-2">
                <div className="relative border-4 border-foreground rounded-xl p-1.5 bg-card">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt={t('gd_qr_code_alt')} className="w-32 h-32 md:w-36 md:h-36" />
                  ) : (
                    <div className="w-32 h-32 md:w-36 md:h-36 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-brand p-1.5 rounded-lg border-2 border-white shadow-md">
                    <QrCode className="w-5 h-5 text-foreground" />
                  </div>
                </div>
                <span className="text-[12px] font-black uppercase text-muted-foreground flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  {t('gd_scan_to_join')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {group.members.length > 1 && (
          <Card className="glass-card rounded-2xl overflow-hidden shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-serif">
                <Trophy className="w-4 h-4 text-brand" />
                {t('gd_ranking_title')}
              </CardTitle>
              <CardDescription>{t('gd_ranking_desc_prefix')} {t('reputation_score')}.</CardDescription>
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
        {profile && <Chat groupId={group.id} user={profile} />}
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

        <Card className="glass-card rounded-2xl overflow-hidden shadow-soft">
          <CardContent className="p-5 grid grid-cols-2 gap-3">
            <div className="bg-muted/30 p-3 rounded-xl">
              <span className="text-[13px] font-bold uppercase text-muted-foreground block">{t('frequency')}</span>
              <p className="text-sm font-serif font-bold text-foreground mt-0.5 capitalize">{t(`freq_${group.frequency}`)}</p>
            </div>
            <div className="bg-muted/30 p-3 rounded-xl">
              <span className="text-[13px] font-bold uppercase text-muted-foreground block">{t('cgd_distribution_method_label')}</span>
              <p className="text-sm font-serif font-bold text-foreground mt-0.5">{t(`cgd_dist_${group.distributionMethod || 'sequential'}`)}</p>
            </div>
            <div className="bg-muted/30 p-3 rounded-xl">
              <span className="text-[13px] font-bold uppercase text-muted-foreground block">{t('cgd_max_members_label')}</span>
              <p className="text-sm font-serif font-bold text-foreground mt-0.5">{group.maxMembers ?? group.members.length}</p>
            </div>
            <div className="bg-muted/30 p-3 rounded-xl">
              <span className="text-[13px] font-bold uppercase text-muted-foreground block">{t('gd_public')} / {t('gd_private')}</span>
              <p className="text-sm font-serif font-bold text-foreground mt-0.5">{group.isPrivate === false ? t('gd_public') : t('gd_private')}</p>
            </div>
          </CardContent>
        </Card>

        {group.rules && (
          <Card className="glass-card rounded-2xl overflow-hidden shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-serif">{t('gd_circle_rules_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{group.rules}</p>
            </CardContent>
          </Card>
        )}

        {canManage && group.status === 'active' && (
          <Button
            variant="outline"
            className="w-full border-secondary text-secondary hover:bg-success-soft rounded-xl h-11 cursor-pointer"
            onClick={handleCompleteGroup}
            disabled={isCompleting}
          >
            {isCompleting ? <Clock className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
            {t('gd_mark_completed')}
          </Button>
        )}
      </div>
    );
  }

  /* -------------------------------------------------------------------- */
  /* Écran principal — en-tête + prochaine cotisation + ma situation, puis  */
  /* les 6 accès secondaires. Plus de tout empilé et développé d'un coup.  */
  /* -------------------------------------------------------------------- */

  const links: { id: Section; label: string; icon: typeof Users }[] = [
    { id: 'cotisations', label: t('gd_nav_cotisations'), icon: Landmark },
    { id: 'membres', label: t('gd_nav_membres'), icon: Users },
    { id: 'calendrier', label: t('calendar'), icon: CalendarDays },
    { id: 'discussion', label: t('gd_nav_discussion'), icon: MessageSquare },
    { id: 'documents', label: t('gd_nav_documents'), icon: FileText },
    { id: 'parametres', label: t('gd_nav_parametres'), icon: Settings },
  ];

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-start justify-between gap-3">
        <Button variant="ghost" onClick={onBack} className="rounded-xl shrink-0 cursor-pointer -ml-2">
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          {t('gd_back')}
        </Button>
      </div>

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-foreground">{group.name}</h1>
          <Badge variant={group.status === 'active' ? 'default' : 'secondary'} className="rounded-full">
            {group.status === 'active' ? t('status_active') : t('status_completed')}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm mt-1">{group.description}</p>
      </div>

      {/* Prochaine cotisation */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 shadow-soft border border-border/70 space-y-3">
        <span className="text-xs font-bold text-primary flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> {t('gd_next_contribution_title')}
        </span>
        <div>
          <AmountDisplay amount={group.contributionAmount} currency={group.currency} size="lg" />
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {t('deadline_prefix')} {format(new Date(group.nextPayoutDate), 'dd MMM yyyy', { locale: fr })}
          </p>
        </div>
        <Button
          onClick={() => setSection('cotisations')}
          className="btn-shine w-full gradient-sunset text-white font-bold rounded-xl h-10 cursor-pointer"
        >
          {t('contribute_now')}
        </Button>
      </div>

      {/* Ma situation */}
      <div className="glass-card rounded-2xl p-4 shadow-soft border border-border/70 grid grid-cols-2 gap-3">
        <div>
          <span className="text-[11px] font-bold uppercase text-muted-foreground block">{t('gd_my_situation_title')}</span>
          <p className="text-sm font-serif font-black text-foreground mt-0.5">
            {myContributed !== null ? myContributed.toLocaleString() : '...'} {group.currency} {t('gd_my_contributed_label')}
          </p>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-bold uppercase text-muted-foreground block">{t('gd_my_position_label')}</span>
          <p className="text-sm font-serif font-black text-foreground mt-0.5">
            {myPositionIdx >= 0 ? `${myPositionIdx + 1} / ${group.members.length}` : '-'}
          </p>
        </div>
      </div>

      {/* Accès secondaires */}
      <div className="glass-card rounded-2xl shadow-soft border border-border/70 overflow-hidden">
        {links.map((link, idx) => {
          const Icon = link.icon;
          return (
            <button
              key={link.id}
              onClick={() => setSection(link.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/50 active:bg-muted transition-colors cursor-pointer ${
                idx > 0 ? 'border-t border-border/60' : ''
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="w-4.5 h-4.5" />
              </div>
              <span className="flex-1 font-bold text-sm text-foreground">{link.label}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
