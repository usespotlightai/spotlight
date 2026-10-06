import { type FormEvent, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useInviteToTeam } from '@/hooks/api/useInviteToTeam';

type InviteMemberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string | undefined;
};

export function InviteMemberDialog({
  open,
  onOpenChange,
  teamId,
}: InviteMemberDialogProps) {
  const invite = useInviteToTeam(teamId);
  const [email, setEmail] = useState('');
  const fieldId = useId();
  const field = useRef<HTMLInputElement>(null);

  const forget = () => {
    setEmail('');
    invite.reset();
  };

  const wanted = email.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (wanted.length === 0 || invite.isPending) {
      return;
    }
    invite.mutate(wanted, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(settled) => !settled && forget()}
    >
      <DialogContent initialFocus={field}>
        <DialogHeader>
          <DialogTitle>Add a member</DialogTitle>
          <DialogDescription>
            They get a link by email. They join by signing in with that address.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="contents">
          <div className="rounded-lg border-[0.5px] border-border bg-card p-1 focus-within:border-ring">
            <input
              id={fieldId}
              ref={field}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={invite.isPending}
              spellCheck={false}
              autoComplete="off"
              placeholder="name@example.com"
              aria-label="Email address"
              className="h-7 w-full min-w-0 rounded-md bg-transparent px-2 text-foreground text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              size="sm"
              disabled={invite.isPending || wanted.length === 0}
            >
              {invite.isPending ? 'Sending…' : 'Send invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
