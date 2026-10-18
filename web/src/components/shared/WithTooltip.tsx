import { type ReactElement, useId } from 'react';
import { createPortal } from 'react-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type WithTooltipProps = {
  tooltip: string;
  children: ReactElement<Record<string, unknown>>;
};

export function WithTooltip({ tooltip, children }: WithTooltipProps) {
  const tooltipId = useId();

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={children}
          tabIndex={0}
          aria-describedby={tooltipId}
          className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
        />
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
      {createPortal(
        <span id={tooltipId} hidden>
          {tooltip}
        </span>,
        document.body,
      )}
    </>
  );
}
