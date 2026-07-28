import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Group, UserProfile } from '@/types';
import { ArrowLeft, CheckCircle2, Clock, CheckCircle, MessageSquare, Loader2, QrCode, Copy, ExternalLink, Check, Shuffle, Gift, Trophy, RotateCcw, Landmark } from 'lucide-react';
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
import { executePayoutDisbursement } from '@/lib/disbursements';
import { ConfirmationBottomSheet } from './ui/ConfirmationBottomSheet';

interface GroupDetailsProps {
  group: Group;
  onBack: () => void;
}

export function GroupDetails({ group, onBack }: GroupDetailsProps) {
  const { profile } = useAuth();
  const [isCompleting, setIsCompleting] = React.useState(false);
  const [showChat, setShowChat] = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [copiedCode, setCopiedCode] = React.useState(false);
  const [members, setMembers] = React.useState<Record<string, UserProfile>>({});
  const [drawnBeneficiaryId, setDrawnBeneficiaryId] = React.useState<string | null>(null);
  const [isDistributing, setIsDistributing] = React.useState(false);
  const [isConfirmDistributeOpen, setIsConfirmDistributeOpen] = React.useState(false);

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

  const memberName = (uid: string) => members[uid]?.displayName || `Membre ${uid.slice(0, 6)}`;

  const scheduledBeneficiaryId = group.payoutOrder[group.currentPayoutIndex];
  const totalPot = group.contributionAmount * group.members.length;

  const handleDraw = () => {
    const remaining = group.payoutOrder.slice(group.currentPayoutIndex);
    const picked = remaining[Math.floor(Math.random() * remaining.length)];
    setDrawnBeneficiaryId(picked);
  };

  const beneficiaryToDistribute = group.distributionMethod === 'draw' ? drawnBeneficiaryId : scheduledBeneficiaryId;

  const handleConfirmDistribution = async () => {
    if (!profile || !beneficiaryToDistribute) return;
    setIsDistributing(true);
    try {
      const result = await executePayoutDisbursement({
        groupId: group.id,
        beneficiaryId: beneficiaryToDistribute,
        adminUserId: profile.uid
      });
      if (!result.success) {
        throw new Error(result.message);
      }
      toast.success(result.message);
      setDrawnBeneficiaryId(null);
    } catch (error: any) {
      console.error('Distribution error:', error);
      toast.error(error.message || "Erreur lors de la distribution du cycle.");
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
      toast.success("Le cercle a été marqué comme terminé.");
    } catch (error) {
      console.error("Error completing group:", error);
      toast.error("Erreur lors de la clôture du cercle.");
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Button>
        <Button 
          variant={showChat ? "default" : "outline"} 
          size="sm" 
          onClick={() => setShowChat(!showChat)}
          className="flex items-center gap-2"
        >
          <MessageSquare className="w-4 h-4" />
          {showChat ? "Masquer le Chat" : "Afficher le Chat"}
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
            <h1 className="text-3xl font-bold tracking-tight">{group.name}</h1>
            <Badge variant={group.status === 'active' ? 'default' : 'secondary'}>
              {group.status === 'active' ? 'En cours' : 'Terminé'}
            </Badge>
            <Badge variant="outline">{group.isPrivate === false ? 'Public' : 'Privé'}</Badge>
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
              Marquer comme terminé
            </Button>
          )}
          <InviteMemberDialog groupId={group.id} groupName={group.name} joinCode={group.joinCode} />
        </div>
      </div>

      {/* Carnet de Tontine Numérique & Transparence de Caisse */}
      <Card className="glass-card rounded-3xl overflow-hidden border border-border/80 shadow-soft">
        <CardHeader className="pb-3 bg-muted/30">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base font-serif font-bold flex items-center gap-2">
              <Landmark className="w-5 h-5 text-primary" />
              Carnet Numérique & Transparence de Caisse
            </CardTitle>
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
              Transparence Totale
            </Badge>
          </div>
          <CardDescription className="text-xs">
            État financier en temps réel accessible à tous les membres du cercle.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card p-3.5 rounded-2xl border border-border/60">
              <span className="text-[10px] font-bold uppercase text-muted-foreground block">Caisse Actuelle</span>
              <p className="text-lg font-black text-primary mt-0.5">
                {(group.contributionAmount * group.currentPayoutIndex).toLocaleString()} {group.currency}
              </p>
            </div>
            <div className="bg-card p-3.5 rounded-2xl border border-border/60">
              <span className="text-[10px] font-bold uppercase text-muted-foreground block">Cotisation / Membre</span>
              <p className="text-lg font-black text-foreground mt-0.5">
                {group.contributionAmount.toLocaleString()} {group.currency}
              </p>
            </div>
            <div className="bg-card p-3.5 rounded-2xl border border-border/60">
              <span className="text-[10px] font-bold uppercase text-muted-foreground block">Membres Actifs</span>
              <p className="text-lg font-black text-foreground mt-0.5">
                {group.members.length} participants
              </p>
            </div>
            <div className="bg-card p-3.5 rounded-2xl border border-border/60">
              <span className="text-[10px] font-bold uppercase text-muted-foreground block">Pot par Cycle</span>
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
              Tour de Distribution — Qui reçoit quand ?
            </CardTitle>
            <Badge className="bg-primary text-primary-foreground font-black text-xs px-3 py-1 rounded-xl">
              Tour {group.currentPayoutIndex + 1} / {group.members.length}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Planning officiel des décaissements du cercle.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {/* Highlight Card for Next Beneficiary */}
          <div className="gradient-sunset p-4 rounded-2xl text-white shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200">
                🥇 Prochain Bénéficiaire (Tour {group.currentPayoutIndex + 1})
              </span>
              <h4 className="text-lg font-serif font-black">{memberName(beneficiaryToDistribute)}</h4>
              <p className="text-xs text-white/90">
                Date : {format(new Date(group.nextPayoutDate), 'dd MMMM yyyy', { locale: fr })}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200">Montant Net Prévu</span>
              <p className="text-2xl font-black text-white">{totalPot.toLocaleString()} {group.currency}</p>
            </div>
          </div>

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
                        {isCurrent && <Badge className="bg-primary text-white text-[9px] px-1.5 py-0">En cours</Badge>}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {isPast ? 'Décaissement effectué' : isCurrent ? 'Tour de gain actuel' : 'À venir'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-foreground">
                      {totalPot.toLocaleString()} {group.currency}
                    </span>
                    <span className={`block text-[10px] font-bold ${
                      isPast ? 'text-emerald-600' : isCurrent ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                      {isPast ? '✅ Payé' : isCurrent ? '🟠 Prochain' : '⚪ Attente'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {group.rules && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Règlement du cercle</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{group.rules}</p>
          </CardContent>
        </Card>
      )}

      {/* Share & QR Code Card */}
      <Card className="border-brand/20 bg-brand/10 overflow-hidden">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            
            {/* Left Sub-panel: Share details */}
            <div className="md:col-span-8 space-y-4">
              <div className="space-y-1">
                <Badge className="bg-brand text-white font-black tracking-widest text-[10px] uppercase">Partage Rapide</Badge>
                <h3 className="text-xl font-extrabold text-foreground tracking-tight">Lien d'Invitation & Accès PWA</h3>
                <p className="text-muted-foreground text-xs">
                  Partagez ce lien personnalisé avec vos proches pour qu'ils rejoignent instantanément votre cercle de cotisation eganyé.
                </p>
              </div>

              {/* Copyable Invitation Link */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Lien personnalisé du cercle</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    title="Lien d'invitation du cercle"
                    aria-label="Lien d'invitation du cercle"
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
                      toast.success("Lien d'invitation copié !");
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                  >
                    {copiedLink ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
                    {copiedLink ? "Copié !" : "Copier"}
                  </Button>
                </div>
              </div>

              {/* Invitation Code */}
              <div className="flex flex-wrap items-center gap-6 pt-1">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block">Code unique du cercle</span>
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
                          toast.success("Code de cercle copié !");
                          setTimeout(() => setCopiedCode(false), 2000);
                        }
                      }}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1"
                      title="Copier le code"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-secondary" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block">Canaux de partage</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[10px] font-bold text-brand bg-brand/10 hover:bg-brand/20 rounded-lg px-2.5"
                      onClick={() => {
                        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Rejoins mon cercle d'épargne eganyé en cliquant sur ce lien : ${window.location.origin}/?join=${group.joinCode}`)}`, '_blank');
                      }}
                    >
                      WhatsApp
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[10px] font-bold text-sky-500 bg-sky-500/10 hover:bg-sky-500/20 rounded-lg px-2.5"
                      onClick={() => {
                        window.open(`https://telegram.me/share/url?url=${encodeURIComponent(`${window.location.origin}/?join=${group.joinCode}`)}&text=${encodeURIComponent(`Rejoins mon cercle d'épargne eganyé`)}`, '_blank');
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
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}/?join=${group.joinCode}`)}`}
                  alt="Code QR d'invitation"
                  className="w-32 h-32 md:w-36 md:h-36"
                />
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-brand p-1.5 rounded-lg border-2 border-white shadow-md">
                  <QrCode className="w-5 h-5 text-foreground" />
                </div>
              </div>
              <span className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                Scanner pour Rejoindre
              </span>
            </div>

          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ordre de Payout & Statut</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Rang</TableHead>
                <TableHead>Membre</TableHead>
                <TableHead>Date prévue</TableHead>
                <TableHead className="text-right">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.payoutOrder.map((memberId, index) => (
                <TableRow key={memberId} className={index === group.currentPayoutIndex ? 'bg-primary/5' : ''}>
                  <TableCell className="font-medium">#{index + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs">
                        {memberId.charAt(0)}
                      </div>
                      <span>{memberName(memberId)}</span>
                      {index === group.currentPayoutIndex && (
                        <Badge variant="outline" className="ml-2 text-[10px] h-4">Actuel</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(group.startDate), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    {index < group.currentPayoutIndex ? (
                      <div className="flex items-center justify-end gap-1 text-secondary text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        Payé
                      </div>
                    ) : index === group.currentPayoutIndex ? (
                      <div className="flex items-center justify-end gap-1 text-blue-600 text-sm">
                        <Clock className="w-4 h-4" />
                        En attente
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">À venir</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {group.members.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="w-4 h-4 text-brand" />
              Classement du cercle
            </CardTitle>
            <CardDescription>Membres classés par Score de Réputation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {[...group.members]
              .sort((a, b) => (members[b]?.reputationScore || 0) - (members[a]?.reputationScore || 0))
              .map((uid, index) => (
                <div key={uid} className={`flex items-center justify-between p-2.5 rounded-lg ${index === 0 ? 'bg-brand/10' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-6 text-center text-xs font-black ${index === 0 ? 'text-brand' : 'text-muted-foreground'}`}>#{index + 1}</span>
                    <span className="text-sm font-medium">{memberName(uid)}</span>
                    {uid === profile?.uid && <Badge variant="outline" className="text-[9px]">Vous</Badge>}
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
        title="Confirmer la distribution"
        description={beneficiaryToDistribute ? `Vous allez distribuer le pot de ${totalPot.toLocaleString()} ${group.currency} à ${memberName(beneficiaryToDistribute)} pour le cycle ${group.currentPayoutIndex + 1}. Cette action est irréversible.` : ''}
        amount={totalPot}
        currency={group.currency}
        type="generic"
        isLoading={isDistributing}
      />
    </div>
  );
}
