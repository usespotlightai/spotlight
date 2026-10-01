import { type SkillTrend, trendShown } from '@/lib/insights-tools';
import { cn } from '@/lib/utils';

const TONES: Record<SkillTrend, string> = {
  spreading: 'text-emerald-600 dark:text-emerald-400',
  fading: 'text-destructive',
  steady: 'text-muted-foreground',
};

type SkillTrendBadgeProps = {
  trend: SkillTrend | null;
  rule: string;
};

export function SkillTrendBadge({ trend, rule }: SkillTrendBadgeProps) {
  if (!trend) {
    return null;
  }

  return (
    <span
      data-slot="skill-trend"
      data-trend={trend}
      title={rule}
      className={cn(
        'shrink-0 rounded-full border border-border px-1.5 py-0.5 font-medium text-[10px]',
        TONES[trend],
      )}
    >
      {trendShown(trend)}
    </span>
  );
}
