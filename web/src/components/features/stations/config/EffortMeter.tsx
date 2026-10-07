import type { EffortLevel } from '@/hooks/useStationAgent';
import { cn } from '@/lib/utils';

export function EffortMeter({ effort }: { effort: EffortLevel }) {
  const count = effort.levels.length;

  return (
    <div data-slot="effort-meter" className="mt-auto flex flex-col gap-2 pt-2">
      <span className="text-muted-foreground text-xs">Effort</span>
      <ol
        aria-label={`Effort: ${effort.name}, ${effort.at} of ${count}`}
        className="flex items-end gap-1"
      >
        {effort.levels.map((level, step) => (
          <li
            key={level}
            aria-current={step + 1 === effort.at ? 'true' : undefined}
            className="flex min-w-0 flex-1 flex-col gap-1"
          >
            <span className="flex h-10 items-end">
              <span
                className={cn(
                  'w-full',
                  step < effort.at ? 'bg-chart-primary' : 'bg-muted',
                )}
                style={{ height: `${((step + 1) / count) * 100}%` }}
              />
            </span>
            <span
              className={cn(
                'truncate text-center text-[0.7rem]',
                step + 1 === effort.at
                  ? 'text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {level}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
