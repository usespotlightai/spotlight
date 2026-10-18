import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartLegend } from '@/components/features/insights/shipping/ChartLegend';
import { ChartTip } from '@/components/shared/chart/ChartTip';
import { type TipPlacement, useCursorTooltip } from '@/hooks/useCursorTooltip';
import { durationTicks, formatDurationTick } from '@/lib/insights-shipping';
import { formatDay } from '@/lib/judge';

type DaySeries = {
  readonly key: string;
  readonly label: string;
  readonly color: string;
  readonly as: 'line' | 'bar';
};

type DayChartProps = {
  label: string;
  points: readonly Record<string, string | number | null>[];
  series: readonly DaySeries[];
  format: (value: number) => string;
  durations?: boolean;
  height?: number;
  legend?: boolean;
};

const TipContent = ({
  placement,
  active,
  payload,
  series,
  format,
}: {
  placement: TipPlacement;
  active?: boolean;
  payload?: { payload: Record<string, string | number | null> }[];
  series: readonly DaySeries[];
  format: (value: number) => string;
}) => {
  const point = payload?.[0]?.payload;

  if (!active || !point) {
    return null;
  }

  return (
    <ChartTip placement={placement}>
      <p className="text-muted-foreground">{formatDay(String(point.day))}</p>
      {series.map((each) => {
        const value = point[each.key];

        return (
          <p key={each.key} className="text-foreground">
            {each.label}{' '}
            <span className="tabular-nums">
              {typeof value === 'number' ? format(value) : '–'}
            </span>
          </p>
        );
      })}
    </ChartTip>
  );
};

export function DayChart({
  label,
  points,
  series,
  format,
  durations = false,
  height = 180,
  legend = true,
}: DayChartProps) {
  const cursor = useCursorTooltip();
  const max = Math.max(
    0,
    ...points.flatMap((point) =>
      series.map((each) => {
        const value = point[each.key];
        return typeof value === 'number' ? value : 0;
      }),
    ),
  );
  const ticks = durations ? durationTicks(max) : undefined;

  return (
    <figure aria-label={label} className="flex flex-col gap-2">
      <div className="[&_*:focus:not(:focus-visible)]:outline-none">
        <div {...cursor.area}>
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart
              data={[...points]}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            >
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-grid)' }}
                tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
                tickFormatter={formatDay}
                minTickGap={32}
              />
              <YAxis
                width={44}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
                ticks={ticks}
                domain={ticks ? [0, ticks[ticks.length - 1] ?? 0] : undefined}
                allowDecimals={false}
                tickFormatter={durations ? formatDurationTick : format}
              />
              <Tooltip
                {...cursor.tooltip}
                content={
                  <TipContent
                    placement={cursor.placement}
                    series={series}
                    format={format}
                  />
                }
                cursor={{ stroke: 'var(--chart-grid)' }}
              />
              {series.map((each) =>
                each.as === 'bar' ? (
                  <Bar
                    key={each.key}
                    dataKey={each.key}
                    name={each.label}
                    fill={each.color}
                    radius={[2, 2, 0, 0]}
                    isAnimationActive={false}
                  />
                ) : (
                  <Line
                    key={each.key}
                    dataKey={each.key}
                    name={each.label}
                    stroke={each.color}
                    strokeWidth={1.5}
                    dot={{ r: 2, fill: each.color, strokeWidth: 0 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ),
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      {legend && <ChartLegend entries={series} />}
    </figure>
  );
}
