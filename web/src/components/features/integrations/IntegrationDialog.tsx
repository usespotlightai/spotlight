import { Check, Copy } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { IntegrationLogo } from '@/components/features/integrations/IntegrationLogo';
import { Pill } from '@/components/shared/Pill';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useConnectIntegration } from '@/hooks/api/useConnectIntegration';
import { useSetSecret } from '@/hooks/api/useSetSecret';
import { useCopied } from '@/hooks/useCopied';
import type {
  ConfiguredIntegrationResponseDto,
  ConfiguredSecretResponseDto,
} from '@/lib/api';

type IntegrationDialogProps = {
  integration: ConfiguredIntegrationResponseDto;
  teamId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * What a host still needs from a person: the address to send to, and the
 * secrets it reads. Held here rather than on the card, so a card is the same
 * size whether or not its host is listening.
 */
export function IntegrationDialog({
  integration,
  teamId,
  open,
  onOpenChange,
}: IntegrationDialogProps) {
  const set = useSetSecret(teamId);

  // What has been typed into each secret's field, until it is saved. Held here
  // rather than per field, so one button at the bottom saves them together.
  const [typed, setTyped] = useState<Record<string, string>>({});

  const pending = integration.secrets
    .map((secret) => ({
      name: secret.name,
      value: (typed[secret.name] ?? '').trim(),
    }))
    .filter((each) => each.value.length > 0);

  const save = async () => {
    try {
      for (const secret of pending) {
        await set.mutateAsync({ name: secret.name, value: secret.value });
      }
      setTyped({});
      onOpenChange(false);
    } catch {
      // Left open with the error shown, so nothing is lost to a closed dialog.
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
            Point {integration.name} at this address and set the secrets it
            reads. Nothing is listening until they are done.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field label="Send deliveries to">
            <Address address={integration.deliverTo} />
          </Field>

          {integration.connectable && (
            <ConnectField integration={integration} teamId={teamId} />
          )}

          {integration.secrets.map((secret) => (
            <SecretField
              key={secret.name}
              secret={secret}
              value={typed[secret.name] ?? ''}
              onChange={(value) =>
                setTyped((held) => ({ ...held, [secret.name]: value }))
              }
              onEnter={save}
            />
          ))}

          {integration.happenings.length > 0 && (
            <Field label="What it can wait for">
              <div className="flex flex-wrap gap-1.5">
                {integration.happenings.map((raised) => (
                  <Pill key={raised.happening}>{raised.label}</Pill>
                ))}
              </div>
            </Field>
          )}

          {set.error && (
            <p className="text-destructive text-xs">{set.error.message}</p>
          )}
        </div>

        <DialogFooter>
          <Button size="sm" onClick={save} disabled={set.isPending}>
            {set.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The team's link to a host it authorizes rather than pastes a secret for.
 * Connected, it says who the host took the team to be; not, it offers to begin.
 */
function ConnectField({
  integration,
  teamId,
}: {
  integration: ConfiguredIntegrationResponseDto;
  teamId: string | undefined;
}) {
  const connect = useConnectIntegration(teamId);
  const connection = integration.connection;

  return (
    <Field label={`Connection to ${integration.name}`}>
      {connection ? (
        <span className="flex h-8 items-center gap-2 rounded-md border-[0.5px] border-border bg-background px-2.5">
          <Check className="size-3.5 text-emerald-600" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-foreground text-sm">
            Connected{connection.handle ? ` as ${connection.handle}` : ''}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => connect.mutate(integration.source)}
            disabled={connect.isPending}
            className="bg-card"
          >
            {connect.isPending ? 'Opening…' : 'Reconnect'}
          </Button>
        </span>
      ) : (
        <div className="flex items-center gap-2">
          <p className="flex-1 text-muted-foreground text-xs leading-5">
            Authorize Spotlight to act as this team in {integration.name}.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={() => connect.mutate(integration.source)}
            disabled={connect.isPending}
          >
            {connect.isPending ? 'Opening…' : `Connect to ${integration.name}`}
          </Button>
        </div>
      )}
      {connect.error && (
        <p className="text-destructive text-xs">{connect.error.message}</p>
      )}
    </Field>
  );
}

/** One secret the host reads: set once, replaceable, never read back. */
function SecretField({
  secret,
  value,
  onChange,
  onEnter,
}: {
  secret: ConfiguredSecretResponseDto;
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
}) {
  return (
    <Field label={secret.name}>
      {/* Takes a secret and does not give it back. Once set, the field is
          empty and says so: a row of dots would only suggest there were
          something to read. */}
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onEnter();
          }
        }}
        placeholder={secret.set ? 'Paste to replace' : 'Paste the secret'}
        aria-label={secret.name}
        autoComplete="off"
        className="h-8 w-full rounded-md border-[0.5px] border-border bg-background px-2.5 text-foreground text-sm outline-none placeholder:text-muted-foreground focus-visible:border-input"
      />
    </Field>
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
