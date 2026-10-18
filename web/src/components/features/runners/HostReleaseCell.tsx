import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Host } from '@/lib/runner';

const RELEASE = 'truncate text-muted-foreground text-xs tabular-nums';

export function HostReleaseCell({ host }: { host: Host }) {
  if (!host.unavailableReason) {
    return <span className={RELEASE}>{host.release}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="min-w-0 cursor-default truncate rounded text-left text-destructive text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          />
        }
      >
        {host.release}
      </TooltipTrigger>
      <TooltipContent className="max-w-80 break-words">
        {host.unavailableReason}
      </TooltipContent>
    </Tooltip>
  );
}
