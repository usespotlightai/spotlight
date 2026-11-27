import { type ReactElement, type SubmitEvent, useId, useState } from 'react';

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
import { useSetSecretValue } from '@/hooks/api/useSetSecretValue';
import { useDelayedValue } from '@/hooks/useDelayedValue';
import {
  allowsSandbox,
  setValueLabel,
  type WorkspaceSecret,
} from '@/lib/secret';

const CLOSING_MS = 150;

type SetSecretValueDialogProps = {
  slug: string | undefined;
  secret: WorkspaceSecret | null;
  onClose: () => void;
};

export function SetSecretValueDialog({
  slug,
  secret,
  onClose,
}: SetSecretValueDialogProps): ReactElement {
  const setValue = useSetSecretValue(slug);
  const valueId = useId();
  const [value, setTyped] = useState('');
  const shown = useDelayedValue(secret, CLOSING_MS);

  const busy = setValue.isPending;
  const sendable = value.length > 0 && !busy;

  const submit = (event: SubmitEvent) => {
    event.preventDefault();

    if (!secret || !sendable) {
      return;
    }

    setValue.mutate(
      { name: secret.name, value },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Dialog
      open={secret !== null}
      onOpenChange={(open) => !open && onClose()}
      onOpenChangeComplete={(open) => {
        if (!open) {
          setTyped('');
          setValue.reset();
        }
      }}
    >
      <DialogContent className="flex flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {shown && `${setValueLabel(shown)} of ${shown.name}`}
          </DialogTitle>
          <DialogDescription>
            Spotlight encrypts the value and never shows it again.{' '}
            {shown && allowsSandbox(shown)
              ? 'Egress sends it to the secret’s hosts, and runs whose harness profile names it in env get it in their sandbox.'
              : 'Egress sends it only to the secret’s hosts.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={valueId}
              className="font-medium text-foreground text-xs"
            >
              Value
            </label>
            <FieldInput
              id={valueId}
              name="value"
              type="password"
              required
              autoFocus
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              value={value}
              onChange={(event) => setTyped(event.target.value)}
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              Cancel
            </DialogClose>
            <Button type="submit" size="sm" disabled={!sendable}>
              {busy ? 'Saving…' : 'Save value'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
