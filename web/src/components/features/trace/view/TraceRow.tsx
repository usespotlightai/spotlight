import { ChevronRight } from 'lucide-react';
import { memo } from 'react';
import { TraceBar } from '@/components/features/trace/view/TraceBar';
import { TraceEgressMark } from '@/components/features/trace/view/TraceEgressMark';
import { TraceRunVerdict } from '@/components/features/trace/view/TraceRunVerdict';
import { runIdOf, type Trace, type TraceNode } from '@/lib/trace';
import { cn } from '@/lib/utils';

export const INDENT = 14;

type TraceRowProps = {
  node: TraceNode;
  teamId: string;
  depth: number;
  childCount: number;
  trace: Trace;
  picked: boolean;
  open: boolean;
  onPick: (id: string) => void;
  onToggle: (id: string) => void;
};

export const TraceRow = memo(function TraceRow({
  node,
  teamId,
  depth,
  childCount,
  trace,
  picked,
  open,
  onPick,
  onToggle,
}: TraceRowProps) {
  const runId = runIdOf(node);

  return (
    <li
      className={cn(
        'group relative flex h-7 items-center rounded-md text-sm transition-colors',
        picked ? 'bg-selected' : 'hover:bg-accent',
      )}
    >
      <div
        className="flex min-w-0 shrink-0 items-center gap-1 pr-3"
        style={{ width: 'var(--names)', paddingLeft: depth * INDENT + 8 }}
      >
        {childCount > 0 ? (
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

        <button
          type="button"
          onClick={() => onPick(node.id)}
          className={cn(
            'min-w-0 truncate text-left outline-none after:absolute after:inset-0',
            node.category === 'failed'
              ? 'text-destructive'
              : 'text-muted-foreground',
          )}
        >
          {node.name}
        </button>

        {node.connection && node.connection.count > 1 && (
          <span className="ml-1 shrink-0 text-muted-foreground text-xs tabular-nums">
            ×{node.connection.count}
          </span>
        )}
        {node.egressEnforcement === 'not-enforced' && <TraceEgressMark />}
        {runId && <TraceRunVerdict teamId={teamId} runId={runId} />}
      </div>

      <TraceBar node={node} trace={trace} />
    </li>
  );
});
