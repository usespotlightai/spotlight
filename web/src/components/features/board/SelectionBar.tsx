import type { ReactElement } from 'react';

import { StationIcon } from '@/components/features/board/column/StationIcon';
import { ClearSelection } from '@/components/shared/ClearSelection';
import { ShortcutHint } from '@/components/shared/shortcut/ShortcutHint';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type SelectionBarProps = {
  count: number;
  moveTo: { name: string; share: number } | null;
  onMove: () => void;
  onClear: () => void;
};

export function SelectionBar({
  count,
  moveTo,
  onMove,
  onClear,
}: SelectionBarProps): ReactElement | null {
  if (count === 0) {
    return null;
  }

  return (
    <div
      data-slot="selection-bar"
      className="-translate-x-1/2 absolute bottom-4 left-1/2 z-20 flex w-max max-w-[calc(100%-2rem)] animate-in items-center gap-1 rounded-full border-[0.5px] border-border bg-popover py-1.5 px-2 shadow-overlay duration-150 fade-in slide-in-from-bottom-2 ease-out-quad"
    >
      <span className="whitespace-nowrap px-2 text-muted-foreground text-xs tabular-nums">
        {count} selected
      </span>

      {moveTo && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                onClick={onMove}
                className="rounded-full bg-card shadow-none"
              />
            }
          >
            <StationIcon
              share={moveTo.share}
              className="text-muted-foreground"
            />
            Move to {moveTo.name}
          </TooltipTrigger>
          <TooltipContent side="top">
            <ShortcutHint id="task.station">Move to {moveTo.name}</ShortcutHint>
          </TooltipContent>
        </Tooltip>
      )}

      <ClearSelection onClear={onClear} />
    </div>
  );
}
