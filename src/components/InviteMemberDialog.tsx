import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { UserPlus, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface InviteMemberDialogProps {
  groupId: string;
  groupName: string;
  joinCode?: string;
}

export function InviteMemberDialog({ joinCode }: InviteMemberDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const inviteLink = `${window.location.origin}?join=${joinCode}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success("Lien d'invitation copié !");
    setTimeout(() => setCopied(false), 2000);
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
            Partagez le lien d'invitation avec vos proches.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          <Label>Lien d'invitation</Label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={inviteLink}
              className="bg-muted font-mono text-xs"
            />
            <Button size="icon" variant="outline" onClick={copyToClipboard}>
              {copied ? <Check className="w-4 h-4 text-secondary" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Partagez ce lien via WhatsApp, Snapchat ou Instagram.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
