import type { ReactNode } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type FlaggedCellProps = {
  reason: string;
  children: ReactNode;
};

export function FlaggedCell({ reason, children }: FlaggedCellProps) {
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
        {children}
      </TooltipTrigger>
      <TooltipContent className="max-w-80 break-words">{reason}</TooltipContent>
    </Tooltip>
  );
}
