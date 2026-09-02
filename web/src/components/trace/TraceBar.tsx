import { spentOn, took } from '@/lib/inbox';
import { laidOut, type Trace, type TraceNode } from '@/lib/trace';
import { cn } from '@/lib/utils';

const LEAST_WIDTH = 0.4;

/**
 * Room kept clear to the right of every lane, wide enough for the longest a
 * length and a cost read together. Bars stop at the edge of it, so a bar that
 * runs the whole trace still has somewhere to print what it took. Shared with
 * the scale above them: two numbers that have to agree are one number.
 */
export const LABEL_ROOM = 128;

const fills: Record<string, string> = {
  agent: 'bg-primary',
  overhead: 'bg-faint',
  failed: 'bg-destructive',
};

export function TraceBar({ node, trace }: { node: TraceNode; trace: Trace }) {
  const { left, width } = laidOut(node, trace);

  // What is drawn, not what was measured: a bar held open to stay hittable
  // would otherwise have its length printed on top of it.
  const drawn = Math.max(width, LEAST_WIDTH);

  return (
    // Stretched to the row's height, so both are centred against one line.
    <div
      className="relative min-w-0 flex-1 self-stretch"
      style={{ marginRight: LABEL_ROOM }}
    >
      <div
        className={cn('absolute h-2', fills[node.tone] ?? 'bg-faint')}
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
        {took(node.ms)}
        {node.cost !== null && (
          <span className="pl-3">∑{spentOn(node.cost)}</span>
        )}
      </span>
    </div>
  );
}
