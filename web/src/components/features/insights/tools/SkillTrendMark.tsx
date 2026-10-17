import { Minus, Triangle } from 'lucide-react';
import { Noted } from '@/components/shared/Noted';
import { formatTrend, type SkillTrend } from '@/lib/insights-tools';
import { cn } from '@/lib/utils';

const TONES: Record<SkillTrend, string> = {
  spreading: 'text-emerald-700 dark:text-emerald-400',
  fading: 'text-destructive',
  steady: 'text-muted-foreground',
};

export function SkillTrendMark({ trend }: { trend: SkillTrend | null }) {
  if (!trend) {
    return <span className="text-muted-foreground">–</span>;
  }

  const icon = cn('size-2.5 shrink-0', TONES[trend]);

  return (
    <Noted note={formatTrend(trend)}>
      <span
        data-slot="skill-trend"
        data-trend={trend}
        className="inline-flex items-center"
      >
        {trend === 'steady' ? (
          <Minus aria-hidden className={icon} />
        ) : (
          <Triangle
            aria-hidden
            className={cn(
              icon,
              'fill-current',
              trend === 'fading' && 'rotate-180',
            )}
          />
        )}
        <span className="sr-only">{formatTrend(trend)}</span>
      </span>
    </Noted>
  );
}
