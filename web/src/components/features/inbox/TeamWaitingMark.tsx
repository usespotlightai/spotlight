import { Users } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { WAITING_FOR_TEAM } from '@/lib/inbox';

export function TeamWaitingMark() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        className="relative z-10 flex shrink-0 text-muted-foreground"
      >
        <Users aria-hidden className="size-3.5" />
        <span className="sr-only">{WAITING_FOR_TEAM}</span>
      </TooltipTrigger>
      <TooltipContent>{WAITING_FOR_TEAM}</TooltipContent>
    </Tooltip>
  );
}
