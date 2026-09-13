import { type FormEvent, useState } from 'react';
import { CopyField } from '@/components/shared/CopyField';
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
import { useEnrolRunner } from '@/hooks/api/useEnrolRunner';

type Enrolled = { id: string; name: string; token: string };

type NewRunnerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NewRunnerDialog({ open, onOpenChange }: NewRunnerDialogProps) {
  const [name, setName] = useState('');
  const [enrolled, setEnrolled] = useState<Enrolled | null>(null);
  const enrol = useEnrolRunner();

  // Reset after the close animation, or the token flips back to the form mid-animation.
  const forget = () => {
    setName('');
    setEnrolled(null);
    enrol.reset();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || enrol.isPending) {
      return;
    }

    enrol.mutate(
      { name: name.trim() },
      { onSuccess: (runner) => runner && setEnrolled(runner) },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(settled) => !settled && forget()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{enrolled ? enrolled.name : 'New runner'}</DialogTitle>

          <DialogDescription>
            {enrolled
              ? 'The runner needs this token to connect. It is shown once and cannot be recovered afterwards.'
              : 'Create a new runner to execute workloads. Choose a name that makes this runner easy to identify.'}
          </DialogDescription>
        </DialogHeader>

        {enrolled ? (
          <Token token={enrolled.token} onDone={() => onOpenChange(false)} />
        ) : (
          <Naming
            name={name}
            onName={setName}
            pending={enrol.isPending}
            error={enrol.error?.message}
            onSubmit={submit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type NamingProps = {
  name: string;
  onName: (name: string) => void;
  pending: boolean;
  error?: string;
  onSubmit: (event: FormEvent) => void;
};

function Naming({ name, onName, pending, error, onSubmit }: NamingProps) {
  return (
    <form onSubmit={onSubmit} className="contents">
      <div className="flex flex-col gap-2">
        <FieldInput
          autoFocus
          value={name}
          onChange={(event) => onName(event.target.value)}
          placeholder="Name"
          aria-label="Runner name"
          maxLength={60}
        />
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}

      <DialogFooter>
        <DialogClose render={<Button variant="outline" size="sm" />}>
          Cancel
        </DialogClose>
        <Button type="submit" size="sm" disabled={pending || !name.trim()}>
          {pending ? 'Creating…' : 'Create runner'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Token({ token, onDone }: { token: string; onDone: () => void }) {
  return (
    <>
      <CopyField value={token} copyLabel="Copy token" />

      <DialogFooter>
        <Button size="sm" onClick={onDone}>
          Done
        </Button>
      </DialogFooter>
    </>
  );
}
