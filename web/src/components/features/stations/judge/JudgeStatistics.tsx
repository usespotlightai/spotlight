import { Noted } from '@/components/shared/Noted';
import type { ComparisonStat } from '@/lib/judge';
import { cn } from '@/lib/utils';

export function JudgeStatistics({
  stats,
}: {
  stats: readonly ComparisonStat[];
}) {
  return (
    <dl
      data-slot="judge-statistics"
      className={cn(
        'grid justify-items-center gap-x-10 gap-y-6',
        stats.length === 4 ? 'grid-cols-2' : 'grid-cols-3',
      )}
    >
      {stats.map((stat) => (
        <Noted key={stat.label} note={stat.note}>
          <div className="flex min-w-0 cursor-default flex-col items-center gap-1 text-center">
            <dt className="text-muted-foreground text-xs">{stat.label}</dt>
            <dd className="font-normal text-[1.375rem] text-foreground tabular-nums leading-none tracking-tight">
              {stat.value}
            </dd>
          </div>
        </Noted>
      ))}
    </dl>
  );
}
