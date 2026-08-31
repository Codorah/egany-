import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Group, UserProfile } from '@/types';
import { ArrowLeft, Clock, CheckCircle, MessageSquare, Loader2, QrCode, Copy, ExternalLink, Check, Shuffle, Gift, Trophy, RotateCcw, Landmark, Circle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { InviteMemberDialog } from './InviteMemberDialog';
import { MemberManagement } from './MemberManagement';
import { DocumentsManager } from './DocumentsManager';
import { Chat } from './Chat';
import { supabase } from '@/lib/supabase';
import { mapProfileRow } from '@/lib/mappers';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { executePayoutDisbursement, drawPayoutBeneficiary } from '@/lib/disbursements';
import { ConfirmationBottomSheet } from './ui/ConfirmationBottomSheet';
import { CustomAvatar } from './CustomAvatar';
import QRCode from 'qrcode';
import { useLanguage } from '@/contexts/LanguageContext';

interface GroupDetailsProps {
  group: Group;
  onBack: () => void;
}

export function GroupDetails({ group, onBack }: GroupDetailsProps) {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [isCompleting, setIsCompleting] = React.useState(false);
  const [showChat, setShowChat] = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [copiedCode, setCopiedCode] = React.useState(false);
  const [members, setMembers] = React.useState<Record<string, UserProfile>>({});
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [isDistributing, setIsDistributing] = React.useState(false);
  const [isConfirmDistributeOpen, setIsConfirmDistributeOpen] = React.useState(false);
  const [auctionDiscount, setAuctionDiscount] = React.useState('');
  const [treasuryBalance, setTreasuryBalance] = React.useState<number | null>(null);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="flex items-center gap-2 h-11">
          <ArrowLeft className="w-4 h-4" />
          {t('gd_back')}
        </Button>
        <Button
          variant={showChat ? "default" : "outline"}
          onClick={() => setShowChat(!showChat)}
          className="flex items-center gap-2 h-11"
        >
          <MessageSquare className="w-4 h-4" />
          {showChat ? t('gd_hide_chat') : t('gd_show_chat')}
        </Button>
      </div>

      {showChat && profile && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <Chat groupId={group.id} user={profile} />
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-serif font-black tracking-tight text-foreground">{group.name}</h1>
            <Badge variant={group.status === 'active' ? 'default' : 'secondary'}>
              {group.status === 'active' ? t('status_active') : t('status_completed')}
            </Badge>
            <Badge variant="outline">{group.isPrivate === false ? t('gd_public') : t('gd_private')}</Badge>
          </div>
          <p className="text-muted-foreground mt-1">{group.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canManage && group.status === 'active' && (
            <Button 
              variant="outline" 
              className="border-secondary text-secondary hover:bg-success-soft"
              onClick={handleCompleteGroup}
              disabled={isCompleting}
            >
              {isCompleting ? (
                <Clock className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              {t('gd_mark_completed')}
            </Button>
          )}
          <InviteMemberDialog groupId={group.id} groupName={group.name} joinCode={group.joinCode} />
        </div>
      </div>

      {/* Carnet de Tontine Numérique & Transparence de Caisse */}
      <Card className="glass-card rounded-2xl overflow-hidden shadow-soft">
        <CardHeader className="pb-3 bg-muted/20">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base font-serif font-bold flex items-center gap-2">
              <Landmark className="w-5 h-5 text-primary" />
              {t('gd_ledger_card_title')}
            </CardTitle>
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[13px]">
              {t('gd_full_transparency_badge')}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            {t('gd_ledger_card_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-muted/30 p-3 rounded-xl">
              <span className="text-[13px] font-bold uppercase text-muted-foreground block">{t('gd_current_treasury_label')}</span>
              <p className="text-lg font-black text-primary mt-0.5">
                {treasuryBalance !== null ? treasuryBalance.toLocaleString() : '...'} {group.currency}
              </p>
            </div>
            <div className="bg-muted/30 p-3 rounded-xl">
              <span className="text-[13px] font-bold uppercase text-muted-foreground block">{t('contribution_label')} / {t('member')}</span>
              <p className="text-lg font-black text-foreground mt-0.5">
                {group.contributionAmount.toLocaleString()} {group.currency}
              </p>
            </div>
            <div className="bg-muted/30 p-3 rounded-xl">
              <span className="text-[13px] font-bold uppercase text-muted-foreground block">{t('gd_active_members_label')}</span>
              <p className="text-lg font-black text-foreground mt-0.5">
                {group.members.length} {t('participants')}
              </p>
            </div>
            <div className="bg-card p-3.5 rounded-2xl border border-border/60">
              <span className="text-[13px] font-bold uppercase text-muted-foreground block">{t('gd_pot_per_cycle_label')}</span>
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
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
              <RotateCcw className="w-5 h-5 text-emerald-500" />
              {t('gd_distribution_tour_title')}
            </CardTitle>
            <Badge className="bg-primary text-primary-foreground font-black text-xs px-3 py-1 rounded-xl">
              {t('gd_tour_word')} {group.currentPayoutIndex + 1} / {group.members.length}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            {t('gd_distribution_tour_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {/* Highlight Card for Next Beneficiary */}
          {beneficiaryToDistribute ? (
            <div className="gradient-sunset p-4 rounded-2xl text-white shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="space-y-0.5">
                <span className="text-[13px] font-bold uppercase tracking-wider text-amber-200 flex items-center gap-1">
                  <Trophy className="w-3 h-3" /> {t('gd_next_beneficiary_label')} ({t('gd_tour_word')} {group.currentPayoutIndex + 1})
                </span>
                <h4 className="text-lg font-serif font-black">{memberName(beneficiaryToDistribute)}</h4>
                <p className="text-xs text-white/90">
                  {t('gd_date_label')} {format(new Date(group.nextPayoutDate), 'dd MMMM yyyy', { locale: fr })}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[13px] font-bold uppercase tracking-wider text-amber-200">{t('gd_net_amount_label')}</span>
                <p className="text-2xl font-black text-white">{totalPot.toLocaleString()} {group.currency}</p>
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
                <Button onClick={handleDraw} disabled={isDrawing} className="shrink-0 rounded-xl">
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
                  <p className="text-[13px] text-muted-foreground">
                    {t('gd_auction_discount_desc')}
                  </p>
                </div>
              )}
              <Button
                onClick={() => setIsConfirmDistributeOpen(true)}
                className="w-full gradient-sunset text-white font-bold rounded-xl h-11"
              >
                <Gift className="w-4 h-4 mr-2" />
                {t('gd_distribute_funds_button')}
              </Button>
            </div>
          )}

          {/* Timeline List */}
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
                        ? 'bg-emerald-500/20 text-emerald-600' 
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
                      isPast ? 'text-emerald-600' : isCurrent ? 'text-primary' : 'text-muted-foreground'
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

      {group.rules && (
        <Card className="glass-card rounded-2xl overflow-hidden shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('gd_circle_rules_title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{group.rules}</p>
          </CardContent>
        </Card>
      )}

      {/* Share & QR Code Card */}
      <Card className="rounded-2xl border-brand/20 bg-brand/10 overflow-hidden shadow-soft">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            
            {/* Left Sub-panel: Share details */}
            <div className="md:col-span-8 space-y-4">
              <div className="space-y-1">
                <Badge className="bg-brand text-white font-black tracking-widest text-[13px] uppercase">{t('gd_quick_share_badge')}</Badge>
                <h3 className="text-xl font-extrabold text-foreground tracking-tight">{t('gd_invite_link_title')}</h3>
                <p className="text-muted-foreground text-xs">
                  {t('gd_invite_link_desc')}
                </p>
              </div>

              {/* Copyable Invitation Link */}
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
                    className={`rounded-xl transition-all ${copiedLink ? 'bg-secondary text-white border-secondary' : 'bg-card border-border hover:bg-muted'}`}
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

              {/* Invitation Code */}
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
                      className="text-muted-foreground hover:text-foreground transition-colors p-1"
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
                      className="h-7 text-[13px] font-bold text-brand bg-brand/10 hover:bg-brand/20 rounded-lg px-2.5"
                      onClick={() => {
                        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`${t('gd_whatsapp_share_text')} ${window.location.origin}/?join=${group.joinCode}`)}`, '_blank');
                      }}
                    >
                      WhatsApp
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[13px] font-bold text-sky-500 bg-sky-500/10 hover:bg-sky-500/20 rounded-lg px-2.5"
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

            {/* Right Sub-panel: Scanable QR Code */}
            <div className="md:col-span-4 flex flex-col items-center justify-center bg-card p-4 rounded-2xl border border-border/60 shadow-inner space-y-2">
              <div className="relative border-4 border-foreground rounded-xl p-1.5 bg-card">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={t('gd_qr_code_alt')}
                    className="w-32 h-32 md:w-36 md:h-36"
                  />
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
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="w-4 h-4 text-brand" />
              {t('gd_ranking_title')}
            </CardTitle>
            <CardDescription>{t('gd_ranking_desc_prefix')} {t('reputation_score')}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {[...group.members]
              .sort((a, b) => (members[b]?.reputationScore || 0) - (members[a]?.reputationScore || 0))
              .map((uid, index) => (
                <div key={uid} className={`flex items-center justify-between p-2.5 rounded-lg ${index === 0 ? 'bg-brand/10' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-6 text-center text-xs font-black ${index === 0 ? 'text-brand' : 'text-muted-foreground'}`}>#{index + 1}</span>
                    <CustomAvatar photoURL={members[uid]?.photoURL} name={memberName(uid)} size={28} />
                    <span className="text-sm font-medium">{memberName(uid)}</span>
                    {uid === profile?.uid && <Badge variant="outline" className="text-[12px]">{t('gd_you_badge')}</Badge>}
                  </div>
                  <Badge className={index === 0 ? 'bg-brand text-white' : ''} variant={index === 0 ? undefined : 'outline'}>
                    {members[uid]?.reputationScore ?? '-'} / 100
                  </Badge>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {profile && <DocumentsManager group={group} user={profile} />}

      {canManage && profile && <MemberManagement group={group} currentUserId={profile.uid} />}

      {/* Cycle distribution confirmation bottom sheet */}
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
