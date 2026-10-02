import {
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ScatterMark } from '@/components/shared/ScatterMark';
import { spentIn } from '@/lib/inbox';
import { shareShown } from '@/lib/insights';
import type { FrontierPoint } from '@/lib/search';

const HEIGHT = 240;

const Said = ({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: { payload: FrontierPoint }[];
  currency: string;
}) => {
  const point = payload?.[0]?.payload;

  if (!active || !point) {
    return null;
  }

  return (
    <div className="whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-overlay">
      <p className="text-foreground">{point.name}</p>
      <p className="text-muted-foreground">
        {shareShown(point.success)} succeeded · {spentIn(point.cost, currency)}{' '}
        a run
      </p>
      {(point.frontier || point.seed) && (
        <p className="text-muted-foreground">
          {[
            point.seed ? 'where it started' : null,
            point.frontier ? 'on the frontier' : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
    </div>
  );
};

type MarkProps = {
  cx?: number;
  cy?: number;
  fill?: string;
  payload?: FrontierPoint;
};

const Mark = ({ cx, cy, fill, payload }: MarkProps) => (
  <ScatterMark
    cx={cx}
    cy={cy}
    fill={payload?.seed ? 'var(--foreground)' : fill}
    shape={payload?.seed ? 'diamond' : 'circle'}
  />
);

type FrontierChartProps = {
  points: readonly FrontierPoint[];
  currency: string;
};

export function FrontierChart({ points, currency }: FrontierChartProps) {
  const frontier = points
    .filter((each) => each.frontier)
    .sort((one, other) => one.cost - other.cost);
  const rest = points.filter((each) => !each.frontier);

  return (
    <figure data-slot="frontier-chart" className="flex flex-col gap-1">
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
        <span className="flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-full bg-primary" />
          On the frontier
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-full bg-chart-1" />
          Other candidates
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden className="size-2 rotate-45 bg-foreground" />
          Live config
        </span>
      </figcaption>
      <div className="[&_*:focus:not(:focus-visible)]:outline-none">
        <ResponsiveContainer width="100%" height={HEIGHT}>
          <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <XAxis
              type="number"
              dataKey="cost"
              name="Cost per run"
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              tick={{ fill: 'var(--faint)', fontSize: 10 }}
              tickFormatter={(cost: number) => spentIn(cost, currency)}
            />
            <YAxis
              type="number"
              dataKey="success"
              name="Success rate"
              domain={[0, 1]}
              tickLine={false}
              axisLine={false}
              width={40}
              tick={{ fill: 'var(--faint)', fontSize: 10 }}
              tickFormatter={(value: number) => shareShown(value)}
            />
            <Tooltip
              content={<Said currency={currency} />}
              isAnimationActive={false}
              cursor={{ strokeDasharray: '3 3' }}
            />
            <Scatter
              name="Other candidates"
              data={rest}
              fill="var(--chart-1)"
              shape={(props: unknown) => <Mark {...(props as MarkProps)} />}
              isAnimationActive={false}
            />
            <Scatter
              name="On the frontier"
              data={frontier}
              fill="var(--primary)"
              shape={(props: unknown) => <Mark {...(props as MarkProps)} />}
              line={{ stroke: 'var(--primary)', strokeDasharray: '4 3' }}
              lineType="joint"
              isAnimationActive={false}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
