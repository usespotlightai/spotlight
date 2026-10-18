import { TriangleAlert } from 'lucide-react';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { healthReadingsOf, type SetHealth } from '@/lib/replay-words';
import { cn } from '@/lib/utils';

type SetCaveatsProps = {
  health: SetHealth;
  minGain: number;
};

export function SetCaveats({ health, minGain }: SetCaveatsProps) {
  const readings = healthReadingsOf(health, minGain);
  const warnings = readings.filter((each) => each.tone === 'bad');
  const unmeasured = readings.filter(
    (each) => each.tone === 'unknown' || each.tone === 'pending',
  );

  if (warnings.length === 0 && unmeasured.length === 0) {
    return null;
  }

  const note = [
    ...warnings.map((each) => `${each.label}: ${each.text}.`),
    ...(unmeasured.length > 0
      ? [
          `${unmeasured.length} of ${readings.length} health checks not run: ${unmeasured.map((each) => each.label).join(', ')}.`,
        ]
      : []),
  ].join(' ');

  return (
    <WithTooltip tooltip={note}>
      <span
        role="img"
        aria-label="Set health"
        data-slot="set-caveats"
        className={cn(
          'inline-flex',
          warnings.length > 0
            ? 'text-amber-700 dark:text-amber-400'
            : 'text-muted-foreground',
        )}
      >
        <TriangleAlert aria-hidden className="size-3.5" />
      </span>
    </WithTooltip>
  );
}
