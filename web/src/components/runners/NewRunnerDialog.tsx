import { Check, Copy, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useEnrolRunner } from '@/hooks/api/useEnrolRunner';
import { useCopied } from '@/hooks/useCopied';

type Enrolled = { id: string; alias: string; token: string };

type NewRunnerDialogProps = {
  /** Quiet in the page header, bordered where it is the only thing to do. */
  variant?: 'ghost' | 'outline';
  label?: string;
  icon?: boolean;
};

export function NewRunnerDialog({
  variant = 'ghost',
  label = 'New runner',
  icon = true,
}: NewRunnerDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [pool, setPool] = useState('');
  const [enrolled, setEnrolled] = useState<Enrolled | null>(null);
  const enrol = useEnrolRunner();

  const close = () => {
    setOpen(false);
    setName('');
    setPool('');
    setEnrolled(null);
    enrol.reset();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !pool.trim() || enrol.isPending) {
      return;
    }

    enrol.mutate(
      { alias: name.trim(), pool: pool.trim() },
      { onSuccess: (runner) => runner && setEnrolled(runner) },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <DialogTrigger
        render={
          <Button variant={variant} size="sm">
            {icon && <Plus className="size-3.5" aria-hidden />}
            {label}
          </Button>
        }
      />

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{enrolled ? enrolled.alias : 'New runner'}</DialogTitle>

          <DialogDescription>
            {enrolled
              ? 'The runner needs this token to connect. It is shown once and cannot be recovered afterwards.'
              : 'A runner keeps this alias across restarts. Its pool decides which work it may take.'}
          </DialogDescription>
        </DialogHeader>

        {enrolled ? (
          <Token token={enrolled.token} onDone={close} />
        ) : (
          <Naming
            name={name}
            onName={setName}
            pool={pool}
            onPool={setPool}
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
  pool: string;
  onPool: (pool: string) => void;
  pending: boolean;
  error?: string;
  onSubmit: (event: FormEvent) => void;
};

function Naming({
  name,
  onName,
  pool,
  onPool,
  pending,
  error,
  onSubmit,
}: NamingProps) {
  return (
    <form onSubmit={onSubmit} className="contents">
      <div className="flex flex-col gap-2">
        <input
          // biome-ignore lint/a11y/noAutofocus: the dialog exists to type in this
          autoFocus
          value={name}
          onChange={(event) => onName(event.target.value)}
          placeholder="Alias"
          aria-label="Runner alias"
          maxLength={60}
          className="h-8 rounded-md border-[0.5px] border-border bg-background px-2.5 text-foreground text-sm outline-none placeholder:text-muted-foreground focus-visible:border-input"
        />

        <input
          value={pool}
          onChange={(event) => onPool(event.target.value)}
          placeholder="Pool"
          aria-label="Pool"
          maxLength={60}
          className="h-8 rounded-md border-[0.5px] border-border bg-background px-2.5 text-foreground text-sm outline-none placeholder:text-muted-foreground focus-visible:border-input"
        />
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}

      <DialogFooter>
        <DialogClose render={<Button variant="outline" size="sm" />}>
          Cancel
        </DialogClose>
        <Button
          type="submit"
          size="sm"
          disabled={pending || !name.trim() || !pool.trim()}
        >
          {pending ? 'Creating…' : 'Create runner'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Token({ token, onDone }: { token: string; onDone: () => void }) {
  const { copied, copy } = useCopied();

  return (
    <>
      <span className="flex min-w-0 items-center gap-2 rounded-md border-[0.5px] border-border bg-background p-2">
        <code className="min-w-0 flex-1 truncate font-mono text-foreground text-xs">
          {token}
        </code>

        <Button
          variant="outline"
          size="sm"
          onClick={() => copy(token)}
          aria-label="Copy token"
        >
          {/* Keyed so the swap is a remount, and can be animated. */}
          <span
            key={copied ? 'copied' : 'copy'}
            className="flex animate-in items-center gap-1 duration-150 fade-in zoom-in-95 ease-out-quad"
          >
            {copied ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <Copy className="size-3.5" aria-hidden />
            )}
            {copied ? 'Copied' : 'Copy'}
          </span>
        </Button>
      </span>

      <DialogFooter>
        <Button size="sm" onClick={onDone}>
          Done
        </Button>
      </DialogFooter>
    </>
  );
}
