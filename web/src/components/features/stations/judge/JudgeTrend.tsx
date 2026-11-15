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
import { formatDay, formatPercent, type TrendPoint } from '@/lib/judge';

const TREND_HEIGHT = 176;

const TipContent = ({
  placement,
  active,
  payload,
}: {
  placement: TipPlacement;
  active?: boolean;
  payload?: { payload: TrendPoint }[];
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
          ['Judge', `${formatPercent(point.judge)} of ${point.judged} runs`],
          [
            'People',
            `${formatPercent(point.people)} of ${point.labelled} runs`,
          ],
        ],
      }}
    />
  );
};

export function JudgeTrend({ trend }: { trend: readonly TrendPoint[] }) {
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
                domain={[0, 1]}
                ticks={[0, 0.5, 1]}
                tickFormatter={(value: number) => formatPercent(value)}
                tickLine={false}
                axisLine={false}
                width={40}
                tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
              />
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <Tooltip
                {...cursor.tooltip}
                content={<TipContent placement={cursor.placement} />}
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
