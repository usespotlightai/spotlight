import { TriangleAlert } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ENFORCEMENT_DESCRIPTION, ENFORCEMENT_LABELS } from '@/lib/run-network';

const SHOWN = `Egress ${ENFORCEMENT_LABELS['not-enforced'].toLowerCase()}`;

export function TraceEgressMark() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- the trigger renders this button around its children
          <button
            type="button"
            data-slot="trace-egress-mark"
            className="relative z-10 ml-1 flex shrink-0 cursor-default items-center rounded-sm text-outcome-failed outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          />
        }
      >
        <TriangleAlert aria-hidden className="size-3" />
        <span className="sr-only">{SHOWN}</span>
      </TooltipTrigger>
      <TooltipContent className="flex max-w-80 flex-col gap-1">
        <span className="font-medium">{SHOWN}</span>
        <span>{ENFORCEMENT_DESCRIPTION['not-enforced']}</span>
      </TooltipContent>
    </Tooltip>
  );
}
