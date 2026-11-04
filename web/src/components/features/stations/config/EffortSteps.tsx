import type { EffortLevel } from '@/hooks/useStationAgent';
import { cn } from '@/lib/utils';

export function EffortSteps({ effort }: { effort: EffortLevel }) {
  const count = effort.levels.length;

  return (
    <span
      role="img"
      aria-label={`Effort: ${effort.name}, ${effort.at} of ${count}`}
      className="inline-flex h-3 items-end gap-0.5"
    >
      {effort.levels.map((level, step) => (
        <span
          key={level}
          className={cn(
            'w-1 rounded-[1px]',
            step < effort.at ? 'bg-foreground' : 'bg-muted-foreground/30',
          )}
          style={{ height: `${((step + 1) / count) * 100}%` }}
        />
      ))}
    </span>
  );
}
