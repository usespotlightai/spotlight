import { countShown } from '@/lib/insights';
import { dotRadius, type RunsScale } from '@/lib/insights-changes';

export function RunsSizeLegend({ scale }: { scale: RunsScale }) {
  return (
    <span
      data-slot="runs-size-legend"
      role="img"
      aria-label={`Dot size shows runs, from ${countShown(scale.domain[0])} to ${countShown(scale.domain[1])}`}
      className="flex items-center gap-3"
    >
      <span>Runs</span>
      {scale.legend.map((runs) => {
        const radius = dotRadius(scale, runs);
        const side = Math.ceil(radius * 2) + 2;

        return (
          <span key={runs} className="flex items-center gap-1.5">
            <svg aria-hidden width={side} height={side} className="shrink-0">
              <circle
                cx={side / 2}
                cy={side / 2}
                r={radius}
                fill="none"
                stroke="var(--chart-axis)"
                strokeWidth="1"
              />
            </svg>
            <span className="tabular-nums">{countShown(runs)}</span>
          </span>
        );
      })}
    </span>
  );
}
