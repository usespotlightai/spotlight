import { ChevronRight } from 'lucide-react';
import { TraceBar } from '@/components/trace/TraceBar';
import { TraceIcon } from '@/components/trace/TraceIcon';
import type { Row, Trace } from '@/lib/trace';
import { cn } from '@/lib/utils';

const INDENT = 14;

type TraceRowProps = {
  row: Row;
  trace: Trace;
  /** How much of the row its name takes, before the bars begin. */
  names: number;
  picked: boolean;
  open: boolean;
  onPick: () => void;
  onToggle: () => void;
};

export function TraceRow({
  row,
  trace,
  names,
  picked,
  open,
  onPick,
  onToggle,
}: TraceRowProps) {
  const { node, depth, children } = row;

  return (
    <li
      className={cn(
        'group relative flex h-7 items-center text-sm',
        picked ? 'bg-selected' : 'hover:bg-accent',
      )}
    >
      <div
        className="flex min-w-0 shrink-0 items-center gap-1 pr-3"
        style={{ width: names, paddingLeft: depth * INDENT + 8 }}
      >
        {children > 0 ? (
          <button
            type="button"
            onClick={onToggle}
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
          onClick={onPick}
          className={cn(
            'min-w-0 truncate text-left outline-none after:absolute after:inset-0',
            node.tone === 'failed' ? 'text-destructive' : 'text-foreground',
          )}
        >
          {node.name}
        </button>
      </div>

      <TraceBar node={node} trace={trace} />
    </li>
  );
}
