import { Check, Copy } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { IntegrationLogo } from '@/components/features/integrations/IntegrationLogo';
import { Pill } from '@/components/shared/Pill';
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
import { useSetSecret } from '@/hooks/api/useSetSecret';
import { useCopied } from '@/hooks/useCopied';
import type { ConfiguredIntegrationResponseDto } from '@/lib/api';

type IntegrationDialogProps = {
  integration: ConfiguredIntegrationResponseDto;
  teamId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * What a host still needs from a person: the address to send to, and the
 * secret it signs with. Held here rather than on the card, so a card is the
 * same size whether or not its host is listening.
 */
export function IntegrationDialog({
  integration,
  teamId,
  open,
  onOpenChange,
}: IntegrationDialogProps) {
  const [value, setValue] = useState('');
  const set = useSetSecret(teamId);

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (value.trim()) {
      set.mutate(
        { name: integration.secret, value },
        {
          onSuccess: () => {
            setValue('');
            onOpenChange(false);
          },
        },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Wider than the default: it holds a delivery address that
          would otherwise be read a third at a time. */}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IntegrationLogo source={integration.source} />
            {integration.name}
          </DialogTitle>

          <DialogDescription>
            Point {integration.name} at this address and set the secret it signs
            with. Nothing is listening until both are done.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="contents">
          <div className="flex flex-col gap-4">
            <Field label="Send deliveries to">
              <Address address={integration.deliverTo} />
            </Field>

            <Field label="Webhook secret">
              {/* Takes a secret and does not give it back. Once set, the field
                  is empty and says so: a row of dots would only suggest there
                  were something to read. */}
              <input
                type="password"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={
                  integration.secretSet ? 'Replace' : 'Paste the webhook secret'
                }
                aria-label="Webhook secret"
                autoComplete="off"
                className="h-8 rounded-md border-[0.5px] border-border bg-background px-2.5 text-foreground text-sm outline-none placeholder:text-muted-foreground focus-visible:border-input"
              />
            </Field>

            {integration.happenings.length > 0 && (
              <Field label="What it can wait for">
                <div className="flex flex-wrap gap-1.5">
                  {integration.happenings.map((raised) => (
                    <Pill key={raised.happening}>{raised.label}</Pill>
                  ))}
                </div>
              </Field>
            )}
          </div>

          {set.error && (
            <p className="text-destructive text-xs">{set.error.message}</p>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              size="sm"
              disabled={set.isPending || value.trim().length === 0}
            >
              {set.isPending
                ? 'Saving…'
                : integration.secretSet
                  ? 'Replace'
                  : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </div>
  );
}

function Address({ address }: { address: string }) {
  const { copied, copy } = useCopied();

  return (
    <span className="flex h-8 min-w-0 items-center gap-2 rounded-md border-[0.5px] border-border bg-background pr-0.5 pl-2.5">
      <span className="min-w-0 flex-1 truncate text-foreground text-sm">
        {address}
      </span>

      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => copy(address)}
        aria-label="Copy the address"
        className="bg-card"
      >
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
  );
}
