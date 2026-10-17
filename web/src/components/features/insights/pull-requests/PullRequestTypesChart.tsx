import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TYPE_SERIES } from '@/components/features/insights/chart-series';
import { ChartLegend } from '@/components/features/insights/shipping/ChartLegend';
import { ChartTip } from '@/components/shared/chart/ChartTip';
import { type TipPlacement, useCursorTooltip } from '@/hooks/useCursorTooltip';
import { formatSpend } from '@/lib/insights';
import { formatType, type TypeShare } from '@/lib/insights-pull-requests';

export const TYPES_CHART_HEIGHT = 180;

type TypeBar = TypeShare & { readonly label: string };

const Said = ({
  placement,
  active,
  payload,
}: {
  placement: TipPlacement;
  active?: boolean;
  payload?: { payload: TypeBar }[];
}) => {
  const bar = payload?.[0]?.payload;

  if (!active || !bar) {
    return null;
  }

  return (
    <ChartTip placement={placement}>
      <p className="text-muted-foreground">{bar.label}</p>
      <p className="text-foreground">{bar.spotlight} by Spotlight</p>
      <p className="text-foreground">{bar.people} by people alone</p>
      <p className="text-muted-foreground">
        Spotlight spent {formatSpend(bar.spend)}
      </p>
    </ChartTip>
  );
};

export function PullRequestTypesChart({
  types,
}: {
  types: readonly TypeShare[];
}) {
  const cursor = useCursorTooltip();
  return (
    <figure data-slot="types-chart" className="flex flex-col gap-1">
      <ChartLegend entries={TYPE_SERIES} />

      <div className="[&_*:focus:not(:focus-visible)]:outline-none">
        <div {...cursor.area}>
          <ResponsiveContainer width="100%" height={TYPES_CHART_HEIGHT}>
            <BarChart
              data={types.map((each) => ({
                ...each,
                label: formatType(each.type),
              }))}
              margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
            >
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-grid)' }}
                tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
              />
              <YAxis hide allowDecimals={false} />
              <Tooltip
                {...cursor.tooltip}
                content={<Said placement={cursor.placement} />}
                cursor={{ fill: 'var(--accent)' }}
              />
              <Bar
                dataKey="spotlight"
                name="Spotlight"
                fill="var(--chart-primary)"
                isAnimationActive={false}
              />
              <Bar
                dataKey="people"
                name="People alone"
                fill="var(--chart-1)"
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </figure>
  );
}
