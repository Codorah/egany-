import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, doc, updateDoc, addDoc, serverTimestamp, onSnapshot, orderBy, where } from 'firebase/firestore';
import { Group, UserProfile, Contribution } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, CheckCircle2, Clock, AlertCircle, Plus, FileText, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ContributionsManagerProps {
  group: Group;
  user: UserProfile;
  onBack: () => void;
}

export function ContributionsManager({ group, user, onBack }: ContributionsManagerProps) {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const isManager = user.uid === group.creatorId || user.role === 'admin';

  useEffect(() => {
    const fetchMembers = async () => {
      if (!isManager) return;
      try {
        const membersData: UserProfile[] = [];
        for (const uid of group.members) {
          const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
          if (!userDoc.empty) {
            membersData.push(userDoc.docs[0].data() as UserProfile);
          }
        }
        setMembers(membersData);
      } catch (error) {
        console.error("Error fetching members:", error);
      }
    };

    fetchMembers();

    let q = query(
      collection(db, 'groups', group.id, 'contributions'),
      orderBy('date', 'desc')
    );

    if (!isManager) {
      q = query(
        collection(db, 'groups', group.id, 'contributions'),
        where('userId', '==', user.uid),
        orderBy('date', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const contributionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Contribution));
      setContributions(contributionsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [group.id, group.members, isManager, user.uid]);

  const handleUpdateStatus = async (contributionId: string, newStatus: 'paid' | 'pending' | 'late' | 'pending_approval') => {
    try {
      await updateDoc(doc(db, 'groups', group.id, 'contributions', contributionId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success("Statut mis à jour !");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Erreur lors de la mise à jour.");
    }
  };

  const handleSubmitProof = async (contributionId: string, reference: string) => {
    try {
      await updateDoc(doc(db, 'groups', group.id, 'contributions', contributionId), {
        status: 'pending_approval',
        proofOfPayment: {
          reference,
          submittedAt: new Date().toISOString()
        },
        updatedAt: serverTimestamp()
      });
      toast.success("Preuve de paiement soumise ! En attente de validation.");
    } catch (error) {
      console.error("Error submitting proof:", error);
      toast.error("Erreur lors de la soumission.");
    }
  };

  const handleCreateContribution = async (userId: string, userName: string, userEmail?: string) => {
    try {
      const contributionData = {
        groupId: group.id,
        userId,
        userName,
        userEmail: userEmail || '',
        amount: group.contributionAmount,
        status: 'pending',
        date: new Date().toISOString(),
        period: formatPeriod(new Date()),
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'groups', group.id, 'contributions'), contributionData);
      toast.success(`Demande de cotisation créée pour ${userName}`);
    } catch (error) {
      console.error("Error creating contribution:", error);
      toast.error("Erreur lors de la création.");
    }
  };

  const handleRegisterPayment = async (userId: string, userName: string, userEmail?: string) => {
    try {
      const contributionData = {
        groupId: group.id,
        userId,
        userName,
        userEmail: userEmail || '',
        amount: group.contributionAmount,
        status: 'paid',
        date: new Date().toISOString(),
        period: formatPeriod(new Date()),
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'groups', group.id, 'contributions'), contributionData);
      toast.success(`Paiement enregistré pour ${userName}`);
    } catch (error) {
      console.error("Error registering payment:", error);
      toast.error("Erreur lors de l'enregistrement du paiement.");
    }
  };

  const formatPeriod = (date: Date) => {
    const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Payé</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">En attente</Badge>;
      case 'late':
        return <Badge variant="destructive">En retard</Badge>;
      case 'pending_approval':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 animate-pulse">En vérification</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isManager ? 'Gestion des Cotisations' : 'Mes Cotisations'}
            </h1>
            <p className="text-muted-foreground">{group.name} • {group.contributionAmount.toLocaleString()} {group.currency}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className={isManager ? "lg:col-span-2" : "lg:col-span-3"}>
          <CardHeader>
            <CardTitle>{isManager ? 'Historique des Paiements' : 'Mes Paiements'}</CardTitle>
            <CardDescription>
              {isManager 
                ? 'Liste de toutes les cotisations enregistrées pour ce groupe.' 
                : 'Historique de vos versements pour ce cercle.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  {isManager && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {contributions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isManager ? 5 : 4} className="text-center py-8 text-muted-foreground">
                      Aucune cotisation trouvée.
                    </TableCell>
                  </TableRow>
                ) : (
                  contributions.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.userName || 'Membre'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.userEmail || '-'}</TableCell>
                      <TableCell>{c.period}</TableCell>
                      <TableCell>{c.amount.toLocaleString()} {group.currency}</TableCell>
                      <TableCell>{getStatusBadge(c.status)}</TableCell>
                      {isManager && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {c.status === 'pending_approval' && (
                              <div className="flex gap-1 mr-2">
                                <Button 
                                  size="icon" 
                                  variant="outline" 
                                  className="h-8 w-8 text-green-600 border-green-200 hover:bg-green-50"
                                  onClick={() => handleUpdateStatus(c.id, 'paid')}
                                  title="Approuver le paiement"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="outline" 
                                  className="h-8 w-8 text-red-600 border-red-200 hover:bg-red-50"
                                  onClick={() => handleUpdateStatus(c.id, 'pending')}
                                  title="Rejeter la preuve"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                            <Select 
                              value={c.status} 
                              onValueChange={(val: any) => handleUpdateStatus(c.id, val)}
                            >
                              <SelectTrigger className="w-[130px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="paid">Payé</SelectItem>
                                <SelectItem value="pending">En attente</SelectItem>
                                <SelectItem value="late">En retard</SelectItem>
                                <SelectItem value="pending_approval">Vérification</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                      )}
                      {!isManager && (
                        <TableCell className="text-right">
                          {(c.status === 'pending' || c.status === 'late') && (
                            <DeclarePaymentDialog 
                              contribution={c} 
                              onSubmit={(ref) => handleSubmitProof(c.id, ref)} 
                            />
                          )}
                          {c.status === 'pending_approval' && (
                            <span className="text-xs text-muted-foreground italic">
                              Réf: {c.proofOfPayment?.reference}
                            </span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {isManager && (
          <Card>
            <CardHeader>
              <CardTitle>Membres du Cercle</CardTitle>
              <CardDescription>Initialiser une nouvelle cotisation pour un membre.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {members.map((member) => (
                <div key={member.uid} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {member.displayName.charAt(0)}
                    </div>
                    <div className="text-sm">
                      <p className="font-medium">{member.displayName}</p>
                      <p className="text-xs text-muted-foreground">Score: {member.reputationScore}/100</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-7 text-[10px] px-2"
                      onClick={() => handleCreateContribution(member.uid, member.displayName, member.email)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Appel
                    </Button>
                    <Button 
                      size="sm" 
                      variant="default" 
                      className="h-7 text-[10px] px-2 bg-green-600 hover:bg-green-700"
                      onClick={() => handleRegisterPayment(member.uid, member.displayName, member.email)}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Payer
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function DeclarePaymentDialog({ 
  contribution, 
  onSubmit 
}: { 
  contribution: Contribution, 
  onSubmit: (reference: string) => void 
}) {
  const [reference, setReference] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference.trim()) {
      toast.error("Veuillez saisir une référence (ex: ID Orange Money, Wave...)");
      return;
    }
    onSubmit(reference.trim());
    setIsOpen(false);
    setReference('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={
        <Button size="sm" variant="outline" className="h-8 gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Déclarer
        </Button>
      } />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Déclarer un paiement</DialogTitle>
          <DialogDescription>
            Saisissez la référence du transfert (Mobile Money, Virement, etc.) pour que l'administrateur puisse valider votre cotisation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reference">Référence de transaction</Label>
            <Input 
              id="reference" 
              placeholder="Ex: OM-20230512-8271, WAVE-..."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button type="submit">Envoyer le justificatif</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
