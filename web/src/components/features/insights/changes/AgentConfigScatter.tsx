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
import { ReplayedPointTip } from '@/components/features/insights/candidates/ReplayedPointTip';
import { RunsSizeLegend } from '@/components/features/insights/changes/RunsSizeLegend';
import { ChartTip } from '@/components/shared/chart/ChartTip';
import { PointLabels } from '@/components/shared/chart/PointLabels';
import { type TipPlacement, useCursorTooltip } from '@/hooks/useCursorTooltip';
import { useDotHover } from '@/hooks/useDotHover';
import { AXIS_TITLE, costTick } from '@/lib/chart';
import { spentIn } from '@/lib/inbox';
import { formatCount, formatShare } from '@/lib/insights';
import type { ReplayedPoint } from '@/lib/insights-candidates';
import {
  type AgentConfigPoint,
  frontierOf,
  type OutcomeMeasure,
  outcomeLabel,
  runsScaleOf,
} from '@/lib/insights-changes';

const HEIGHT = 300;

const TICKS = [0, 0.25, 0.5, 0.75, 1];

const TipContent = ({
  placement,
  active,
  payload,
  measure,
  currency,
}: {
  placement: TipPlacement;
  active?: boolean;
  payload?: { payload: AgentConfigPoint | ReplayedPoint }[];
  measure: OutcomeMeasure;
  currency: string;
}) => {
  const point = payload?.[0]?.payload;

  if (!active || !point) {
    return null;
  }

  if ('mark' in point) {
    return (
      <ReplayedPointTip
        point={point}
        currency={currency}
        placement={placement}
      />
    );
  }

  return (
    <ChartTip placement={placement}>
      <p className="text-foreground">{point.label}</p>
      <p className="text-muted-foreground">
        {outcomeLabel(measure)} {formatShare(point.value)} ·{' '}
        {spentIn(point.cost, currency)} a run
      </p>
      <p className="text-muted-foreground">
        {formatCount(point.runs)} {point.runs === 1 ? 'run' : 'runs'}
        {point.frontier ? ' · on the frontier' : ''}
      </p>
    </ChartTip>
  );
};

const replayedMark = (props: unknown) => (
  <ReplayedPointMark {...(props as ReplayedPointMarkProps)} hollow />
);

type AgentConfigScatterProps = {
  points: readonly AgentConfigPoint[];
  replayed: readonly ReplayedPoint[];
  measure: OutcomeMeasure;
  currency: string;
};

export function AgentConfigScatter({
  points,
  replayed,
  measure,
  currency,
}: AgentConfigScatterProps) {
  const cursor = useCursorTooltip();
  const hover = useDotHover();
  const frontier = frontierOf(points);
  const rest = points.filter((each) => !each.frontier);
  const runs = runsScaleOf(points);

  return (
    <figure data-slot="agent-config-scatter" className="flex flex-col gap-1">
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
                name={outcomeLabel(measure)}
                domain={[0, 1]}
                ticks={TICKS}
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
                tickFormatter={(value: number) => formatShare(value)}
                label={{
                  ...AXIS_TITLE,
                  value:
                    replayed.length > 0
                      ? `${outcomeLabel(measure)} · replay success`
                      : outcomeLabel(measure),
                  angle: -90,
                  position: 'insideLeft',
                  style: { textAnchor: 'middle' },
                }}
              />
              <ZAxis
                type="number"
                dataKey="runs"
                domain={[...runs.domain]}
                range={[...runs.range]}
              />
              <Tooltip
                {...cursor.tooltip}
                {...hover.tooltip}
                content={
                  <TipContent
                    placement={cursor.placement}
                    measure={measure}
                    currency={currency}
                  />
                }
                cursor={false}
              />
              <Scatter
                name="Other agent configs"
                data={rest}
                fill="var(--chart-1)"
                isAnimationActive={false}
              />
              <Scatter
                name="On the frontier"
                data={frontier}
                fill="var(--chart-primary)"
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
              <PointLabels
                labels={frontier.map((point) => ({
                  key: point.key,
                  text: point.label,
                  cost: point.cost,
                  value: point.value,
                }))}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-14 text-muted-foreground text-[0.7rem]">
        <RunsSizeLegend scale={runs} />
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-chart-primary" />
          On the frontier
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-chart-1" />
          Other agent configs
        </span>
        {replayed.length > 0 && (
          <span
            data-slot="replayed-legend"
            className="flex items-center gap-x-4"
          >
            <ReplayedLegend points={replayed} hollow />
          </span>
        )}
      </figcaption>
    </figure>
  );
}
