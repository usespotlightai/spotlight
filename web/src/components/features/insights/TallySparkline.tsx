import { Line, LineChart, YAxis } from 'recharts';
import type { TrendPoint } from '@/lib/insights';
import { formatDay } from '@/lib/judge';

const WIDTH = 120;
const HEIGHT = 16;

const summaryOf = (trend: readonly TrendPoint[]): string => {
  const first = trend[0];
  const last = trend[trend.length - 1];
  const max = Math.max(...trend.map((each) => each.runs), 0);

  return first && last
    ? `Runs per day from ${formatDay(first.day)} to ${formatDay(last.day)}, at most ${max}`
    : 'No runs per day';
};

export function TallySparkline({ trend }: { trend: readonly TrendPoint[] }) {
  return (
    <div
      role="img"
      aria-label={summaryOf(trend)}
      data-slot="tally-sparkline"
      className="shrink-0"
    >
      <LineChart
        width={WIDTH}
        height={HEIGHT}
        data={[...trend]}
        margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
      >
        <YAxis hide domain={[0, 'dataMax']} />
        <Line
          dataKey="runs"
          stroke="var(--chart-primary)"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          dataKey="failed"
          stroke="var(--destructive)"
          strokeWidth={1}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </div>
  );
}
