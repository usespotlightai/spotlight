import {
  Bar,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ConfigMarkers } from '@/components/features/insights/ConfigMarkers';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { OutputLegend } from '@/components/features/insights/OutputLegend';
import { OutputTable } from '@/components/features/insights/OutputTable';
import { ChartTip } from '@/components/shared/chart/ChartTip';
import { type TipPlacement, useCursorTooltip } from '@/hooks/useCursorTooltip';
import { costTick } from '@/lib/chart';
import { spentIn } from '@/lib/inbox';
import { type DayOutput, OUTPUT_NOTE, type StationNames } from '@/lib/insights';
import { formatDay } from '@/lib/judge';

export const OUTPUT_CHART_HEIGHT = 200;

const spendOf = (day: DayOutput): number | null => day.spend?.amount ?? null;

const INSET = 8;

const AXIS_WIDTH = 36;

const AXIS_TICK = { fill: 'var(--chart-axis)', fontSize: 11 } as const;

export const TipContent = ({
  placement,
  active,
  payload,
  currency,
}: {
  placement: TipPlacement;
  active?: boolean;
  payload?: { payload: DayOutput }[];
  currency: string | null;
}) => {
  const day = payload?.[0]?.payload;

  if (!active || !day) {
    return null;
  }

  return (
    <ChartTip placement={placement}>
      <p className="text-muted-foreground">{formatDay(day.day)}</p>
      <p className="pt-0.5 text-foreground">
        {day.spend && currency ? spentIn(day.spend.amount, currency) : '–'}{' '}
        spent over {day.runs} {day.runs === 1 ? 'run' : 'runs'}
      </p>
      <p className="text-muted-foreground">
        {day.merged} {day.merged === 1 ? 'PR' : 'PRs'} merged
      </p>
    </ChartTip>
  );
};

type OutputAgainstCostProps = {
  slug: string;
  teamId: string;
  days: readonly DayOutput[];
  currency: string | null;
  noSpend: string;
  names: StationNames;
};

export function OutputAgainstCost({
  slug,
  teamId,
  days,
  currency,
  noSpend,
  names,
}: OutputAgainstCostProps) {
  const cursor = useCursorTooltip();
  const priced = currency !== null;

  return (
    <InsightsCard
      flat
      title="Output against cost"
      description={
        priced
          ? OUTPUT_NOTE
          : `Merged pull requests per day. Spend not shown. ${noSpend}.`
      }
      table={
        <OutputTable
          slug={slug}
          teamId={teamId}
          days={days}
          currency={currency}
          names={names}
        />
      }
    >
      <figure data-slot="output-chart" className="flex flex-col gap-1">
        <OutputLegend priced={priced} />

        <div className="[&_*:focus:not(:focus-visible)]:outline-none">
          <div {...cursor.area}>
            <ResponsiveContainer width="100%" height={OUTPUT_CHART_HEIGHT}>
              <ComposedChart
                data={[...days]}
                margin={{
                  top: 8,
                  right: priced ? INSET : INSET + AXIS_WIDTH,
                  bottom: 0,
                  left: INSET,
                }}
              >
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={{ stroke: 'var(--chart-grid)' }}
                  tick={AXIS_TICK}
                  tickFormatter={formatDay}
                  minTickGap={24}
                />
                <YAxis
                  yAxisId="merged"
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tickCount={3}
                  width={AXIS_WIDTH}
                  tick={AXIS_TICK}
                />
                <YAxis
                  yAxisId="spend"
                  orientation="right"
                  hide={!priced}
                  axisLine={false}
                  tickLine={false}
                  tickCount={3}
                  width={AXIS_WIDTH}
                  tick={AXIS_TICK}
                  tickFormatter={(spend: number) =>
                    currency ? costTick(spend, currency) : String(spend)
                  }
                />
                <Tooltip
                  {...cursor.tooltip}
                  content={
                    <TipContent
                      placement={cursor.placement}
                      currency={currency}
                    />
                  }
                  cursor={{ fill: 'var(--accent)' }}
                />
                {days
                  .filter((day) => day.changes.length > 0)
                  .map((day) => (
                    <ReferenceLine
                      key={day.day}
                      x={day.day}
                      yAxisId="merged"
                      stroke="var(--chart-axis)"
                      strokeDasharray="3 3"
                    />
                  ))}
                <Bar
                  yAxisId="merged"
                  dataKey="merged"
                  name="PRs merged"
                  fill="var(--chart-primary)"
                  fillOpacity={0.22}
                  radius={[2, 2, 0, 0]}
                  isAnimationActive={false}
                />
                {priced && (
                  <Line
                    yAxisId="spend"
                    dataKey={spendOf}
                    name="Spend"
                    stroke="var(--chart-primary)"
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <ConfigMarkers
          slug={slug}
          teamId={teamId}
          days={days}
          names={names}
          inset={INSET + AXIS_WIDTH}
        />
      </figure>
    </InsightsCard>
  );
}
