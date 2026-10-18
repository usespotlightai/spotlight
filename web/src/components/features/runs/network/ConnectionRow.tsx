import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { sized } from '@/lib/attachment';
import {
  CONNECTION_OUTCOME_LABELS,
  type ConnectionGroup,
  ERROR_LABELS,
  formatTraffic,
  OUTCOME_DESCRIPTION,
} from '@/lib/run-network';
import { cn } from '@/lib/utils';

export function ConnectionRow({ group }: { group: ConnectionGroup }) {
  const shown = group.error
    ? ERROR_LABELS[group.error]
    : CONNECTION_OUTCOME_LABELS[group.outcome];

  return (
    <li data-slot="connection" data-outcome={group.outcome}>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className="-mx-2 flex h-7 w-[calc(100%+1rem)] cursor-default items-center gap-3 rounded-md px-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/70"
            />
          }
        >
          <span className="w-28 shrink-0 truncate text-muted-foreground text-xs">
            {group.destination}
          </span>
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-sm tabular-nums',
              group.error ? 'text-destructive' : 'text-foreground',
            )}
          >
            {group.error ? shown : sized(group.bytesIn + group.bytesOut)}
          </span>
        </TooltipTrigger>
        <TooltipContent className="flex max-w-80 flex-col gap-1">
          <span className="font-medium">{group.destination}</span>
          <span>
            {shown} · {group.count}{' '}
            {group.count === 1 ? 'connection' : 'connections'}
          </span>
          <span>{OUTCOME_DESCRIPTION[group.outcome]}</span>
          <span>{formatTraffic(group)}</span>
        </TooltipContent>
      </Tooltip>
    </li>
  );
}
