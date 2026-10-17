import { TriangleAlert } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ENFORCEMENT_LABELS, ENFORCEMENT_TOLD } from '@/lib/run-network';

const SHOWN = `Egress ${ENFORCEMENT_LABELS['not-enforced'].toLowerCase()}`;

export function TraceEgressMark() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            data-slot="trace-egress-mark"
            className="relative z-10 ml-1 flex shrink-0 cursor-default items-center rounded-sm text-amber-600 outline-none focus-visible:ring-2 focus-visible:ring-ring/70 dark:text-amber-400"
          />
        }
      >
        <TriangleAlert aria-hidden className="size-3" />
        <span className="sr-only">{SHOWN}</span>
      </TooltipTrigger>
      <TooltipContent className="flex max-w-80 flex-col gap-1">
        <span className="font-medium">{SHOWN}</span>
        <span>{ENFORCEMENT_TOLD['not-enforced']}</span>
      </TooltipContent>
    </Tooltip>
  );
}
