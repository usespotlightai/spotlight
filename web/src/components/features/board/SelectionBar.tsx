import { X } from 'lucide-react';
import { StationIcon } from '@/components/features/board/column/StationIcon';
import { Button } from '@/components/ui/button';

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
}: SelectionBarProps) {
  if (count === 0) {
    return null;
  }

  return (
    <div
      data-slot="selection-bar"
      className="-translate-x-1/2 absolute bottom-4 left-1/2 z-20 flex animate-in items-center gap-1 rounded-full border-[0.5px] border-border bg-popover py-1.5 px-2 shadow-overlay duration-150 fade-in slide-in-from-bottom-2 ease-out-quad"
    >
      <span className="px-2 text-muted-foreground text-xs tabular-nums">
        {count} selected
      </span>

      {moveTo && (
        <Button
          variant="outline"
          size="sm"
          onClick={onMove}
          className="rounded-full bg-card shadow-none"
        >
          <StationIcon share={moveTo.share} className="text-muted-foreground" />
          Move to {moveTo.name}
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClear}
        aria-label="Clear selection"
        className="rounded-full"
      >
        <X />
      </Button>
    </div>
  );
}
