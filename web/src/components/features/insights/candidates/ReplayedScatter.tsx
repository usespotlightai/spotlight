import {
  LabelList,
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
import { PointLabel } from '@/components/shared/chart/PointLabel';
import { type TipPlacement, useCursorTooltip } from '@/hooks/useCursorTooltip';
import { useDotHover } from '@/hooks/useDotHover';
import { AXIS_TITLE, costTick } from '@/lib/chart';
import { shareShown } from '@/lib/insights';
import {
  type ReplayedPoint,
  replayedFrontiersOf,
} from '@/lib/insights-candidates';

const HEIGHT = 280;

const LIVE_CONFIG = 'Live config';

const TICKS = [0, 0.25, 0.5, 0.75, 1];

const Said = ({
  placement,
  active,
  payload,
  currency,
}: {
  placement: TipPlacement;
  active?: boolean;
  payload?: { payload: ReplayedPoint }[];
  currency: string;
}) => {
  const point = payload?.[0]?.payload;

  return active && point ? (
    <ReplayedPointSaid
      point={point}
      currency={currency}
      placement={placement}
    />
  ) : null;
};

const mark = (props: unknown) => (
  <ReplayedPointMark {...(props as ReplayedPointMarkProps)} />
);

const named = (entry: { payload?: ReplayedPoint }): string =>
  entry.payload?.mark === 'baseline'
    ? LIVE_CONFIG
    : (entry.payload?.label ?? '');

type ReplayedScatterProps = {
  points: readonly ReplayedPoint[];
  currency: string;
};

export function ReplayedScatter({ points, currency }: ReplayedScatterProps) {
  const cursor = useCursorTooltip();
  const hover = useDotHover();
  const frontiers = replayedFrontiersOf(points);
  const onFrontier = new Set(frontiers.flat());
  const rest = points.filter((each) => !onFrontier.has(each));

  return (
    <figure data-slot="replayed-scatter" className="flex flex-col gap-3">
      <div
        {...hover.area}
        className="min-w-0 flex-1 [&_*:focus:not(:focus-visible)]:outline-none"
      >
        <div {...cursor.area}>
          <ResponsiveContainer width="100%" height={HEIGHT}>
            <ScatterChart margin={{ top: 20, right: 4, bottom: 4, left: 0 }}>
              <XAxis
                type="number"
                dataKey="cost"
                name="Cost per run"
                padding={{ right: 64 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-grid)' }}
                tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
                tickFormatter={(cost: number) => costTick(cost, currency)}
                height={40}
                label={{
                  ...AXIS_TITLE,
                  value: 'Cost per run',
                  position: 'insideBottom',
                  offset: 0,
                }}
              />
              <YAxis
                type="number"
                dataKey="value"
                name="Replay success"
                domain={[0, 1]}
                ticks={TICKS}
                tickLine={false}
                axisLine={false}
                width={56}
                label={{
                  ...AXIS_TITLE,
                  value: 'Replay success',
                  angle: -90,
                  position: 'insideLeft',
                  style: { textAnchor: 'middle' },
                }}
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
                name="Replayed"
                data={rest}
                shape={mark}
                isAnimationActive={false}
              >
                <LabelList valueAccessor={named} content={PointLabel} />
              </Scatter>
              {frontiers.map((frontier) => (
                <Scatter
                  key={frontier[0]?.searchId}
                  name="On the search’s frontier"
                  data={frontier}
                  shape={mark}
                  isAnimationActive={false}
                >
                  <LabelList valueAccessor={named} content={PointLabel} />
                </Scatter>
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
      <figcaption className="pl-14">
        <ReplayedLegend points={points} />
      </figcaption>
    </figure>
  );
}
