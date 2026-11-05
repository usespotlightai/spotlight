import { InfoTooltip } from '@/components/shared/InfoTooltip';
import type { ComparisonStat } from '@/lib/judge';

export function JudgeStatistics({
  stats,
}: {
  stats: readonly ComparisonStat[];
}) {
  return (
    <dl
      data-slot="judge-statistics"
      className="flex flex-wrap gap-x-12 gap-y-4"
    >
      {stats.map((stat) => (
        <div key={stat.label} className="flex min-w-0 flex-col gap-1">
          <dt className="flex items-center gap-1 text-muted-foreground text-xs">
            {stat.label}
            <InfoTooltip tooltip={stat.note} />
          </dt>
          <dd className="flex items-baseline gap-2">
            <span className="font-medium text-foreground text-xl tabular-nums leading-7">
              {stat.value}
            </span>
            {stat.reading && (
              <span className="text-muted-foreground text-sm">
                {stat.reading}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
