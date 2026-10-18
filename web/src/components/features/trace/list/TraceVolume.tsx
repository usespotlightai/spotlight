import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TraceLegend } from '@/components/features/trace/list/TraceLegend';
import { ChartTip } from '@/components/shared/chart/ChartTip';
import { type TipPlacement, useCursorTooltip } from '@/hooks/useCursorTooltip';
import type { TraceVolumeBucketResponseDto } from '@/lib/api';
import { spanned } from '@/lib/trace-list';

const HEIGHT = 180;

const TOOLTIP_WIDTH = 208;

const TOP_ROOM = 8;

const DAY_MS = 86_400_000;

const tickOf = (at: string, spanMs: number): string =>
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
  payload?: { value: string };
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
    fill="var(--chart-axis)"
    fontSize={10}
    textAnchor={
      index === 0 ? 'start' : index === visibleTicksCount - 1 ? 'end' : 'middle'
    }
  >
    {payload ? tickOf(payload.value, spanMs) : null}
  </text>
);

const TipContent = ({
  placement,
  active,
  payload,
}: {
  placement: TipPlacement;
  active?: boolean;
  payload?: { payload: TraceVolumeBucketResponseDto }[];
}) => {
  const bucket = payload?.[0]?.payload;

  if (!active || !bucket) {
    return null;
  }

  return (
    <ChartTip placement={placement} style={{ width: TOOLTIP_WIDTH }}>
      <p className="text-muted-foreground tabular-nums">
        {spanned(bucket.from, bucket.to)}
      </p>
      <p className="pt-0.5 text-foreground">
        {bucket.count} {bucket.count === 1 ? 'trace' : 'traces'}
      </p>
      <p className="text-muted-foreground">
        {bucket.errors} {bucket.errors === 1 ? 'error' : 'errors'}
      </p>
    </ChartTip>
  );
};

export function TraceVolume({
  volume,
  from,
  to,
}: {
  volume: readonly TraceVolumeBucketResponseDto[];
  from: string;
  to: string;
}) {
  const buckets = [...volume];
  const spanMs = Date.parse(to) - Date.parse(from);
  const cursor = useCursorTooltip();
  const max = Math.max(
    ...buckets.map((each) => Math.max(each.errors, each.count)),
    1,
  );

  if (buckets.length === 0) {
    return null;
  }

  return (
    <div className="px-2 pt-2 pb-1">
      <TraceLegend />

      <div
        {...cursor.area}
        className="[&_*:focus:not(:focus-visible)]:outline-none"
      >
        <ResponsiveContainer width="100%" height={HEIGHT}>
          <BarChart
            data={buckets}
            barGap={0}
            margin={{ top: TOP_ROOM, right: 8, bottom: 0, left: 8 }}
          >
            <XAxis
              dataKey="from"
              tickLine={false}
              axisLine={{ stroke: 'var(--chart-grid)' }}
              minTickGap={32}
              tickFormatter={(at: string) => tickOf(at, spanMs)}
              tick={<DateTick spanMs={spanMs} />}
            />

            <YAxis hide domain={[0, Math.max(max, 1)]} />

            <Tooltip
              {...cursor.tooltip}
              content={<TipContent placement={cursor.placement} />}
              cursor={{ fill: 'var(--accent)' }}
            />

            <Bar
              dataKey="count"
              name="Traces"
              fill="var(--chart-primary)"
              isAnimationActive={false}
            />
            <Bar
              dataKey="errors"
              name="Errors"
              fill="var(--destructive)"
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
