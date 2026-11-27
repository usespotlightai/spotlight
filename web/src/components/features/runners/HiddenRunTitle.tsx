import type { ReactElement } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const STAND_IN = 'Tidy the retry handling';

export function HiddenRunTitle({ tip }: { tip: string }): ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger
        data-slot="hidden-run"
        className="min-w-0 cursor-default truncate rounded-sm px-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          aria-hidden
          className="select-none text-muted-foreground blur-[3px]"
        >
          {STAND_IN}
        </span>
        <span className="sr-only">{tip}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{tip}</TooltipContent>
    </Tooltip>
  );
}
