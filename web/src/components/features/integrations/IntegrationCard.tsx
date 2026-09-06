import { useState } from 'react';
import { IntegrationDialog } from '@/components/features/integrations/IntegrationDialog';
import { IntegrationLogo } from '@/components/features/integrations/IntegrationLogo';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { Shown } from '@/lib/integrations';
import { cn } from '@/lib/utils';

type IntegrationCardProps = {
  shown: Shown;
  teamId: string | undefined;
  /** Whether this team will be listening to it once the change is read. */
  selected: boolean;
  onToggle: () => void;
};

/**
 * One host, written down or not, and the same size either way: what it still
 * needs from a person is a dialog away rather than filling the card.
 */
export function IntegrationCard({
  shown,
  teamId,
  selected,
  onToggle,
}: IntegrationCardProps) {
  const held = shown.integration;
  const [configuring, setConfiguring] = useState(false);

  return (
    <article
      className={cn(
        'relative flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors',
        selected ? 'border-foreground/25' : 'border-border',
      )}
    >
      {/* The card is the control. Everything drawn on it lets the click
          through, so only what is itself a control takes one. */}
      <button
        type="button"
        aria-pressed={selected}
        onClick={onToggle}
        className="absolute inset-0 rounded-lg outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="sr-only">
          {selected
            ? `Stop listening to ${shown.name}`
            : `Listen to ${shown.name}`}
        </span>
      </button>

      <div className="pointer-events-none relative flex flex-1 flex-col gap-3">
        <div className="flex items-start gap-2.5">
          <IntegrationLogo source={shown.source} className="mt-px" />

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h3 className="font-medium text-foreground text-sm">
              {shown.name}
            </h3>
            <p className="text-muted-foreground text-xs leading-5">
              {shown.summary}
            </p>
          </div>

          {/* The card carries the click and the name; this only shows how it
              stands, so it is not a second thing to reach for. */}
          <Checkbox
            checked={selected}
            tabIndex={-1}
            aria-hidden
            className="mt-0.5"
          />
        </div>

        {/* The room the button takes is held on every card, so one host
            having something to configure does not make its card taller. */}
        <div className="mt-auto flex h-7 items-center justify-end">
          {held && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfiguring(true)}
              className="pointer-events-auto rounded-full bg-card shadow-none"
            >
              Configure
            </Button>
          )}
        </div>
      </div>

      {held && (
        <IntegrationDialog
          integration={held}
          teamId={teamId}
          open={configuring}
          onOpenChange={setConfiguring}
        />
      )}
    </article>
  );
}
