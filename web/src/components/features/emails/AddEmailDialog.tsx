import { type FormEvent, useId, useState } from 'react';
import { FieldInput } from '@/components/shared/form/FieldInput';
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
import { useAddMyEmail } from '@/hooks/api/useAddMyEmail';
import { messageOf } from '@/lib/error';

const LONGEST_EMAIL = 254;

type AddEmailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddEmailDialog({ open, onOpenChange }: AddEmailDialogProps) {
  const add = useAddMyEmail();
  const emailId = useId();
  const [email, setEmail] = useState('');

  const written = email.trim();
  const busy = add.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (!written || busy) {
      return;
    }

    add.mutate(written, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(open) => {
        if (!open) {
          setEmail('');
          add.reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add an email</DialogTitle>
          <DialogDescription>
            Spotlight sends a verification link to this address. After you open
            it, Spotlight knows you by this address, for example in Slack.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="contents">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={emailId}
              className="font-medium text-foreground text-xs"
            >
              Email
            </label>
            <FieldInput
              id={emailId}
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              spellCheck={false}
              placeholder="you@work.example.com"
              maxLength={LONGEST_EMAIL}
              disabled={busy}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                add.isError && add.reset();
              }}
            />
          </div>

          {add.isError && (
            <p role="alert" className="text-destructive text-xs">
              {messageOf(add.error, 'Sorry, the email couldn’t be added.')}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              Cancel
            </DialogClose>
            <Button type="submit" size="sm" disabled={!written || busy}>
              {busy ? 'Sending…' : 'Send verification link'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
