import { useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { bucketMsOf, windowOf } from '@/lib/range';
import type { Traced } from '@/lib/trace-list';
import { type Bucket, bucketed, spanned, startedOn } from '@/lib/trace-list';
import { cn } from '@/lib/utils';

const HEIGHT = 132;

const NUDGE = { x: 14, y: 12 };

/**
 * What the tooltip takes, held to the pixel: guessing it means the flip
 * overshoots by however wrong the guess was, leaving the box adrift of the
 * pointer it belongs to.
 *
 * Wide enough for the longest a bucket can read — "28 Sept, 23:58 – 29 Sept,
 * 10:44" measures 180px at this size, and the padding takes 22 — so no line
 * ever wraps and the box never changes shape as the numbers in it do.
 */
const TOOLTIP_WIDTH = 208;

const TICKS_AT_MOST = 5;

const TOP_ROOM = 8;

const CORNER: [number, number, number, number] = [4, 4, 0, 0];

const LEGEND = [
  { name: 'Traces', swatch: 'bg-primary' },
  { name: 'Faults', swatch: 'bg-destructive/55' },
] as const;

const AXIS = {
  stroke: 'var(--border)',
  tick: { fill: 'var(--faint)', fontSize: 10 },
} as const;

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
  const buckets = bucketed(traces, windowOf(range), bucketMsOf(range));
  const held = useRef<HTMLDivElement>(null);
  const most = Math.max(
    ...buckets.map((each) => Math.max(each.faults, each.count)),
    1,
  );
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);

  if (buckets.length === 0) {
    return null;
  }

  // Recharts would otherwise settle the tooltip on the bar under the pointer
  // and ease it there, which reads as lag. Following the pointer itself is
  // what makes a dense chart feel like it is answering.
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
    <div className="border-border border-b-[0.5px] px-2 pt-2 pb-1">
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

      {/* Measured here rather than outside the padding, because this is the
          box the tooltip is placed within.

          Recharts makes the chart and each of its layers focusable for
          keyboard readers, which means a mouse click paints a ring around
          whichever one was hit. Taken away only for the click: reaching them
          by keyboard still shows where you are. */}
      <div ref={held} className="[&_*:focus:not(:focus-visible)]:outline-none">
        <ResponsiveContainer width="100%" height={HEIGHT}>
          <BarChart
            data={buckets}
            barGap={0}
            // Room above the topmost line: with none, its label would be
            // clipped by the edge, so it is nudged down off its own line.
            margin={{ top: TOP_ROOM, right: 8, bottom: 0, left: 0 }}
            // The state recharts hands over carries the bar's coordinate, not
            // the pointer's. The pointer is on the event.
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
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="0"
            />

            <XAxis
              dataKey="from"
              tickLine={false}
              axisLine={{ stroke: AXIS.stroke }}
              tick={AXIS.tick}
              minTickGap={48}
              tickFormatter={(at: number) =>
                startedOn(new Date(at).toISOString())
              }
            />

            {/* Left to itself recharts ladders these as 0, 1, 2, 4 on a
                quiet week: a skipped integer reads as a misdrawn axis. */}
            <YAxis
              width={28}
              // Pinned only while the numbers are small enough for every
              // whole one to have a line. Past that, a domain of exactly the
              // highest bar ladders as 0, 8, 16, 30; recharts rounds better.
              domain={most <= TICKS_AT_MOST ? [0, most] : [0, 'auto']}
              ticks={
                most <= TICKS_AT_MOST
                  ? Array.from({ length: most + 1 }, (_, at) => at)
                  : undefined
              }
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={AXIS.tick}
            />

            <Tooltip
              content={<Said />}
              cursor={{ fill: 'var(--accent)' }}
              position={following()}
              isAnimationActive={false}
              wrapperStyle={{ pointerEvents: 'none' }}
            />

            <Bar
              dataKey="count"
              name="Traces"
              fill="var(--primary)"
              radius={CORNER}
              isAnimationActive={false}
            />
            <Bar
              radius={CORNER}
              dataKey="faults"
              name="Faults"
              fill="var(--destructive)"
              fillOpacity={0.55}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
