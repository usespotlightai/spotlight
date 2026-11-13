import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartTip } from '@/components/shared/chart/ChartTip';
import { ResponsiveChart } from '@/components/shared/chart/ResponsiveChart';
import { type TipPlacement, useCursorTooltip } from '@/hooks/useCursorTooltip';
import {
  formatDay,
  formatPercent,
  formatStat,
  type ScoreKind,
  sharesOn,
  type TrendPoint,
} from '@/lib/judge';

const TREND_HEIGHT = 176;

const scoreOf = (kind: ScoreKind, value: number | null): string =>
  sharesOn(kind) ? formatPercent(value) : formatStat(value);

const TipContent = ({
  placement,
  active,
  payload,
  kind,
}: {
  placement: TipPlacement;
  active?: boolean;
  payload?: { payload: TrendPoint }[];
  kind: ScoreKind;
}) => {
  const point = payload?.[0]?.payload;

  if (!active || !point) {
    return null;
  }

  return (
    <ChartTip
      placement={placement}
      note={{
        title: formatDay(point.day),
        rows: [
          ['Judge', `${scoreOf(kind, point.judge)} over ${point.judged}`],
          ['People', `${scoreOf(kind, point.people)} over ${point.labelled}`],
        ],
      }}
    />
  );
};

export function JudgeTrend({
  trend,
  kind,
}: {
  trend: readonly TrendPoint[];
  kind: ScoreKind;
}) {
  const cursor = useCursorTooltip();
  if (trend.length === 0) {
    return null;
  }

  return (
    <figure data-slot="judge-trend" className="flex flex-1 flex-col gap-1">
      <figcaption className="flex items-center gap-3 text-muted-foreground text-xs">
        <span data-slot="judge-trend-judge" className="flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-full bg-chart-primary" />
          Judge
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-full bg-chart-2" />
          People
        </span>
      </figcaption>

      <div className="[&_*:focus:not(:focus-visible)]:outline-none">
        <div {...cursor.area}>
          <ResponsiveChart height={TREND_HEIGHT}>
            <LineChart
              data={[...trend]}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            >
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-grid)' }}
                tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                tickFormatter={formatDay}
                minTickGap={24}
              />
              <YAxis
                domain={sharesOn(kind) ? [0, 1] : [1, 5]}
                ticks={sharesOn(kind) ? [0, 0.5, 1] : [1, 3, 5]}
                tickFormatter={(value: number) => scoreOf(kind, value)}
                tickLine={false}
                axisLine={false}
                width={40}
                tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
              />
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <Tooltip
                {...cursor.tooltip}
                content={
                  <TipContent placement={cursor.placement} kind={kind} />
                }
                cursor={{ stroke: 'var(--chart-grid)' }}
              />
              <Line
                dataKey="judge"
                name="Judge"
                stroke="var(--chart-primary)"
                strokeWidth={1.5}
                dot={{ r: 2 }}
                isAnimationActive={false}
              />
              <Line
                dataKey="people"
                name="People"
                stroke="var(--chart-2)"
                strokeWidth={1.5}
                dot={{ r: 2 }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveChart>
        </div>
      </div>
    </figure>
  );
}
