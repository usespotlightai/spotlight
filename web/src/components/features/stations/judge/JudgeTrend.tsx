import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTip } from '@/components/shared/chart/ChartTip';
import { type TipPlacement, useCursorTooltip } from '@/hooks/useCursorTooltip';
import {
  dayShown,
  percentShown,
  type ScoreKind,
  sharesOn,
  statShown,
  type TrendPoint,
  trendCaptionShown,
} from '@/lib/judge';

const HEIGHT = 140;

const scoreOf = (kind: ScoreKind, value: number | null): string =>
  sharesOn(kind) ? percentShown(value) : statShown(value);

const Said = ({
  placement,
  active,
  payload,
  kind,
}: {
  placement: TipPlacement;
  active?: boolean;
  payload?: { payload: TrendPoint }[];
  kind: ScoreKind;
}) => {
  const point = payload?.[0]?.payload;

  if (!active || !point) {
    return null;
  }

  return (
    <ChartTip placement={placement}>
      <p className="text-muted-foreground">{dayShown(point.day)}</p>
      <p className="pt-0.5 text-foreground">
        {point.judge === null
          ? `Judge hidden over ${point.judged}`
          : `Judge ${scoreOf(kind, point.judge)} over ${point.judged}`}
      </p>
      <p className="text-muted-foreground">
        People {scoreOf(kind, point.people)} over {point.labelled}
      </p>
    </ChartTip>
  );
};

export function JudgeTrend({
  trend,
  kind,
}: {
  trend: readonly TrendPoint[];
  kind: ScoreKind;
}) {
  const cursor = useCursorTooltip();
  if (trend.length === 0) {
    return null;
  }

  const judgeShown = trend.some((each) => each.judge !== null);

  return (
    <figure data-slot="judge-trend" className="flex flex-col gap-1">
      <figcaption className="flex items-center gap-3 text-muted-foreground text-xs">
        <span data-slot="judge-trend-judge" className="flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-full bg-chart-primary" />
          {judgeShown ? 'Judge' : 'Judge hidden'}
        </span>
        <span className="flex items-center gap-1">
          <span
            aria-hidden
            className="size-2 rounded-full bg-muted-foreground"
          />
          People
        </span>
        <span>{trendCaptionShown(kind)}</span>
      </figcaption>

      <div className="[&_*:focus:not(:focus-visible)]:outline-none">
        <div {...cursor.area}>
          <ResponsiveContainer width="100%" height={HEIGHT}>
            <LineChart
              data={[...trend]}
              margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
            >
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-grid)' }}
                tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
                tickFormatter={dayShown}
                minTickGap={24}
              />
              <YAxis hide domain={sharesOn(kind) ? [0, 1] : [1, 5]} />
              <Tooltip
                {...cursor.tooltip}
                content={<Said placement={cursor.placement} kind={kind} />}
                cursor={{ stroke: 'var(--chart-grid)' }}
              />
              <Line
                dataKey="judge"
                name="Judge"
                stroke="var(--chart-primary)"
                strokeWidth={1.5}
                dot={{ r: 2 }}
                isAnimationActive={false}
              />
              <Line
                dataKey="people"
                name="People"
                stroke="var(--chart-2)"
                strokeWidth={1.5}
                dot={{ r: 2 }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </figure>
  );
}
