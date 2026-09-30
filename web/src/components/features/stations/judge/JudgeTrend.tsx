import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  dayShown,
  percentShown,
  type ScoreKind,
  statShown,
  type TrendPoint,
} from '@/lib/judge';

const HEIGHT = 140;

const scoreOf = (kind: ScoreKind, value: number | null): string =>
  kind === 'yes-no' ? percentShown(value) : statShown(value);

const Said = ({
  active,
  payload,
  kind,
}: {
  active?: boolean;
  payload?: { payload: TrendPoint }[];
  kind: ScoreKind;
}) => {
  const point = payload?.[0]?.payload;

  if (!active || !point) {
    return null;
  }

  return (
    <div className="whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-overlay">
      <p className="text-muted-foreground">{dayShown(point.day)}</p>
      <p className="pt-0.5 text-foreground">
        {point.judge === null
          ? `Judge hidden over ${point.judged}`
          : `Judge ${scoreOf(kind, point.judge)} over ${point.judged}`}
      </p>
      <p className="text-muted-foreground">
        People {scoreOf(kind, point.people)} over {point.labelled}
      </p>
    </div>
  );
};

export function JudgeTrend({
  trend,
  kind,
}: {
  trend: readonly TrendPoint[];
  kind: ScoreKind;
}) {
  if (trend.length === 0) {
    return null;
  }

  const judgeShown = trend.some((each) => each.judge !== null);

  return (
    <figure data-slot="judge-trend" className="flex flex-col gap-1">
      <figcaption className="flex items-center gap-3 text-muted-foreground text-xs">
        <span data-slot="judge-trend-judge" className="flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-full bg-primary" />
          {judgeShown ? 'Judge' : 'Judge hidden'}
        </span>
        <span className="flex items-center gap-1">
          <span
            aria-hidden
            className="size-2 rounded-full bg-muted-foreground"
          />
          People
        </span>
        <span>
          {kind === 'yes-no'
            ? 'share scored yes, by day'
            : 'mean score, by day'}
        </span>
      </figcaption>

      <div className="[&_*:focus:not(:focus-visible)]:outline-none">
        <ResponsiveContainer width="100%" height={HEIGHT}>
          <LineChart
            data={[...trend]}
            margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
          >
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              tick={{ fill: 'var(--faint)', fontSize: 10 }}
              tickFormatter={dayShown}
              minTickGap={24}
            />
            <YAxis hide domain={kind === 'yes-no' ? [0, 1] : [1, 5]} />
            <Tooltip
              content={<Said kind={kind} />}
              isAnimationActive={false}
              cursor={{ stroke: 'var(--border)' }}
            />
            <Line
              dataKey="judge"
              name="Judge"
              stroke="var(--primary)"
              strokeWidth={1.5}
              dot={{ r: 2 }}
              isAnimationActive={false}
            />
            <Line
              dataKey="people"
              name="People"
              stroke="var(--muted-foreground)"
              strokeWidth={1.5}
              dot={{ r: 2 }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
