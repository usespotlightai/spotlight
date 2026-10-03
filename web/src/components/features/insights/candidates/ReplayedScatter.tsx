import {
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ReplayedLegend } from '@/components/features/insights/candidates/ReplayedLegend';
import {
  ReplayedPointMark,
  type ReplayedPointMarkProps,
} from '@/components/features/insights/candidates/ReplayedPointMark';
import { ReplayedPointSaid } from '@/components/features/insights/candidates/ReplayedPointSaid';
import { spentIn } from '@/lib/inbox';
import { shareShown } from '@/lib/insights';
import {
  type ReplayedPoint,
  replayedFrontiersOf,
} from '@/lib/insights-candidates';

const HEIGHT = 220;

const Said = ({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: { payload: ReplayedPoint }[];
  currency: string;
}) => {
  const point = payload?.[0]?.payload;

  return active && point ? (
    <ReplayedPointSaid point={point} currency={currency} />
  ) : null;
};

const mark = (props: unknown) => (
  <ReplayedPointMark {...(props as ReplayedPointMarkProps)} />
);

type ReplayedScatterProps = {
  points: readonly ReplayedPoint[];
  currency: string;
};

export function ReplayedScatter({ points, currency }: ReplayedScatterProps) {
  const frontiers = replayedFrontiersOf(points);
  const onFrontier = new Set(frontiers.flat());
  const rest = points.filter((each) => !onFrontier.has(each));

  return (
    <figure data-slot="replayed-scatter" className="flex flex-col gap-1">
      <figcaption>
        <ReplayedLegend points={points} />
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
              name="Replay success"
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
              name="Replayed"
              data={rest}
              shape={mark}
              isAnimationActive={false}
            />
            {frontiers.map((frontier) => (
              <Scatter
                key={frontier[0]?.searchId}
                name="On the search’s frontier"
                data={frontier}
                shape={mark}
                line={{ stroke: 'var(--primary)', strokeDasharray: '4 3' }}
                lineType="joint"
                isAnimationActive={false}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
