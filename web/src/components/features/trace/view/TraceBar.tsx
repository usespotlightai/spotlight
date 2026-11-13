import { formatShortDuration, spentOn } from '@/lib/inbox';
import { laidOut, type Trace, type TraceNode } from '@/lib/trace';
import { cn } from '@/lib/utils';

const MIN_WIDTH = 0.4;

export const LABEL_ROOM = 'var(--label-room)';

export const TIMELINE =
  '[--names:min(var(--names-wanted),55cqw)] [--label-room:3.5rem] @md/trace:[--names:min(var(--names-wanted),50cqw)] @md/trace:[--label-room:8rem]';

const fills: Record<TraceNode['category'], string> = {
  agent: 'bg-primary',
  overhead: 'bg-faint',
  failed: 'bg-outcome-failed',
};

export function TraceBar({ node, trace }: { node: TraceNode; trace: Trace }) {
  const { left, width } = laidOut(node, trace);

  const drawn = Math.max(width, MIN_WIDTH);

  return (
    <div
      className="pointer-events-none relative min-w-0 flex-1 self-stretch"
      style={{ marginRight: LABEL_ROOM }}
    >
      <div
        className={cn('absolute h-2 rounded-[2px]', fills[node.category])}
        style={{
          left: `${left}%`,
          width: `${drawn}%`,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />

      <span
        className="absolute whitespace-nowrap pl-1.5 text-muted-foreground text-xs tabular-nums"
        style={{
          left: `${left + drawn}%`,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      >
        {formatShortDuration(node.ms)}
        {node.cost !== null && (
          <span className="hidden pl-3 @md/trace:inline">
            ∑{spentOn(node.cost)}
          </span>
        )}
      </span>
    </div>
  );
}
