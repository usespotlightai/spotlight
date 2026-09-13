import { spentOn, took } from '@/lib/inbox';
import { laidOut, type Trace, type TraceNode } from '@/lib/trace';
import { cn } from '@/lib/utils';

const LEAST_WIDTH = 0.4;

export const LABEL_ROOM = 128;

const fills: Record<string, string> = {
  agent: 'bg-primary',
  overhead: 'bg-faint',
  failed: 'bg-destructive',
};

export function TraceBar({ node, trace }: { node: TraceNode; trace: Trace }) {
  const { left, width } = laidOut(node, trace);

  const drawn = Math.max(width, LEAST_WIDTH);

  return (
    <div
      className="pointer-events-none relative min-w-0 flex-1 self-stretch"
      style={{ marginRight: LABEL_ROOM }}
    >
      <div
        className={cn(
          'absolute h-2 rounded-[2px]',
          fills[node.tone] ?? 'bg-faint',
        )}
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
