import { type ReactNode, useId } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type RefusalTooltipProps = {
  reason: ReactNode;
  children: (describedBy: string | undefined) => ReactNode;
};

export function RefusalTooltip({ reason, children }: RefusalTooltipProps) {
  const reasonId = useId();

  if (reason === null || reason === undefined || reason === false) {
    return children(undefined);
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            aria-describedby={reasonId}
            className="inline-flex rounded-full"
          />
        }
      >
        {children(reasonId)}
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
      <span id={reasonId} className="sr-only">
        {reason}
      </span>
    </Tooltip>
  );
}
