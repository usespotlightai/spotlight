import { type ReactElement, useId } from 'react';
import { createPortal } from 'react-dom';
import { TooltipNoteContent } from '@/components/shared/TooltipNoteContent';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { type TooltipText, tooltipText } from '@/lib/tooltip-note';

type WithTooltipProps = {
  tooltip: TooltipText;
  named?: string;
  children: ReactElement<Record<string, unknown>>;
};

export function WithTooltip({ tooltip, named, children }: WithTooltipProps) {
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
        <TooltipContent>
          {typeof tooltip === 'string' ? (
            tooltip
          ) : (
            <TooltipNoteContent note={tooltip} />
          )}
        </TooltipContent>
      </Tooltip>
      {createPortal(
        <span id={tooltipId} hidden>
          {tooltipText(tooltip, named)}
        </span>,
        document.body,
      )}
    </>
  );
}
