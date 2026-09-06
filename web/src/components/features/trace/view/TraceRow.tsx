import { ChevronRight } from 'lucide-react';
import { memo } from 'react';
import { TraceBar } from '@/components/features/trace/view/TraceBar';
import { TraceIcon } from '@/components/features/trace/view/TraceIcon';
import type { Trace, TraceNode } from '@/lib/trace';
import { cn } from '@/lib/utils';

const INDENT = 14;

type TraceRowProps = {
  node: TraceNode;
  depth: number;
  holding: number;
  trace: Trace;
  picked: boolean;
  open: boolean;
  onPick: (id: string) => void;
  onToggle: (id: string) => void;
};

/**
 * Held against re-rendering: a trace is hundreds of rows, and it is told what
 * to call rather than given a new closure each time, so the guard holds.
 */
export const TraceRow = memo(function TraceRow({
  node,
  depth,
  holding,
  trace,
  picked,
  open,
  onPick,
  onToggle,
}: TraceRowProps) {
  return (
    <li
      className={cn(
        'group relative flex h-7 items-center rounded-md text-sm transition-colors',
        picked ? 'bg-selected' : 'hover:bg-accent',
      )}
    >
      <div
        className="flex min-w-0 shrink-0 items-center gap-1 pr-3"
        // The width is read from the lane rather than passed in, so dragging
        // the names wider is a repaint and not four hundred re-renders.
        style={{ width: 'var(--names)', paddingLeft: depth * INDENT + 8 }}
      >
        {holding > 0 ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            aria-expanded={open}
            aria-label={open ? `Fold ${node.name}` : `Unfold ${node.name}`}
            className="relative z-10 flex shrink-0 items-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight
              className={cn(
                'size-3 transition-transform duration-200',
                open && 'rotate-90',
              )}
            />
          </button>
        ) : (
          <span className="size-3 shrink-0" aria-hidden />
        )}

        <TraceIcon node={node} />

        <button
          type="button"
          onClick={() => onPick(node.id)}
          className={cn(
            'min-w-0 truncate text-left outline-none after:absolute after:inset-0',
            node.tone === 'failed'
              ? 'text-destructive'
              : 'text-muted-foreground',
          )}
        >
          {node.name}
        </button>
      </div>

      <TraceBar node={node} trace={trace} />
    </li>
  );
});
