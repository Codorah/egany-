import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Group, UserProfile } from '@/types';
import { Calendar, DollarSign, Users, ArrowLeft, CheckCircle2, Clock, UserPlus, CheckCircle, CreditCard, MessageSquare, Loader2, QrCode, Copy, ExternalLink, Check } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { InviteMemberDialog } from './InviteMemberDialog';
import { Chat } from './Chat';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ConfirmationBottomSheet } from './ui/ConfirmationBottomSheet';

interface GroupDetailsProps {
  group: Group;
  onBack: () => void;
}

export function GroupDetails({ group, onBack }: GroupDetailsProps) {
  const { profile } = useAuth();
  const [isCompleting, setIsCompleting] = React.useState(false);
  const [isPaying, setIsPaying] = React.useState(false);
  const [showChat, setShowChat] = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [copiedCode, setCopiedCode] = React.useState(false);
  const [isConfirmPaymentOpen, setIsConfirmPaymentOpen] = React.useState(false);

  const isCreator = profile?.uid === group.creatorId;
  const isAdmin = profile?.role === 'admin';
  const canManage = isCreator || isAdmin;

  const handleStripePayment = () => {
    if (!profile) return;
    setIsConfirmPaymentOpen(true);
  };

  const executeStripePayment = async () => {
    if (!profile) return;
    setIsPaying(true);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: group.contributionAmount,
          currency: group.currency.toLowerCase(),
          groupName: group.name,
          groupId: group.id,
          userId: profile.uid,
          userName: profile.displayName,
        }),
      });

      const session = await response.json();
      if (session.url) {
        window.location.href = session.url;
      } else {
        throw new Error(session.error || 'Erreur lors de la création de la session de paiement');
      }
    } catch (error: any) {
      console.error('Stripe error:', error);
      toast.error(error.message || 'Erreur lors du paiement Stripe');
    } finally {
      setIsPaying(false);
      setIsConfirmPaymentOpen(false);
    }
  };

  const handleCompleteGroup = async () => {
    if (!canManage) return;
    
    setIsCompleting(true);
    try {
      const groupRef = doc(db, 'groups', group.id);
      await updateDoc(groupRef, {
        status: 'completed'
      });
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
          </div>
          <p className="text-muted-foreground mt-1">{group.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {group.status === 'active' && (
            <Button 
              variant="default" 
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleStripePayment}
              disabled={isPaying}
            >
              {isPaying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4 mr-2" />
              )}
              Cotiser avec Stripe
            </Button>
          )}
          {canManage && group.status === 'active' && (
            <Button 
              variant="outline" 
              className="border-green-600 text-green-600 hover:bg-green-50"
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Cotisation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{group.contributionAmount.toLocaleString()} {group.currency}</div>
            <p className="text-xs text-muted-foreground mt-1">{group.frequency}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Membres</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{group.members.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Participants actifs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Prochain Payout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{format(new Date(group.nextPayoutDate), 'dd MMM', { locale: fr })}</div>
            <p className="text-xs text-muted-foreground mt-1">Cycle {group.currentPayoutIndex + 1}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Pot Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(group.contributionAmount * group.members.length).toLocaleString()} {group.currency}</div>
            <p className="text-xs text-muted-foreground mt-1">Par cycle</p>
          </CardContent>
        </Card>
      </div>

      {/* Share & QR Code Card */}
      <Card className="border-amber-200 bg-amber-50/15 overflow-hidden">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            
            {/* Left Sub-panel: Share details */}
            <div className="md:col-span-8 space-y-4">
              <div className="space-y-1">
                <Badge className="bg-[#E67E22] text-white font-black tracking-widest text-[10px] uppercase">Partage Rapide</Badge>
                <h3 className="text-xl font-extrabold text-slate-950 tracking-tight">Lien d'Invitation & Accès PWA</h3>
                <p className="text-slate-600 text-xs">
                  Partagez ce lien personnalisé avec vos proches pour qu'ils rejoignent instantanément votre cercle de cotisation eganyé.
                </p>
              </div>

              {/* Copyable Invitation Link */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400">Lien personnalisé du cercle</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/?join=${group.joinCode}`}
                    className="flex-1 bg-white border border-slate-200 text-slate-700 text-xs px-3.5 py-2 rounded-xl focus:outline-none"
                  />
                  <Button
                    size="sm"
                    variant={copiedLink ? "default" : "outline"}
                    className={`rounded-xl transition-all ${copiedLink ? 'bg-[#2BB673] text-white border-[#2BB673]' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
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
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Code unique du cercle</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black tracking-wider text-[#4B2E05] bg-[#F5E6D3]/80 px-2.5 py-1 rounded-lg border border-[#D4A574]/30">
                      {group.joinCode}
                    </span>
                    <button
                      onClick={() => {
                        if (group.joinCode) {
                          navigator.clipboard.writeText(group.joinCode);
                          setCopiedCode(true);
                          toast.success("Code de cercle copié !");
                          setTimeout(() => setCopiedCode(false), 2000);
                        }
                      }}
                      className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                      title="Copier le code"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-[#2BB673]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Canaux de partage</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[10px] font-bold text-[#E67E22] bg-[#E67E22]/10 hover:bg-[#E67E22]/20 rounded-lg px-2.5"
                      onClick={() => {
                        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Rejoins mon cercle d'épargne eganyé en cliquant sur ce lien : ${window.location.origin}/?join=${group.joinCode}`)}`, '_blank');
                      }}
                    >
                      WhatsApp
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[10px] font-bold text-sky-600 bg-sky-50 hover:bg-sky-100 rounded-lg px-2.5"
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
            <div className="md:col-span-4 flex flex-col items-center justify-center bg-white p-4 rounded-2xl border border-slate-200/60 shadow-inner space-y-2">
              <div className="relative border-4 border-slate-900 rounded-xl p-1.5 bg-white">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}/?join=${group.joinCode}`)}`}
                  alt="Code QR d'invitation"
                  className="w-32 h-32 md:w-36 md:h-36"
                />
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-amber-500 p-1.5 rounded-lg border-2 border-white shadow-md">
                  <QrCode className="w-5 h-5 text-slate-950" />
                </div>
              </div>
              <span className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1">
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
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs">
                        {memberId.charAt(0)}
                      </div>
                      <span>Utilisateur {memberId}</span>
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
                      <div className="flex items-center justify-end gap-1 text-green-600 text-sm">
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

      {/* Stripe contribution confirmation bottom sheet */}
      <ConfirmationBottomSheet
        isOpen={isConfirmPaymentOpen}
        onClose={() => setIsConfirmPaymentOpen(false)}
        onConfirm={executeStripePayment}
        title="Confirmer la cotisation"
        description={`Vous allez effectuer une opération de transfert de ${group.contributionAmount.toLocaleString()} ${group.currency} vers le cercle d'épargne "${group.name}".`}
        amount={group.contributionAmount}
        currency={group.currency}
        type="transfer"
        isLoading={isPaying}
      />
    </div>
  );
}
