import { WithTooltip } from '@/components/shared/WithTooltip';
import { formatShare } from '@/lib/insights';
import {
  SKILL_WEEK_BAR,
  SKILL_WEEK_GAP,
  type SkillWeek,
} from '@/lib/insights-tools';
import { formatDay } from '@/lib/judge';
import { type TooltipNote, tooltipText } from '@/lib/tooltip-note';
import { cn } from '@/lib/utils';

const HEIGHT = 20;
const FLOOR = 1;

const runsOf = (count: number): string =>
  `${count} ${count === 1 ? 'run' : 'runs'}`;

const noteOf = (week: SkillWeek): TooltipNote => ({
  title: `Week of ${formatDay(week.week)}${week.partial ? ', partly in the period' : ''}`,
  ...(week.runs === 0
    ? { body: 'No runs ended this week.' }
    : {
        rows: [
          ['Share read', formatShare(week.usedRate)],
          ['Runs read', `${week.used} of ${runsOf(week.runs)}`],
          ['Runs given', runsOf(week.enabled)],
        ],
      }),
});

type SkillWeeksChartProps = {
  weeks: readonly SkillWeek[];
  max: number;
  onWeek: (week: string) => void;
};

export function SkillWeeksChart({ weeks, max, onWeek }: SkillWeeksChartProps) {
  return (
    <span
      data-slot="skill-weeks-chart"
      className="flex shrink-0 items-end"
      style={{ height: HEIGHT, gap: SKILL_WEEK_GAP }}
    >
      {weeks.map((week) => {
        const share = week.usedRate ?? 0;
        const tall =
          share > 0 ? Math.max(FLOOR + 1, (share / max) * HEIGHT) : FLOOR;
        const note = noteOf(week);

        return (
          <WithTooltip key={week.week} tooltip={note}>
            <button
              type="button"
              aria-label={tooltipText(note)}
              onClick={() => onWeek(week.week)}
              className="group/week flex h-full items-end rounded-[2px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              style={{ width: SKILL_WEEK_BAR }}
            >
              {week.runs > 0 && (
                <span
                  data-partial={week.partial || undefined}
                  className={cn(
                    'w-full rounded-[1px]',
                    share === 0
                      ? 'bg-border'
                      : week.partial
                        ? 'border border-chart-primary/60 group-hover/week:border-chart-primary dark:border-chart-bar-mini dark:group-hover/week:border-chart-primary'
                        : 'bg-chart-primary/60 transition-colors group-hover/week:bg-chart-primary dark:bg-chart-bar-mini dark:group-hover/week:bg-chart-primary',
                  )}
                  style={{ height: tall }}
                />
              )}
            </button>
          </WithTooltip>
        );
      })}
    </span>
  );
}
