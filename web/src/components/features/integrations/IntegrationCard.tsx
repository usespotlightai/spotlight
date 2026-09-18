import { IntegrationConnect } from '@/components/features/integrations/IntegrationConnect';
import { IntegrationLogo } from '@/components/features/integrations/IntegrationLogo';
import { ConfigureLink } from '@/components/shared/ConfigureLink';
import { Checkbox } from '@/components/ui/checkbox';
import { repositoryFileUrl } from '@/lib/github';
import type { Shown } from '@/lib/integrations';
import { cn } from '@/lib/utils';

type IntegrationCardProps = {
  shown: Shown;
  teamId: string;
  repository: string | null;
  selected: boolean;
  onToggle: () => void;
};

export function IntegrationCard({
  shown,
  teamId,
  repository,
  selected,
  onToggle,
}: IntegrationCardProps) {
  const held = shown.integration;

  return (
    <article
      className={cn(
        'relative flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors',
        selected ? 'border-foreground/25' : 'border-border',
      )}
    >
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

          <Checkbox
            checked={selected}
            tabIndex={-1}
            aria-hidden
            className="mt-0.5"
          />
        </div>

        <div className="mt-auto flex h-7 items-center justify-end gap-2">
          {held?.connectable && (
            <IntegrationConnect integration={held} teamId={teamId} />
          )}
          {held && repository && (
            <ConfigureLink
              href={repositoryFileUrl(repository, held.path)}
              name={shown.name}
              className="pointer-events-auto"
            />
          )}
        </div>
      </div>
    </article>
  );
}
