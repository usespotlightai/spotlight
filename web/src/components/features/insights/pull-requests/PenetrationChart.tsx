import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PENETRATION_SERIES } from '@/components/features/insights/chart-series';
import { ChartTip } from '@/components/shared/chart/ChartTip';
import { type TipPlacement, useCursorTooltip } from '@/hooks/useCursorTooltip';
import { formatShare } from '@/lib/insights';
import type { WeekShare } from '@/lib/insights-pull-requests';
import { formatDay } from '@/lib/judge';

export const PENETRATION_CHART_HEIGHT = 180;

const Said = ({
  placement,
  active,
  payload,
}: {
  placement: TipPlacement;
  active?: boolean;
  payload?: { payload: WeekShare }[];
}) => {
  const bar = payload?.[0]?.payload;

  if (!active || !bar) {
    return null;
  }

  return (
    <ChartTip placement={placement}>
      <p className="text-muted-foreground">Week of {formatDay(bar.week)}</p>
      {PENETRATION_SERIES.map((series) => (
        <p key={series.key} className="text-foreground">
          {bar[series.key]} {series.label.toLowerCase()}
        </p>
      ))}
      <p className="text-muted-foreground">
        Spotlight’s share {formatShare(bar.share)}
      </p>
    </ChartTip>
  );
};

export function PenetrationChart({ weeks }: { weeks: readonly WeekShare[] }) {
  const cursor = useCursorTooltip();
  return (
    <figure data-slot="penetration-chart" className="flex flex-col gap-1">
      <figcaption className="flex flex-wrap items-center gap-3 text-muted-foreground text-[0.7rem]">
        {PENETRATION_SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-1">
            <span
              aria-hidden
              className="size-2 rounded-sm"
              style={{ background: series.fill }}
            />
            {series.label}
          </span>
        ))}
      </figcaption>

      <div className="[&_*:focus:not(:focus-visible)]:outline-none">
        <div {...cursor.area}>
          <ResponsiveContainer width="100%" height={PENETRATION_CHART_HEIGHT}>
            <BarChart
              data={[...weeks]}
              margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
            >
              <XAxis
                dataKey="week"
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-grid)' }}
                tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
                tickFormatter={formatDay}
                minTickGap={24}
              />
              <YAxis hide allowDecimals={false} />
              <Tooltip
                {...cursor.tooltip}
                content={<Said placement={cursor.placement} />}
                cursor={{ fill: 'var(--accent)' }}
              />
              {PENETRATION_SERIES.map((series) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  name={series.label}
                  stackId="merged"
                  fill={series.fill}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </figure>
  );
}
