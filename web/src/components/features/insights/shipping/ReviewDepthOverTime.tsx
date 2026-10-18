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
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { ChartLegend } from '@/components/features/insights/shipping/ChartLegend';
import { ChartTip } from '@/components/shared/chart/ChartTip';
import { type TipPlacement, useCursorTooltip } from '@/hooks/useCursorTooltip';
import { formatShare } from '@/lib/insights';
import {
  type DepthWeek,
  formatRounds,
  ROUNDS,
  type Rounds,
  type RoundsCount,
} from '@/lib/insights-shipping';
import { formatDay } from '@/lib/judge';

const shade = (share: number): string =>
  `color-mix(in oklab, var(--chart-primary) ${share}%, var(--card))`;

const FILLS: Record<Rounds, string> = {
  '0': shade(28),
  '1': shade(52),
  '2': shade(76),
  '3+': shade(100),
};

const THROUGHPUT = 'var(--chart-5)';

const TipContent = ({
  placement,
  active,
  payload,
}: {
  placement: TipPlacement;
  active?: boolean;
  payload?: { payload: DepthWeek }[];
}) => {
  const bar = payload?.[0]?.payload;

  if (!active || !bar) {
    return null;
  }

  return (
    <ChartTip placement={placement}>
      <p className="text-muted-foreground">Week of {formatDay(bar.week)}</p>
      <p className="text-foreground">{bar.merged} merged</p>
      {ROUNDS.map((rounds) => (
        <p key={rounds} className="text-muted-foreground">
          {formatRounds(rounds)} {formatShare(bar[rounds])}
        </p>
      ))}
    </ChartTip>
  );
};

export function ReviewDepthOverTime({
  weeks,
  totals,
}: {
  weeks: readonly DepthWeek[];
  totals: readonly RoundsCount[];
}) {
  const cursor = useCursorTooltip();

  return (
    <InsightsCard
      title="Review depth as throughput climbs"
      description="Merged pull requests per week by review rounds. The line shows the total merged. If the lighter colours grow while the line rises, review is thinning."
    >
      <div className="grid gap-3 md:grid-cols-[1fr_14rem]">
        <figure
          aria-label="Review depth week by week"
          className="flex flex-col gap-2"
        >
          <div className="[&_*:focus:not(:focus-visible)]:outline-none">
            <div {...cursor.area}>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart
                  data={[...weeks]}
                  margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                  <XAxis
                    dataKey="week"
                    tickLine={false}
                    axisLine={{ stroke: 'var(--chart-grid)' }}
                    tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
                    tickFormatter={formatDay}
                  />
                  <YAxis
                    yAxisId="share"
                    width={36}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 1]}
                    tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
                    tickFormatter={formatShare}
                  />
                  <YAxis
                    yAxisId="merged"
                    orientation="right"
                    width={28}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
                  />
                  <Tooltip
                    {...cursor.tooltip}
                    content={<TipContent placement={cursor.placement} />}
                    cursor={{ fill: 'var(--accent)' }}
                  />
                  {ROUNDS.map((rounds) => (
                    <Bar
                      key={rounds}
                      yAxisId="share"
                      dataKey={rounds}
                      stackId="depth"
                      fill={FILLS[rounds]}
                      isAnimationActive={false}
                    />
                  ))}
                  <Line
                    yAxisId="merged"
                    dataKey="merged"
                    stroke={THROUGHPUT}
                    strokeWidth={1.5}
                    dot={{ r: 2, fill: THROUGHPUT, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          <ChartLegend
            entries={[
              ...ROUNDS.map((rounds) => ({
                label: formatRounds(rounds),
                color: FILLS[rounds],
              })),
              { label: 'Merged that week', color: THROUGHPUT },
            ]}
          />
        </figure>

        <dl className="flex flex-col justify-center gap-0.5 text-xs">
          {totals.map((total) => (
            <div
              key={total.rounds}
              className="flex items-center gap-2 rounded-md px-2 py-1 even:bg-muted/30"
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-sm"
                style={{ background: FILLS[total.rounds] }}
              />
              <dt className="flex-1 text-foreground">
                {formatRounds(total.rounds)}
              </dt>
              <dd className="text-foreground tabular-nums">{total.merged}</dd>
              <dd className="w-10 text-right text-muted-foreground tabular-nums">
                {formatShare(total.rate)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </InsightsCard>
  );
}
