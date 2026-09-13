import { useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { bucketMsOf, windowOf } from '@/lib/range';
import type { Traced } from '@/lib/trace-list';
import { type Bucket, bucketed, spanned } from '@/lib/trace-list';
import { cn } from '@/lib/utils';

const HEIGHT = 132;

const NUDGE = { x: 14, y: 12 };

// Exact width the tooltip flip relies on: the longest bucket label (180px) plus padding.
const TOOLTIP_WIDTH = 208;

const TOP_ROOM = 8;

const DAY_MS = 86_400_000;

const tickOf = (at: number, spanMs: number): string =>
  spanMs <= DAY_MS
    ? new Date(at).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date(at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });

type DateTickProps = {
  x?: number | string;
  y?: number | string;
  payload?: { value: number };
  index?: number;
  visibleTicksCount?: number;
  spanMs: number;
};

const DateTick = ({
  x,
  y,
  payload,
  index = 0,
  visibleTicksCount = 0,
  spanMs,
}: DateTickProps) => (
  <text
    x={x}
    y={y}
    dy="0.71em"
    fill="var(--faint)"
    fontSize={10}
    textAnchor={
      index === 0 ? 'start' : index === visibleTicksCount - 1 ? 'end' : 'middle'
    }
  >
    {payload ? tickOf(payload.value, spanMs) : null}
  </text>
);

const LEGEND = [
  { name: 'Traces', swatch: 'bg-primary' },
  { name: 'Faults', swatch: 'bg-destructive' },
] as const;

const Said = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Bucket }[];
}) => {
  const bucket = payload?.[0]?.payload;

  if (!active || !bucket) {
    return null;
  }

  return (
    <div
      className="whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-overlay"
      style={{ width: TOOLTIP_WIDTH }}
    >
      <p className="text-muted-foreground tabular-nums">
        {spanned(bucket.from, bucket.to)}
      </p>
      <p className="pt-0.5 text-foreground">
        {bucket.count} {bucket.count === 1 ? 'trace' : 'traces'}
      </p>
      <p className="text-muted-foreground">
        {bucket.faults} {bucket.faults === 1 ? 'fault' : 'faults'}
      </p>
    </div>
  );
};

export function TraceVolume({
  traces,
  range,
}: {
  traces: readonly Traced[];
  range: string;
}) {
  // Date.now() on every hover render would shift every bucket, and the axis with it.
  const { buckets, spanMs } = useMemo(() => {
    const shown = windowOf(range);

    return {
      buckets: bucketed(traces, shown, bucketMsOf(range)),
      spanMs: shown.to - shown.from,
    };
  }, [traces, range]);
  const held = useRef<HTMLDivElement>(null);
  const most = Math.max(
    ...buckets.map((each) => Math.max(each.faults, each.count)),
    1,
  );
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);

  if (buckets.length === 0) {
    return null;
  }

  // Follows the pointer; Recharts' own positioning snaps to the bar and eases, which lags.
  const following = () => {
    if (!at) {
      return undefined;
    }

    const width = held.current?.clientWidth ?? 0;
    const room = at.x + NUDGE.x + TOOLTIP_WIDTH < width;

    return {
      x: room ? at.x + NUDGE.x : at.x - NUDGE.x - TOOLTIP_WIDTH,
      y: at.y + NUDGE.y,
    };
  };

  return (
    <div className="px-2 pt-2 pb-1">
      <div className="flex items-center justify-end gap-3 pr-2 pb-1">
        {LEGEND.map((each) => (
          <span
            key={each.name}
            className="flex items-center gap-1.5 text-muted-foreground text-xs"
          >
            <span
              className={cn('size-2 rounded-full', each.swatch)}
              aria-hidden
            />
            {each.name}
          </span>
        ))}
      </div>

      {/* Recharts layers are focusable, so hide the focus ring on click but keep focus-visible. */}
      <div ref={held} className="[&_*:focus:not(:focus-visible)]:outline-none">
        <ResponsiveContainer width="100%" height={HEIGHT}>
          <BarChart
            data={buckets}
            barGap={0}
            margin={{ top: TOP_ROOM, right: 8, bottom: 0, left: 8 }}
            // Recharts' state carries the bar's coordinate, not the pointer's.
            onMouseMove={(_, event) => {
              const box = held.current?.getBoundingClientRect();

              if (box) {
                setAt({
                  x: event.clientX - box.left,
                  y: event.clientY - box.top,
                });
              }
            }}
            onMouseLeave={() => setAt(null)}
          >
            <XAxis
              dataKey="from"
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              minTickGap={32}
              tickFormatter={(at: number) => tickOf(at, spanMs)}
              tick={<DateTick spanMs={spanMs} />}
            />

            <YAxis hide domain={[0, Math.max(most, 1)]} />

            <Tooltip
              content={<Said />}
              cursor={{ fill: 'var(--accent)' }}
              position={following()}
              isAnimationActive={false}
              wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }}
            />

            <Bar
              dataKey="count"
              name="Traces"
              fill="var(--primary)"
              isAnimationActive={false}
            />
            <Bar
              dataKey="faults"
              name="Faults"
              fill="var(--destructive)"
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
