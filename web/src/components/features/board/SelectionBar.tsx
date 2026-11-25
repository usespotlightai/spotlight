import { Command } from 'lucide-react';

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
  onActions: () => void;
  onClear: () => void;
};

export function SelectionBar({ count, onActions, onClear }: SelectionBarProps) {
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

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              onClick={onActions}
              className="rounded-full bg-card shadow-none"
            />
          }
        >
          <Command className="text-muted-foreground" />
          Actions
        </TooltipTrigger>
        <TooltipContent side="top">
          <ShortcutHint id="palette.open">Actions</ShortcutHint>
        </TooltipContent>
      </Tooltip>

      <ClearSelection onClear={onClear} />
    </div>
  );
}
