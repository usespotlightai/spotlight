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
import { formatSpend } from '@/lib/insights';
import { formatType, type TypeShare } from '@/lib/insights-pull-requests';

const HEIGHT = 180;

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
      <figcaption className="flex items-center gap-3 text-muted-foreground text-[0.7rem]">
        <span className="flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-sm bg-chart-primary" />
          Spotlight
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-sm bg-chart-1" />
          People alone
        </span>
      </figcaption>

      <div className="[&_*:focus:not(:focus-visible)]:outline-none">
        <div {...cursor.area}>
          <ResponsiveContainer width="100%" height={HEIGHT}>
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
