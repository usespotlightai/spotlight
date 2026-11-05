import type { TrendPoint } from '@/lib/insights';
import { formatDay } from '@/lib/judge';

const WIDTH = 120;
const HEIGHT = 16;
const GAP = 1;
const FLOOR = 1;

const summaryOf = (trend: readonly TrendPoint[]): string => {
  const first = trend[0];
  const last = trend[trend.length - 1];
  const max = Math.max(...trend.map((each) => each.runs), 0);

  return first && last
    ? `Runs per day from ${formatDay(first.day)} to ${formatDay(last.day)}, at most ${max}`
    : 'No runs per day';
};

export function DailyRunBars({ trend }: { trend: readonly TrendPoint[] }) {
  const max = Math.max(...trend.map((each) => each.runs), 1);
  const step = WIDTH / Math.max(trend.length, 1);
  const bar = Math.max(step - GAP, 1);
  const tall = (count: number) => (count / max) * HEIGHT;

  return (
    <svg
      role="img"
      aria-label={summaryOf(trend)}
      data-slot="daily-run-bars"
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="shrink-0"
      shapeRendering="crispEdges"
    >
      {trend.map((each, index) => {
        const x = index * step;
        const runs = Math.max(tall(each.runs), each.runs > 0 ? FLOOR : 0);
        const failed = Math.min(tall(each.failed), runs);

        return each.runs === 0 ? (
          <rect
            key={each.day}
            x={x}
            y={HEIGHT - FLOOR}
            width={bar}
            height={FLOOR}
            fill="var(--border)"
          />
        ) : (
          <g key={each.day}>
            <rect
              x={x}
              y={HEIGHT - runs}
              width={bar}
              height={runs - failed}
              fill="var(--chart-bar-mini)"
            />
            {failed > 0 && (
              <rect
                x={x}
                y={HEIGHT - failed}
                width={bar}
                height={failed}
                fill="var(--outcome-failed)"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
