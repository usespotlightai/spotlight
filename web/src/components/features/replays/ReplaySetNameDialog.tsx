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
import { messageOf } from '@/lib/error';

const LONGEST_NAME = 100;

type ReplaySetNameDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  name?: string;
  submit: string;
  submitting: string;
  pending: boolean;
  error: unknown;
  onSubmit: (name: string) => void;
  onClosed: () => void;
};

export function ReplaySetNameDialog({
  open,
  onOpenChange,
  title,
  description,
  name: initial = '',
  submit,
  submitting,
  pending,
  error,
  onSubmit,
  onClosed,
}: ReplaySetNameDialogProps) {
  const nameId = useId();
  const errorId = useId();
  const [name, setName] = useState(initial);
  const named = name.trim();

  const send = (event: FormEvent) => {
    event.preventDefault();

    if (named && !pending) {
      onSubmit(named);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(settled) => {
        if (!settled) {
          setName(initial);
          onClosed();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={send} className="contents">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={nameId}
              className="font-medium text-foreground text-xs"
            >
              Name
            </label>
            <FieldInput
              id={nameId}
              name="name"
              required
              autoFocus
              autoComplete="off"
              placeholder="Queue fixes"
              maxLength={LONGEST_NAME}
              disabled={pending}
              aria-describedby={error ? errorId : undefined}
              aria-invalid={Boolean(error)}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          {Boolean(error) && (
            <p id={errorId} role="alert" className="text-destructive text-xs">
              {messageOf(error)}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              Cancel
            </DialogClose>
            <Button type="submit" size="sm" disabled={!named || pending}>
              {pending ? submitting : submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
