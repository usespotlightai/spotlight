import { MousePointer2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type TraceSelectionBarProps = {
  count: number;
  onDiscuss: () => void;
  onClear: () => void;
};

export function TraceSelectionBar({
  count,
  onDiscuss,
  onClear,
}: TraceSelectionBarProps) {
  if (count === 0) {
    return null;
  }

  return (
    <div className="-translate-x-1/2 absolute bottom-4 left-1/2 z-20 flex animate-in items-center gap-1 rounded-full border-[0.5px] border-border bg-popover px-2 py-1.5 shadow-overlay duration-150 fade-in slide-in-from-bottom-2 ease-out-quad">
      <span className="px-2 text-muted-foreground text-xs tabular-nums">
        {count} selected
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={onDiscuss}
        className="rounded-full bg-card shadow-none"
      >
        <MousePointer2 className="size-3.5 text-muted-foreground" aria-hidden />
        Discuss with the agent
      </Button>

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
