import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SharedDraft } from '@/hooks/useSharedDraft';

export function DraftOffline({ shared }: { shared: SharedDraft }) {
  if (shared.online) {
    return null;
  }

  return (
    <span className="ml-auto flex items-center">
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="text-muted-foreground text-xs outline-none" />
          }
        >
          Offline
        </TooltipTrigger>
        <TooltipContent className="text-xs">
          Your changes stay here. They go to the others when the connection
          comes back.
        </TooltipContent>
      </Tooltip>
    </span>
  );
}
