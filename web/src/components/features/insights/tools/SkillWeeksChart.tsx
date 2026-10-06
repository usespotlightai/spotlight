import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { ChartTip } from '@/components/shared/chart/ChartTip';
import { type TipPlacement, useCursorTooltip } from '@/hooks/useCursorTooltip';
import type { SkillWeek } from '@/lib/insights-tools';
import { dayShown } from '@/lib/judge';

const HEIGHT = 56;

const Said = ({
  placement,
  active,
  payload,
}: {
  placement: TipPlacement;
  active?: boolean;
  payload?: { payload: SkillWeek }[];
}) => {
  const week = payload?.[0]?.payload;

  if (!active || !week) {
    return null;
  }

  return (
    <ChartTip placement={placement}>
      <p className="text-muted-foreground">Week of {dayShown(week.week)}</p>
      <p className="text-foreground">
        Read in {week.used} of {week.runs} {week.runs === 1 ? 'run' : 'runs'}
      </p>
      <p className="text-muted-foreground">Given to {week.given}</p>
    </ChartTip>
  );
};

export function SkillWeeksChart({ weeks }: { weeks: readonly SkillWeek[] }) {
  const cursor = useCursorTooltip();
  return (
    <div
      data-slot="skill-weeks-chart"
      className="[&_*:focus:not(:focus-visible)]:outline-none"
    >
      <div {...cursor.area}>
        <ResponsiveContainer width="100%" height={HEIGHT}>
          <BarChart
            data={[...weeks]}
            barGap={-8}
            margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
          >
            <XAxis dataKey="week" hide />
            <Tooltip
              {...cursor.tooltip}
              content={<Said placement={cursor.placement} />}
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
              fill="var(--chart-primary)"
              barSize={8}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
