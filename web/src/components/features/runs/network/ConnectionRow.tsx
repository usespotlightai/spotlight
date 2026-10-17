import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { sized } from '@/lib/attachment';
import {
  type ConnectionGroup,
  OUTCOME_SHOWN,
  OUTCOME_TOLD,
  TROUBLE_SHOWN,
  trafficShown,
} from '@/lib/run-network';
import { cn } from '@/lib/utils';

export function ConnectionRow({ group }: { group: ConnectionGroup }) {
  const shown = group.trouble
    ? TROUBLE_SHOWN[group.trouble]
    : OUTCOME_SHOWN[group.outcome];

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
              group.trouble ? 'text-destructive' : 'text-foreground',
            )}
          >
            {group.trouble ? shown : sized(group.bytesIn + group.bytesOut)}
          </span>
        </TooltipTrigger>
        <TooltipContent className="flex max-w-80 flex-col gap-1">
          <span className="font-medium">{group.destination}</span>
          <span>
            {shown} · {group.count}{' '}
            {group.count === 1 ? 'connection' : 'connections'}
          </span>
          <span>{OUTCOME_TOLD[group.outcome]}</span>
          <span>{trafficShown(group)}</span>
        </TooltipContent>
      </Tooltip>
    </li>
  );
}
