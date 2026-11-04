import { Triangle } from 'lucide-react';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { formatShare } from '@/lib/insights';
import { formatTrend, type SkillTrend } from '@/lib/insights-tools';
import { cn } from '@/lib/utils';

const TONES: Record<SkillTrend, string> = {
  rising: 'text-chart-primary',
  falling: 'text-outcome-failed',
  flat: 'text-muted-foreground',
};

type SkillTrendMarkProps = {
  rate: number | null;
  used: number;
  runs: number;
  trend: SkillTrend | null;
};

export function SkillTrendMark({
  rate,
  used,
  runs,
  trend,
}: SkillTrendMarkProps) {
  const moving = trend === 'rising' || trend === 'falling';

  return (
    <WithTooltip
      tooltip={{
        title: `Read in ${formatShare(rate)} of runs`,
        rows: [
          ['Runs read', `${used} of ${runs}`],
          ['Trend', trend ? formatTrend(trend) : 'Too few runs to tell'],
        ],
      }}
    >
      <span
        data-slot="skill-trend"
        data-trend={trend ?? undefined}
        className="inline-flex items-center justify-end gap-1 whitespace-nowrap tabular-nums"
      >
        {moving && (
          <Triangle
            aria-hidden
            className={cn(
              'size-[0.6rem] shrink-0 fill-current',
              TONES[trend],
              trend === 'falling' && 'rotate-180',
            )}
          />
        )}
        <span className="text-foreground">{formatShare(rate)}</span>
      </span>
    </WithTooltip>
  );
}
