import { took } from '@/lib/inbox';
import { laidOut, type Trace, type TraceNode } from '@/lib/trace';
import { cn } from '@/lib/utils';

/** Bars any thinner than this cannot be read, and cannot be hit either. */
const LEAST_WIDTH = 0.4;

const fills: Record<string, string> = {
  agent: 'bg-primary',
  overhead: 'bg-faint',
  failed: 'bg-destructive',
};

/** Length carries how long it took, which leaves colour free to say what sort. */
export function TraceBar({
  node,
  trace,
  labelled = true,
}: {
  node: TraceNode;
  trace: Trace;
  /** A glance has no room for a number beside every bar. */
  labelled?: boolean;
}) {
  const { left, width } = laidOut(node, trace);

  return (
    <div className="relative min-w-0 flex-1 pr-3">
      <div
        className={cn(
          'absolute h-2 rounded-[4px]',
          fills[node.tone] ?? 'bg-faint',
        )}
        style={{
          left: `${left}%`,
          width: `${Math.max(width, LEAST_WIDTH)}%`,
          top: -4,
        }}
      />

      {labelled && (
        <span
          className="absolute whitespace-nowrap pl-1.5 text-muted-foreground text-xs tabular-nums"
          style={{
            // Held clear of the right edge by as much as the longest a
            // duration reads: "23m 58s" wraps in anything narrower.
            left: `min(${left + width}%, calc(100% - 4.5rem))`,
            top: -9,
          }}
        >
          {took(node.to - node.from)}
        </span>
      )}
    </div>
  );
}
