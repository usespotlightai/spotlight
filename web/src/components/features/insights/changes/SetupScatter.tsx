import {
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { ReplayedLegend } from '@/components/features/insights/candidates/ReplayedLegend';
import {
  ReplayedPointMark,
  type ReplayedPointMarkProps,
} from '@/components/features/insights/candidates/ReplayedPointMark';
import { ReplayedPointSaid } from '@/components/features/insights/candidates/ReplayedPointSaid';
import { spentIn } from '@/lib/inbox';
import { countShown, shareShown } from '@/lib/insights';
import type { ReplayedPoint } from '@/lib/insights-candidates';
import {
  frontierOf,
  type OutcomeMeasure,
  outcomeLabel,
  type SetupPoint,
} from '@/lib/insights-changes';

const HEIGHT = 240;

const Said = ({
  active,
  payload,
  measure,
  currency,
}: {
  active?: boolean;
  payload?: { payload: SetupPoint | ReplayedPoint }[];
  measure: OutcomeMeasure;
  currency: string;
}) => {
  const point = payload?.[0]?.payload;

  if (!active || !point) {
    return null;
  }

  if ('mark' in point) {
    return <ReplayedPointSaid point={point} currency={currency} />;
  }

  return (
    <div className="whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-overlay">
      <p className="text-foreground">{point.label}</p>
      <p className="text-muted-foreground">
        {outcomeLabel(measure)} {shareShown(point.value)} ·{' '}
        {spentIn(point.cost, currency)} a run
      </p>
      <p className="text-muted-foreground">
        {countShown(point.runs)} {point.runs === 1 ? 'run' : 'runs'}
        {point.frontier ? ' · on the frontier' : ''}
      </p>
    </div>
  );
};

const replayedMark = (props: unknown) => (
  <ReplayedPointMark {...(props as ReplayedPointMarkProps)} hollow />
);

type SetupScatterProps = {
  points: readonly SetupPoint[];
  replayed: readonly ReplayedPoint[];
  measure: OutcomeMeasure;
  currency: string;
};

export function SetupScatter({
  points,
  replayed,
  measure,
  currency,
}: SetupScatterProps) {
  const frontier = frontierOf(points);
  const rest = points.filter((each) => !each.frontier);

  return (
    <figure data-slot="setup-scatter" className="flex flex-col gap-1">
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
        <span className="flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-full bg-primary" />
          On the frontier
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-full bg-chart-1" />
          Other setups
        </span>
        {replayed.length > 0 && (
          <span
            data-slot="replayed-legend"
            className="flex flex-wrap items-center gap-x-3 gap-y-1"
          >
            <span className="font-medium text-foreground">Replayed:</span>
            <ReplayedLegend points={replayed} hollow />
          </span>
        )}
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
              dataKey="value"
              name={outcomeLabel(measure)}
              domain={[0, 1]}
              tickLine={false}
              axisLine={false}
              width={replayed.length > 0 ? 56 : 40}
              tick={{ fill: 'var(--faint)', fontSize: 10 }}
              tickFormatter={(value: number) => shareShown(value)}
              label={
                replayed.length > 0
                  ? {
                      value: `${outcomeLabel(measure)} · replay success`,
                      angle: -90,
                      position: 'insideLeft',
                      fill: 'var(--muted-foreground)',
                      fontSize: 10,
                      style: { textAnchor: 'middle' },
                    }
                  : undefined
              }
            />
            <ZAxis type="number" dataKey="runs" range={[40, 240]} />
            <Tooltip
              content={<Said measure={measure} currency={currency} />}
              isAnimationActive={false}
              cursor={{ strokeDasharray: '3 3' }}
            />
            <Scatter
              name="Other setups"
              data={rest}
              fill="var(--chart-1)"
              isAnimationActive={false}
            />
            <Scatter
              name="On the frontier"
              data={frontier}
              fill="var(--primary)"
              line={{ stroke: 'var(--primary)', strokeDasharray: '4 3' }}
              lineType="joint"
              isAnimationActive={false}
            />
            {replayed.length > 0 && (
              <Scatter
                name="Replayed"
                data={replayed}
                shape={replayedMark}
                isAnimationActive={false}
              />
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
