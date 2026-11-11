import {
  Bar,
  ComposedChart,
  Line,
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

const AXIS_TICK = { fill: 'var(--chart-axis)', fontSize: 12 } as const;

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
    <ChartTip
      placement={placement}
      note={{
        title: formatDay(day.day),
        rows: [
          [
            'Spent',
            day.spend && currency ? spentIn(day.spend.amount, currency) : '–',
          ],
          ['Runs', `${day.runs}`],
          ['PRs merged', `${day.merged}`],
        ],
      }}
    />
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
                <Bar
                  yAxisId="merged"
                  dataKey="merged"
                  name="PRs merged"
                  fill="var(--chart-bar-quiet)"
                  radius={[2, 2, 0, 0]}
                  isAnimationActive={false}
                />
                {priced && (
                  <Line
                    yAxisId="spend"
                    dataKey={spendOf}
                    name="Spend"
                    stroke="var(--chart-line)"
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
