import { LABEL_ROOM } from '@/components/features/trace/view/TraceBar';
import { TICKS } from '@/components/features/trace/view/TraceScale';

export function TraceGrid() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0"
      style={{ left: 'var(--names)', right: LABEL_ROOM }}
    >
      {TICKS.map((tick) => (
        <span
          key={tick}
          className="absolute inset-y-0 w-[0.5px] bg-border"
          style={tick === 1 ? { right: 0 } : { left: `${tick * 100}%` }}
        />
      ))}
    </div>
  );
}
