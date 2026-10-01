import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import type { SkillWeek } from '@/lib/insights-tools';
import { dayShown } from '@/lib/judge';

const HEIGHT = 56;

const Said = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: SkillWeek }[];
}) => {
  const week = payload?.[0]?.payload;

  if (!active || !week) {
    return null;
  }

  return (
    <div className="whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-overlay">
      <p className="text-muted-foreground">Week of {dayShown(week.week)}</p>
      <p className="text-foreground">
        Read in {week.used} of {week.runs} {week.runs === 1 ? 'run' : 'runs'}
      </p>
      <p className="text-muted-foreground">Given to {week.given}</p>
    </div>
  );
};

export function SkillWeeksChart({ weeks }: { weeks: readonly SkillWeek[] }) {
  return (
    <div
      data-slot="skill-weeks-chart"
      className="[&_*:focus:not(:focus-visible)]:outline-none"
    >
      <ResponsiveContainer width="100%" height={HEIGHT}>
        <BarChart
          data={[...weeks]}
          barGap={-8}
          margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
        >
          <XAxis dataKey="week" hide />
          <Tooltip
            content={<Said />}
            isAnimationActive={false}
            cursor={{ fill: 'var(--accent)' }}
          />
          <Bar
            dataKey="runs"
            fill="var(--chart-1)"
            barSize={8}
            isAnimationActive={false}
          />
          <Bar
            dataKey="used"
            fill="var(--primary)"
            barSize={8}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
