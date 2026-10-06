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
import { OutputTable } from '@/components/features/insights/OutputTable';
import { ChartTip } from '@/components/shared/chart/ChartTip';
import { type TipPlacement, useCursorTooltip } from '@/hooks/useCursorTooltip';
import { spentIn } from '@/lib/inbox';
import {
  type OutputDay,
  type StationNames,
  stationShown,
} from '@/lib/insights';
import { changeKey } from '@/lib/insights-changes';
import { dayShown } from '@/lib/judge';

const HEIGHT = 200;

const INSET = 8;

const Said = ({
  placement,
  active,
  payload,
  currency,
  names,
}: {
  placement: TipPlacement;
  active?: boolean;
  payload?: { payload: OutputDay }[];
  currency: string | null;
  names: StationNames;
}) => {
  const day = payload?.[0]?.payload;

  if (!active || !day) {
    return null;
  }

  return (
    <ChartTip placement={placement}>
      <p className="text-muted-foreground">{dayShown(day.day)}</p>
      <p className="pt-0.5 text-foreground">
        {day.spend !== null && currency ? spentIn(day.spend, currency) : '–'}{' '}
        spent over {day.runs} {day.runs === 1 ? 'run' : 'runs'}
      </p>
      <p className="text-muted-foreground">
        {day.merged} {day.merged === 1 ? 'PR' : 'PRs'} merged
      </p>
      {day.changes.map((change) => (
        <p key={changeKey(change)} className="text-muted-foreground">
          Config changed at {stationShown(names, change.stationId)}
        </p>
      ))}
    </ChartTip>
  );
};

type OutputAgainstCostProps = {
  slug: string;
  teamId: string;
  days: readonly OutputDay[];
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
      title="Output against cost"
      description={
        priced
          ? 'Spend and merged pull requests per day. A diamond marks a station’s new config.'
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
        <figcaption className="flex items-center gap-3 text-muted-foreground text-[0.7rem]">
          {priced && (
            <span className="flex items-center gap-1">
              <span aria-hidden className="h-0.5 w-3 bg-chart-primary" />
              Spend
            </span>
          )}
          <span className="flex items-center gap-1">
            <span aria-hidden className="size-2 rounded-sm bg-chart-2" />
            PRs merged
          </span>
        </figcaption>

        <div className="[&_*:focus:not(:focus-visible)]:outline-none">
          <div {...cursor.area}>
            <ResponsiveContainer width="100%" height={HEIGHT}>
              <ComposedChart
                data={[...days]}
                margin={{ top: 8, right: INSET, bottom: 0, left: INSET }}
              >
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={{ stroke: 'var(--chart-grid)' }}
                  tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
                  tickFormatter={dayShown}
                  minTickGap={24}
                />
                <YAxis yAxisId="merged" hide allowDecimals={false} />
                <YAxis yAxisId="spend" hide orientation="right" />
                <Tooltip
                  {...cursor.tooltip}
                  content={
                    <Said
                      placement={cursor.placement}
                      currency={currency}
                      names={names}
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
                  fill="var(--chart-2)"
                  isAnimationActive={false}
                />
                {priced && (
                  <Line
                    yAxisId="spend"
                    dataKey="spend"
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
          inset={INSET}
        />
      </figure>
    </InsightsCard>
  );
}
