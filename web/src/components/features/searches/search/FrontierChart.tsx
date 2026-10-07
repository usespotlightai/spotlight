import {
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTip } from '@/components/shared/chart/ChartTip';
import { ScatterMark } from '@/components/shared/ScatterMark';
import { type TipPlacement, useCursorTooltip } from '@/hooks/useCursorTooltip';
import { useDotHover } from '@/hooks/useDotHover';
import { spentIn } from '@/lib/inbox';
import { shareShown } from '@/lib/insights';
import type { FrontierPoint } from '@/lib/search';

const HEIGHT = 240;

const Said = ({
  placement,
  active,
  payload,
  currency,
}: {
  placement: TipPlacement;
  active?: boolean;
  payload?: { payload: FrontierPoint }[];
  currency: string;
}) => {
  const point = payload?.[0]?.payload;

  if (!active || !point) {
    return null;
  }

  return (
    <ChartTip placement={placement}>
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
    </ChartTip>
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
    fill={payload?.seed ? 'var(--chart-5)' : fill}
    shape={payload?.seed ? 'diamond' : 'circle'}
  />
);

type FrontierChartProps = {
  points: readonly FrontierPoint[];
  currency: string;
};

export function FrontierChart({ points, currency }: FrontierChartProps) {
  const cursor = useCursorTooltip();
  const hover = useDotHover();
  const frontier = points
    .filter((each) => each.frontier)
    .sort((one, other) => one.cost - other.cost);
  const rest = points.filter((each) => !each.frontier);

  return (
    <figure data-slot="frontier-chart" className="flex flex-col gap-1">
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
        <span className="flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-full bg-chart-primary" />
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
      <div
        {...hover.area}
        className="[&_*:focus:not(:focus-visible)]:outline-none"
      >
        <div {...cursor.area}>
          <ResponsiveContainer width="100%" height={HEIGHT}>
            <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <XAxis
                type="number"
                dataKey="cost"
                name="Cost per run"
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-grid)' }}
                tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
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
                tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
                tickFormatter={(value: number) => shareShown(value)}
              />
              <Tooltip
                {...cursor.tooltip}
                {...hover.tooltip}
                content={
                  <Said placement={cursor.placement} currency={currency} />
                }
                cursor={false}
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
                fill="var(--chart-primary)"
                shape={(props: unknown) => <Mark {...(props as MarkProps)} />}
                line={{
                  stroke: 'var(--chart-primary)',
                  strokeDasharray: '4 3',
                }}
                lineType="joint"
                isAnimationActive={false}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </figure>
  );
}
