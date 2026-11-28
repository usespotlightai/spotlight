import { type ReactElement, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { TooltipNoteContent } from '@/components/shared/TooltipNoteContent';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { type TooltipText, tooltipText } from '@/lib/tooltip-note';

export type TooltipTarget = {
  tooltip: TooltipText;
  named?: string;
  children: ReactElement<Record<string, unknown>>;
};

type TappableTooltipProps = TooltipTarget & {
  delay: number;
  trackCursorAxis: 'none' | 'x';
};

export function TappableTooltip({
  tooltip,
  named,
  delay,
  trackCursorAxis,
  children,
}: TappableTooltipProps) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const tapped = useRef(false);

  return (
    <>
      <Tooltip
        trackCursorAxis={trackCursorAxis}
        open={open}
        onOpenChange={(next, { reason }) => {
          if (!(tapped.current && reason === 'trigger-press')) {
            setOpen(next);
          }
        }}
      >
        <TooltipTrigger
          render={children}
          delay={delay}
          tabIndex={0}
          aria-describedby={tooltipId}
          className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          onPointerDown={(event) => {
            tapped.current = event.pointerType !== 'mouse';
          }}
          onKeyDown={() => {
            tapped.current = false;
          }}
          onClick={() => {
            if (tapped.current) {
              setOpen((shown) => !shown);
            }
          }}
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
