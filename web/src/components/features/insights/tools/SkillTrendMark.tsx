import { Minus, Triangle } from 'lucide-react';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { formatTrend, type SkillTrend } from '@/lib/insights-tools';
import { cn } from '@/lib/utils';

const TONES: Record<SkillTrend, string> = {
  rising: 'text-emerald-700 dark:text-emerald-400',
  falling: 'text-destructive',
  flat: 'text-muted-foreground',
};

export function SkillTrendMark({ trend }: { trend: SkillTrend | null }) {
  if (!trend) {
    return <span className="text-muted-foreground">–</span>;
  }

  const icon = cn('size-2.5 shrink-0', TONES[trend]);

  return (
    <WithTooltip tooltip={formatTrend(trend)}>
      <span
        data-slot="skill-trend"
        data-trend={trend}
        className="inline-flex items-center"
      >
        {trend === 'flat' ? (
          <Minus aria-hidden className={icon} />
        ) : (
          <Triangle
            aria-hidden
            className={cn(
              icon,
              'fill-current',
              trend === 'falling' && 'rotate-180',
            )}
          />
        )}
        <span className="sr-only">{formatTrend(trend)}</span>
      </span>
    </WithTooltip>
  );
}
