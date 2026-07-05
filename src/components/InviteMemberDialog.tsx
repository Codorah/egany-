import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { UserPlus } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Copy, Check } from 'lucide-react';

const inviteSchema = z.object({
  email: z.string().email("Veuillez entrer une adresse email valide."),
});

type InviteValues = z.infer<typeof inviteSchema>;

interface InviteMemberDialogProps {
  groupId: string;
  groupName: string;
  joinCode?: string;
}

export function InviteMemberDialog({ groupId, groupName, joinCode }: InviteMemberDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
    },
  });

  const inviteLink = `${window.location.origin}?join=${joinCode}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success("Lien d'invitation copié !");
    setTimeout(() => setCopied(false), 2000);
  };

  const onSubmit = async (values: InviteValues) => {
    if (!auth.currentUser) {
      toast.error("Vous devez être connecté pour inviter des membres.");
      return;
    }

    try {
      const invitationData = {
        groupId,
        groupName, // Helpful for the invitee to see which group they are invited to
        inviterId: auth.currentUser.uid,
        inviterName: auth.currentUser.displayName,
        inviteeEmail: values.email.toLowerCase().trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'invitations'), invitationData);
      toast.success(`Invitation envoyée à ${values.email}`);
      setOpen(false);
      reset();
    } catch (error) {
      console.error("Error sending invitation:", error);
      toast.error("Erreur lors de l'envoi de l'invitation.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="flex items-center gap-2" />}>
        <UserPlus className="w-4 h-4" />
        Inviter des membres
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Inviter un nouveau membre</DialogTitle>
          <DialogDescription>
            Partagez le lien d'invitation ou envoyez une invitation par email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Lien d'invitation</Label>
            <div className="flex gap-2">
              <Input 
                readOnly 
                value={inviteLink} 
                className="bg-muted font-mono text-xs"
              />
              <Button size="icon" variant="outline" onClick={copyToClipboard}>
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Partagez ce lien via WhatsApp, Snapchat ou Instagram.
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Ou par email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Adresse Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="exemple@email.com" 
                {...register("email")} 
                disabled={isSubmitting}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Envoi..." : "Envoyer l'invitation"}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
