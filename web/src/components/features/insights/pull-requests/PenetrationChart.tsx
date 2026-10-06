import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTip } from '@/components/shared/chart/ChartTip';
import { type TipPlacement, useCursorTooltip } from '@/hooks/useCursorTooltip';
import { shareShown } from '@/lib/insights';
import type { WeekBar } from '@/lib/insights-pull-requests';
import { dayShown } from '@/lib/judge';

const HEIGHT = 180;

const SERIES = [
  { key: 'made', label: 'Made by Spotlight', fill: 'var(--chart-primary)' },
  { key: 'touched', label: 'Reviewed by Spotlight', fill: 'var(--chart-4)' },
  { key: 'people', label: 'People alone', fill: 'var(--chart-1)' },
  { key: 'bots', label: 'Bots alone', fill: 'var(--chart-2)' },
] as const;

const Said = ({
  placement,
  active,
  payload,
}: {
  placement: TipPlacement;
  active?: boolean;
  payload?: { payload: WeekBar }[];
}) => {
  const bar = payload?.[0]?.payload;

  if (!active || !bar) {
    return null;
  }

  return (
    <ChartTip placement={placement}>
      <p className="text-muted-foreground">Week of {dayShown(bar.week)}</p>
      {SERIES.map((series) => (
        <p key={series.key} className="text-foreground">
          {bar[series.key]} {series.label.toLowerCase()}
        </p>
      ))}
      <p className="text-muted-foreground">
        Spotlight’s share {shareShown(bar.share)}
      </p>
    </ChartTip>
  );
};

export function PenetrationChart({ bars }: { bars: readonly WeekBar[] }) {
  const cursor = useCursorTooltip();
  return (
    <figure data-slot="penetration-chart" className="flex flex-col gap-1">
      <figcaption className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
        {SERIES.map((series) => (
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
          <ResponsiveContainer width="100%" height={HEIGHT}>
            <BarChart
              data={[...bars]}
              margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
            >
              <XAxis
                dataKey="week"
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-grid)' }}
                tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
                tickFormatter={dayShown}
                minTickGap={24}
              />
              <YAxis hide allowDecimals={false} />
              <Tooltip
                {...cursor.tooltip}
                content={<Said placement={cursor.placement} />}
                cursor={{ fill: 'var(--accent)' }}
              />
              {SERIES.map((series) => (
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
