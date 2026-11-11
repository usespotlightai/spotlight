import type { CSSProperties } from 'react';

import { TooltipNoteContent } from '@/components/shared/TooltipNoteContent';
import type { TipPlacement } from '@/hooks/useCursorTooltip';
import type { TooltipNote } from '@/lib/tooltip-note';
import { cn } from '@/lib/utils';

type ChartTipProps = {
  placement?: TipPlacement;
  style?: CSSProperties;
  note: TooltipNote;
};

export function ChartTip({ placement, style, note }: ChartTipProps) {
  return (
    <div
      style={style}
      className={cn(
        'whitespace-nowrap rounded-md bg-popover px-2.5 py-1.5 text-popover-foreground text-xs shadow-md ring-1 ring-foreground/10',
        placement?.left && '-translate-x-full',
        placement?.above && '-translate-y-full',
      )}
    >
      <TooltipNoteContent note={note} className="" />
    </div>
  );
}
