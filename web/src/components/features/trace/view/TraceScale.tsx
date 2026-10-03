import type { ReactNode } from 'react';
import { LABEL_ROOM } from '@/components/features/trace/view/TraceBar';
import { TICKS } from '@/lib/trace';

const placed = (tick: number) =>
  tick === 1
    ? 'translateX(-100%)'
    : tick === 0
      ? undefined
      : 'translateX(-50%)';

export function TraceScale({ label }: { label: (tick: number) => ReactNode }) {
  return (
    <div className="sticky top-0 z-20 flex h-6 min-w-0 shrink-0 items-end border-border border-b-[0.5px] bg-surface px-1.5">
      <span className="shrink-0" style={{ width: 'var(--names)' }} />
      <div
        className="relative min-w-0 flex-1"
        style={{ marginRight: LABEL_ROOM }}
      >
        {TICKS.map((tick) => (
          <span
            key={tick}
            className="absolute bottom-0 whitespace-nowrap text-faint text-[10px] tabular-nums"
            style={{ left: `${tick * 100}%`, transform: placed(tick) }}
          >
            {label(tick)}
          </span>
        ))}
      </div>
    </div>
  );
}
