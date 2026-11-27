import { ChevronDown } from 'lucide-react';

import type { StackLayer } from '@/lib/change-stack';
import { cn } from '@/lib/utils';

type StackNavToggleProps = {
  layer: StackLayer;
  at: number;
  count: number;
  open: boolean;
  onToggle: () => void;
};

export function StackNavToggle({
  layer,
  at,
  count,
  open,
  onToggle,
}: StackNavToggleProps) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="flex h-11 w-full shrink-0 items-center gap-2.5 px-4 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-inset @2xl/pane:hidden"
    >
      <span
        title={layer.title}
        className="min-w-0 flex-1 truncate font-medium text-foreground"
      >
        {layer.title}
      </span>
      <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
        {at} of {count}
      </span>
      <ChevronDown
        aria-hidden
        className={cn(
          'size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none',
          open && 'rotate-180',
        )}
      />
    </button>
  );
}
