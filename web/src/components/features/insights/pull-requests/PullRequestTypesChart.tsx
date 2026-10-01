import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { spendShown } from '@/lib/insights';
import { type TypeShare, typeShown } from '@/lib/insights-pull-requests';

const HEIGHT = 180;

type TypeBar = TypeShare & { readonly label: string };

const Said = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: TypeBar }[];
}) => {
  const bar = payload?.[0]?.payload;

  if (!active || !bar) {
    return null;
  }

  return (
    <div className="whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-overlay">
      <p className="text-muted-foreground">{bar.label}</p>
      <p className="text-foreground">{bar.spotlight} by Spotlight</p>
      <p className="text-foreground">{bar.people} by people alone</p>
      <p className="text-muted-foreground">
        Spotlight spent {spendShown(bar.spend)}
      </p>
    </div>
  );
};

export function PullRequestTypesChart({
  types,
}: {
  types: readonly TypeShare[];
}) {
  return (
    <figure data-slot="types-chart" className="flex flex-col gap-1">
      <figcaption className="flex items-center gap-3 text-muted-foreground text-xs">
        <span className="flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-sm bg-primary" />
          Spotlight
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-sm bg-chart-1" />
          People alone
        </span>
      </figcaption>

      <div className="[&_*:focus:not(:focus-visible)]:outline-none">
        <ResponsiveContainer width="100%" height={HEIGHT}>
          <BarChart
            data={types.map((each) => ({
              ...each,
              label: typeShown(each.type),
            }))}
            margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
          >
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              tick={{ fill: 'var(--faint)', fontSize: 10 }}
            />
            <YAxis hide allowDecimals={false} />
            <Tooltip
              content={<Said />}
              isAnimationActive={false}
              cursor={{ fill: 'var(--accent)' }}
            />
            <Bar
              dataKey="spotlight"
              name="Spotlight"
              fill="var(--primary)"
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
    </figure>
  );
}
